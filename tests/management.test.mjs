import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from '../server/core.mjs';
import { handleManagement } from '../server/management.mjs';

const now = Date.parse('2026-11-04T03:00:00.000Z');
const owner = {id:1,role:'owner',memberId:null};
const staff = {id:2,role:'staff',memberId:null};
const pt = {id:3,role:'pt',memberId:null};
const member = {id:4,role:'member',memberId:1};
function setup(t) { const db=createDatabase({filename:':memory:',seed:true,now:()=>now}); t.after(()=>db.close()); return db; }
function call(db,user,method,path,body=null,params={}) { return handleManagement({db,user,method,pathname:'/api'+path,query:new URLSearchParams(params),body,now}); }
function error(code, fn) { assert.throws(fn, e => e.code === code); }

test('member creation and update validate atomically and enforce scope', t => {
  const db=setup(t);
  const valid={login:'new.member',initialPassword:'validPassword123',fullName:' Nguyễn An ',phone:'0901234567',email:null};
  error('FORBIDDEN',()=>call(db,pt,'POST','/members',valid));
  error('VALIDATION_ERROR',()=>call(db,staff,'POST','/members',{...valid,phone:'abc'}));
  assert.equal(db.prepare('SELECT count(*) n FROM users WHERE login=?').get(valid.login).n,0);
  const created=call(db,staff,'POST','/members',valid);
  assert.equal(created.status,201); assert.equal(created.data.fullName,'Nguyễn An');
  error('DUPLICATE_LOGIN',()=>call(db,owner,'POST','/members',valid));
  assert.equal(db.prepare('SELECT count(*) n FROM users WHERE login=?').get(valid.login).n,1);
  assert.equal(call(db,owner,'PATCH',`/members/${created.data.id}`,{fullName:'An mới',email:'an@example.test'}).data.fullName,'An mới');
  error('VALIDATION_ERROR',()=>call(db,owner,'PATCH',`/members/${created.data.id}`,{login:'changed'}));
  error('NOT_FOUND',()=>call(db,member,'GET',`/members/${created.data.id}`));
  error('FORBIDDEN',()=>call(db,pt,'GET','/members/1'));
  assert.equal(call(db,owner,'GET','/members',null,{q:'%'}).data.length,0);
});

test('packages enforce owner writes, strict values, and active visibility', t => {
  const db=setup(t);
  error('FORBIDDEN',()=>call(db,staff,'POST','/packages',{name:'Gói',durationDays:30,priceVnd:0}));
  for (const priceVnd of [-1,1.5,'1',1000000001]) error('VALIDATION_ERROR',()=>call(db,owner,'POST','/packages',{name:'Gói',durationDays:30,priceVnd}));
  error('VALIDATION_ERROR',()=>call(db,owner,'POST','/packages',{name:'Gói',durationDays:0,priceVnd:0}));
  const p=call(db,owner,'POST','/packages',{name:'Gói mới',durationDays:30,priceVnd:0}).data;
  error('VALIDATION_ERROR',()=>call(db,owner,'PATCH',`/packages/${p.id}`,{isActive:0}));
  call(db,owner,'PATCH',`/packages/${p.id}`,{isActive:false,priceVnd:123});
  assert.ok(call(db,staff,'GET','/packages').data.some(x=>x.id===p.id));
  assert.ok(!call(db,member,'GET','/packages').data.some(x=>x.id===p.id));
  call(db,owner,'PATCH','/packages/1',{priceVnd:999});
  assert.equal(db.prepare('SELECT price_vnd FROM memberships WHERE id=1').get().price_vnd,300000);
});

test('attendance uses Vietnam date, inclusive membership and idempotent daily check-in', t => {
  const db=setup(t);
  db.prepare('DELETE FROM attendance').run();
  db.prepare("UPDATE memberships SET start_date='2026-11-04',end_date='2026-11-04' WHERE id=1").run();
  const first=call(db,staff,'POST','/attendance',{memberId:1});
  assert.equal(first.status,201); assert.equal(first.data.date,'2026-11-04');
  assert.deepEqual(call(db,owner,'POST','/attendance',{memberId:1}),{status:200,data:first.data});
  assert.equal(db.prepare('SELECT count(*) n FROM attendance').get().n,1);
  db.prepare('DELETE FROM attendance').run();
  db.prepare("UPDATE memberships SET start_date='2026-10-01',end_date='2026-11-03' WHERE id=1").run();
  error('NO_ACTIVE_MEMBERSHIP',()=>call(db,staff,'POST','/attendance',{memberId:1}));
  db.prepare("UPDATE memberships SET start_date='2026-11-05',end_date='2026-12-01' WHERE id=1").run();
  error('NO_ACTIVE_MEMBERSHIP',()=>call(db,staff,'POST','/attendance',{memberId:1}));
  error('FORBIDDEN',()=>call(db,member,'GET','/attendance',null,{memberId:'2'}));
  error('FORBIDDEN',()=>call(db,pt,'GET','/attendance'));
  assert.equal(db.prepare('SELECT count(*) n FROM attendance').get().n,0);
  db.prepare("UPDATE memberships SET start_date='2026-11-04',end_date='2026-11-04' WHERE id=1").run();
  const boundary = time => handleManagement({db,user:staff,method:'POST',pathname:'/api/attendance',query:new URLSearchParams(),body:{memberId:1},now:Date.parse(time)});
  assert.equal(boundary('2026-11-04T16:59:59.000Z').status,201);
  error('NO_ACTIVE_MEMBERSHIP',()=>boundary('2026-11-04T17:00:00.000Z'));
});

test('dashboard counts and financial data are scoped by role', t => {
  const db=setup(t);
  const all=call(db,owner,'GET','/dashboard').data;
  assert.equal(all.totalMembers,1); assert.equal(all.activeMemberships,1); assert.equal(all.todayCheckIns,1);
  assert.equal(all.outstandingVnd,150000); assert.equal(all.revenueTodayVnd,150000); assert.equal(all.revenueMonthVnd,150000);
  const personal=call(db,member,'GET','/dashboard').data;
  assert.equal(personal.membership.memberId,1); assert.equal(personal.outstandingVnd,150000); assert.equal(personal.todayCheckedIn,true);
  assert.ok(!('revenueTodayVnd' in personal));
  const trainer=call(db,pt,'GET','/dashboard').data;
  assert.ok(!('outstandingVnd' in trainer)); assert.ok(trainer.upcomingSessions.every(s=>s.ptId===pt.id));
  assert.equal(call(db,staff,'GET','/dashboard').data.role,'staff');
});

test('dashboard does not expose other members or trainers', t => {
  const db=setup(t), stamp='2026-11-04T03:00:00.000Z';
  const other=call(db,owner,'POST','/members',{login:'other',initialPassword:'validPassword123',fullName:'Người khác',phone:'0900000000'}).data;
  const otherPt=Number(db.prepare("INSERT INTO users(login,full_name,role,password_hash,created_at) VALUES('pt2','PT khác','pt','x',?)").run(stamp).lastInsertRowid);
  db.prepare("INSERT INTO memberships(member_id,package_id,package_name,duration_days,price_vnd,start_date,end_date,created_by,created_at) VALUES(?,1,'Khác',30,700000,'2026-11-01','2026-11-30',1,?)").run(other.id,stamp);
  db.prepare("INSERT INTO pt_sessions(member_id,pt_id,starts_at,ends_at,status,note,created_by,created_at,updated_at) VALUES(?,?, '2026-11-05T03:00:00.000Z','2026-11-05T04:00:00.000Z','booked','',1,?,?)").run(other.id,otherPt,stamp,stamp);
  const personal=call(db,member,'GET','/dashboard').data;
  assert.equal(personal.outstandingVnd,150000);
  assert.ok(personal.upcomingSessions.every(s=>s.memberId===member.memberId));
  const trainer=call(db,pt,'GET','/dashboard').data;
  assert.ok(trainer.upcomingSessions.every(s=>s.ptId===pt.id));
  assert.equal(call(db,owner,'GET','/dashboard').data.outstandingVnd,850000);
});

