import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID, createHash } from 'node:crypto';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createApp } from '../server/index.mjs';
import {
  createDatabase, parseDate, parseInstant, parseMoney, vietnamDate, addDays,
  hashPassword, verifyPassword, membershipView, transaction,
} from '../server/core.mjs';

const epoch = Date.parse('2026-11-04T03:00:00.000Z');
const password = 'Gym@2026Demo!';
const origin = 'http://127.0.0.1:5180';
function expect(result, status, code) {
  assert.equal(result.status, status, JSON.stringify(result.body));
  if (code) assert.equal(result.body.error.code, code);
  return result.body.data;
}
async function fixture(t) {
  const clock = { value: epoch };
  const { server, db } = createApp({ dbPath: ':memory:', seed: true, now: () => clock.value });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((done, reject) => server.close(error => {
    db.close();
    error ? reject(error) : done();
  })));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(method, path, body, session, extraHeaders = {}) {
    const headers = { ...(method === 'GET' ? {} : { Origin: origin, 'Content-Type': 'application/json' }),
      ...(session ? { Cookie: session.cookie, 'X-CSRF-Token': session.csrf } : {}), ...extraHeaders };
    const response = await fetch(base + path, { method, headers, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
    return { status: response.status, headers: response.headers, body: await response.json() };
  }
  async function login(login, suppliedPassword = password) {
    const result = await request('POST', '/auth/login', { login, password: suppliedPassword });
    const data = expect(result, 200);
    return { user: data.user, csrf: data.csrfToken, cookie: result.headers.get('set-cookie').split(';')[0], result };
  }
  return { db, clock, request, login };
}
function otherRecords(db) {
  const hash = db.prepare("SELECT password_hash FROM users WHERE login='member'").get().password_hash;
  const userId = Number(db.prepare("INSERT INTO users(login,full_name,role,password_hash,created_at) VALUES('member.other','Hội viên khác','member',?,?)").run(hash, new Date(epoch).toISOString()).lastInsertRowid);
  const memberId = Number(db.prepare("INSERT INTO members(user_id,phone,created_at) VALUES(?,'0901111111',?)").run(userId, new Date(epoch).toISOString()).lastInsertRowid);
  db.prepare(`INSERT INTO memberships(member_id,package_id,package_name,duration_days,price_vnd,start_date,end_date,created_by,created_at)
    VALUES(?,1,'Gói khác',30,300000,'2026-11-01','2026-11-30',1,?)`).run(memberId, new Date(epoch).toISOString());
  const ptId = Number(db.prepare("INSERT INTO users(login,full_name,role,password_hash,created_at) VALUES('pt.other','PT khác','pt',?,?)").run(hash, new Date(epoch).toISOString()).lastInsertRowid);
  return { memberId, ptId };
}
const booking = (startsAt = '2026-11-05T02:00:00.000Z', endsAt = '2026-11-05T03:00:00.000Z') => ({ memberId: 1, ptId: 3, startsAt, endsAt });
const payment = (amountVnd = 50000) => ({ membershipId: 1, amountVnd, method: 'cash', requestId: randomUUID() });
function tempDirectory(t) {
  const dir = mkdtempSync(join(tmpdir(), 'gym-test-'));
  t.after(() => {
    assert.equal(dirname(resolve(dir)), resolve(tmpdir()));
    assert(basename(dir).startsWith('gym-test-'));
    rmSync(dir, { recursive: true, force: true });
  });
  return dir;
}

test('strict money/calendar helpers, leap days, Vietnam midnight and password hashes', () => {
  for (const value of [0, -1, 1.1, '123', null, NaN, Infinity, 1000000001, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => parseMoney(value), e => e.code === 'VALIDATION_ERROR');
  }
  assert.equal(parseMoney(0, { allowZero: true }), 0);
  assert.equal(parseMoney(1000000000), 1000000000);
  for (const value of ['2026-02-30', '2025-02-29', '2026-13-01', '1999-12-31', '2101-01-01', null, '2026-1-01']) {
    assert.throws(() => parseDate(value), e => e.status === 400);
  }
  assert.equal(parseDate('2028-02-29'), '2028-02-29');
  assert.equal(addDays('2028-02-28', 2), '2028-03-01');
  assert.equal(vietnamDate(Date.parse('2026-11-04T16:59:59.999Z')), '2026-11-04');
  assert.equal(vietnamDate(Date.parse('2026-11-04T17:00:00.000Z')), '2026-11-05');
  for (const value of ['2026-02-30T00:00:00.000Z', '2026-11-04T00:00:00Z', '2026-11-04T07:00:00.000+07:00']) assert.throws(() => parseInstant(value));
  const hash = hashPassword(password);
  assert.notEqual(hash, hashPassword(password));
  assert(verifyPassword(password, hash));
  assert(!verifyPassword('wrong', hash));
  assert(!verifyPassword(password, 'scrypt$999999999$8$1$bad'));
});

test('imports have no database/server side effects and persistent seed never resets data', t => {
  let db;
  t.after(() => db?.close());
  const dir = tempDirectory(t);
  const moduleUrl = new URL('../server/index.mjs', import.meta.url).href;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(moduleUrl)})`], { cwd: dir, timeout: 10000, encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(readdirSync(dir), []);
  const filename = join(dir, 'nested', 'gym.sqlite');
  db = createDatabase({ filename, seed: true, now: () => epoch });
  const initialHash = db.prepare('SELECT password_hash FROM users WHERE id=1').get().password_hash;
  db.prepare("UPDATE members SET phone='0909999999' WHERE id=1").run();
  assert.throws(() => transaction(db, () => {
    db.prepare("UPDATE members SET phone='0900000000' WHERE id=1").run();
    throw new Error('rollback');
  }), /rollback/);
  db.close();
  db = createDatabase({ filename, seed: true, now: () => epoch + 86400000 });
  assert.equal(db.prepare('SELECT phone FROM members WHERE id=1').get().phone, '0909999999');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM users').get().n, 4);
  assert.equal(db.prepare('SELECT password_hash FROM users WHERE id=1').get().password_hash, initialHash);
  assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
});

test('all four roles really log in; cookie tokens are hashed and logout revokes them', async t => {
  const f = await fixture(t);
  for (const role of ['owner', 'staff', 'pt', 'member']) {
    const session = await f.login(role);
    assert.equal(session.user.role, role);
    assert.equal(session.user.memberId, role === 'member' ? 1 : null);
    assert.match(session.result.headers.get('set-cookie'), /HttpOnly; SameSite=Strict; Path=\/api; Max-Age=28800/);
    assert(!JSON.stringify(session.result.body).includes('password'));
    const token = session.cookie.split('=')[1];
    const hash = createHash('sha256').update(token).digest('hex');
    assert(f.db.prepare('SELECT 1 FROM sessions WHERE token_hash=?').get(hash));
    assert(!f.db.prepare('SELECT 1 FROM sessions WHERE token_hash=?').get(token));
    assert.equal(expect(await f.request('GET', '/auth/me', undefined, session), 200).user.role, role);
    expect(await f.request('POST', '/auth/logout', {}, session), 200);
    expect(await f.request('GET', '/auth/me', undefined, session), 401, 'AUTH_REQUIRED');
  }
  expect(await f.request('POST', '/auth/login', { login: 'owner', password: 'wrong' }), 401, 'INVALID_CREDENTIALS');
  expect(await f.request('POST', '/auth/login', { login: 'unknown', password: 'wrong' }), 401, 'INVALID_CREDENTIALS');
});

test('Origin, CSRF, JSON shape/size, duplicate query and unknown keys are enforced', async t => {
  const f = await fixture(t), owner = await f.login('owner');
  expect(await f.request('GET', '/memberships'), 401, 'AUTH_REQUIRED');
  expect(await f.request('POST', '/auth/login', { login: 'owner', password }, null, { Origin: 'http://evil.example' }), 403, 'CSRF_INVALID');
  expect(await f.request('POST', '/auth/login', { login: 'owner', password }, null, { Origin: '' }), 403, 'CSRF_INVALID');
  expect(await f.request('POST', '/auth/logout', {}, owner, { 'X-CSRF-Token': 'wrong' }), 403, 'CSRF_INVALID');
  expect(await f.request('POST', '/auth/logout', {}, owner, { 'Content-Type': 'text/plain' }), 415, 'UNSUPPORTED_MEDIA_TYPE');
  expect(await f.request('POST', '/auth/logout', '{', owner), 400, 'VALIDATION_ERROR');
  expect(await f.request('POST', '/auth/logout', [], owner), 400, 'VALIDATION_ERROR');
  expect(await f.request('POST', '/auth/logout', { extra: true }, owner), 400, 'VALIDATION_ERROR');
  expect(await f.request('POST', '/auth/logout', { large: 'x'.repeat(17000) }, owner), 413, 'PAYLOAD_TOO_LARGE');
  expect(await f.request('POST', '/auth/login', { login: 'owner', password, role: 'owner' }), 400, 'VALIDATION_ERROR');
  expect(await f.request('GET', '/memberships?memberId=1&memberId=1', undefined, owner), 400, 'VALIDATION_ERROR');
  expect(await f.request('GET', '/memberships?bad=1', undefined, owner), 400, 'VALIDATION_ERROR');
  const health = await f.request('GET', '/health');
  assert.deepEqual(expect(health, 200), { status: 'ok' });
  assert.equal(health.headers.get('cache-control'), 'no-store');
});

test('password change revokes every session and sessions expire at exactly eight hours', async t => {
  const f = await fixture(t), first = await f.login('owner'), second = await f.login('owner');
  expect(await f.request('POST', '/auth/change-password', { currentPassword: 'wrong', newPassword: 'NewPassword123!' }, first), 401, 'INVALID_CREDENTIALS');
  expect(await f.request('POST', '/auth/change-password', { currentPassword: password, newPassword: 'short' }, first), 400, 'VALIDATION_ERROR');
  expect(await f.request('POST', '/auth/change-password', { currentPassword: password, newPassword: 'NewPassword123!' }, first), 200);
  for (const session of [first, second]) expect(await f.request('GET', '/auth/me', undefined, session), 401, 'AUTH_REQUIRED');
  expect(await f.request('POST', '/auth/login', { login: 'owner', password }), 401, 'INVALID_CREDENTIALS');
  const fresh = await f.login('owner', 'NewPassword123!');
  f.clock.value += 28800000 - 1;
  expect(await f.request('GET', '/auth/me', undefined, fresh), 200);
  f.clock.value++;
  expect(await f.request('GET', '/auth/me', undefined, fresh), 401, 'AUTH_REQUIRED');
});

test('rate limits failed credentials and resets at the fixed window boundary', async t => {
  const f = await fixture(t);
  for (let i = 0; i < 5; i++) expect(await f.request('POST', '/auth/login', { login: 'owner', password: 'wrong' }), 401);
  const limited = await f.request('POST', '/auth/login', { login: 'owner', password });
  expect(limited, 429, 'RATE_LIMITED');
  assert.equal(limited.headers.get('retry-after'), '900');
  f.clock.value += 900000;
  await f.login('owner');
});

test('membership date boundaries, overlap, package snapshots and immutable history', async t => {
  const f = await fixture(t), owner = await f.login('owner');
  const existing = f.db.prepare('SELECT * FROM memberships WHERE id=1').get();
  const endEpoch = Date.parse(`${existing.end_date}T16:59:59.999Z`);
  assert.equal(membershipView(f.db, existing, endEpoch).status, 'active');
  assert.equal(membershipView(f.db, existing, endEpoch + 1).status, 'expired');
  for (const startDate of [existing.start_date, existing.end_date]) {
    expect(await f.request('POST', '/memberships', { memberId: 1, packageId: 1, startDate }, owner), 409, 'MEMBERSHIP_OVERLAP');
  }
  expect(await f.request('POST', '/memberships', { memberId: 1, packageId: 1, startDate: '2026-02-30' }, owner), 400);
  const created = expect(await f.request('POST', '/memberships', { memberId: 1, packageId: 1, startDate: addDays(existing.end_date, 1) }, owner), 201);
  assert.equal(created.endDate, addDays(created.startDate, 29));
  f.db.prepare("UPDATE packages SET price_vnd=1,name='Đã sửa',duration_days=5,is_active=0 WHERE id=1").run();
  const rows = expect(await f.request('GET', '/memberships', undefined, owner), 200);
  assert.equal(rows.find(x => x.id === created.id).priceVnd, 300000);
  assert.equal(rows.find(x => x.id === created.id).packageName, 'Cơ bản 30 ngày');
  expect(await f.request('POST', '/memberships', { memberId: 1, packageId: 1, startDate: '2027-03-01' }, owner), 409, 'PACKAGE_INACTIVE');
  expect(await f.request('PATCH', '/memberships/1', { priceVnd: 0 }, owner), 404, 'NOT_FOUND');
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM memberships').get().n, 2);
});

test('VND ledger allows exact partial receipts, replay and full payoff without duplicate entries', async t => {
  const f = await fixture(t), owner = await f.login('owner'), staff = await f.login('staff');
  const intent = { ...payment(), note: ' Đợt một ' };
  const first = expect(await f.request('POST', '/payments', intent, owner), 201);
  assert.equal(first.amountVnd, 50000); assert.equal(first.note, 'Đợt một');
  assert.deepEqual(expect(await f.request('POST', '/payments', intent, owner), 200), first);
  expect(await f.request('POST', '/payments', { ...intent, amountVnd: 1 }, owner), 409, 'IDEMPOTENCY_CONFLICT');
  expect(await f.request('POST', '/payments', intent, staff), 409, 'IDEMPOTENCY_CONFLICT');
  expect(await f.request('POST', '/payments', payment(100001), owner), 409, 'OVERPAYMENT');
  const final = payment(100000);
  expect(await f.request('POST', '/payments', final, staff), 201);
  expect(await f.request('POST', '/payments', final, staff), 200);
  expect(await f.request('POST', '/payments', intent, owner), 200);
  expect(await f.request('POST', '/payments', payment(1), owner), 409, 'OVERPAYMENT');
  for (const amount of [0, -1, 1.5, '500', 1000000001]) expect(await f.request('POST', '/payments', payment(amount), owner), 400, 'VALIDATION_ERROR');
  expect(await f.request('PATCH', '/payments/1', { amountVnd: 1 }, owner), 404);
  expect(await f.request('DELETE', '/payments/1', undefined, owner), 404);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM payments').get().n, 3);
  assert.equal(f.db.prepare('SELECT SUM(amount_vnd) n FROM payments').get().n, 300000);
});

test('concurrent receipts cannot overpay and same-key retries commit once', async t => {
  const f = await fixture(t), owner = await f.login('owner');
  const simultaneous = await Promise.all([f.request('POST', '/payments', payment(100000), owner), f.request('POST', '/payments', payment(100000), owner)]);
  assert.deepEqual(simultaneous.map(x => x.status).sort(), [201, 409]);
  const intent = payment(50000);
  const retry = await Promise.all([f.request('POST', '/payments', intent, owner), f.request('POST', '/payments', intent, owner)]);
  assert.deepEqual(retry.map(x => x.status).sort(), [200, 201]);
  assert.equal(f.db.prepare('SELECT SUM(amount_vnd) n FROM payments').get().n, 300000);
});

test('server-side financial/member scopes and unexpected SQL failures leak no details', async t => {
  const f = await fixture(t), owner = await f.login('owner'), member = await f.login('member'), pt = await f.login('pt');
  const other = otherRecords(f.db);
  expect(await f.request('GET', `/memberships?memberId=${other.memberId}`, undefined, member), 403, 'FORBIDDEN');
  expect(await f.request('GET', `/payments?membershipId=2`, undefined, member), 404, 'NOT_FOUND');
  expect(await f.request('GET', '/payments', undefined, pt), 403, 'FORBIDDEN');
  expect(await f.request('POST', '/payments', payment(), member), 403, 'FORBIDDEN');
  expect(await f.request('POST', '/memberships', { memberId: 1, packageId: 1, startDate: '2027-01-01' }, member), 403);
  assert(expect(await f.request('GET', '/memberships', undefined, member), 200).every(x => x.memberId === 1));
  f.db.exec("CREATE TRIGGER reject_receipt BEFORE INSERT ON payments BEGIN SELECT RAISE(ABORT,'secret SQL storage path'); END");
  const failed = await f.request('POST', '/payments', payment(), owner);
  expect(failed, 500, 'INTERNAL_ERROR');
  assert(!JSON.stringify(failed.body).includes('secret'));
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM payments').get().n, 1);
  f.db.exec('DROP TRIGGER reject_receipt');
  expect(await f.request('POST', '/payments', payment(), owner), 201);
});

test('PT conflicts cover both resources, adjacency and cancelled slots', async t => {
  const f = await fixture(t), owner = await f.login('owner');
  const other = otherRecords(f.db);
  expect(await f.request('POST', '/sessions', { ...booking(), memberId: other.memberId }, owner), 409, 'BOOKING_CONFLICT');
  expect(await f.request('POST', '/sessions', { ...booking(), ptId: other.ptId }, owner), 409, 'BOOKING_CONFLICT');
  expect(await f.request('POST', '/sessions', { ...booking(), memberId: other.memberId, ptId: other.ptId }, owner), 201);
  expect(await f.request('POST', '/sessions', booking('2026-11-05T03:00:00.000Z', '2026-11-05T04:00:00.000Z'), owner), 201);
  expect(await f.request('PATCH', '/sessions/1', { status: 'cancelled' }, owner), 200);
  expect(await f.request('POST', '/sessions', booking(), owner), 201);
  expect(await f.request('POST', '/sessions', booking(), owner), 409, 'BOOKING_CONFLICT');
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM pt_sessions').get().n, 4);
  const open = booking('2026-11-05T05:00:00.000Z', '2026-11-05T06:00:00.000Z');
  const simultaneous = await Promise.all([f.request('POST', '/sessions', open, owner), f.request('POST', '/sessions', open, owner)]);
  assert.deepEqual(simultaneous.map(x => x.status).sort(), [201, 409]);
});

test('PT ownership and state transitions enforce server clock and terminal states', async t => {
  const f = await fixture(t), owner = await f.login('owner'), member = await f.login('member'), pt = await f.login('pt');
  const other = otherRecords(f.db);
  const foreign = expect(await f.request('POST', '/sessions', { ...booking(), memberId: other.memberId, ptId: other.ptId }, owner), 201);
  for (const session of [member, pt]) expect(await f.request('PATCH', `/sessions/${foreign.id}`, { status: 'cancelled' }, session), 404, 'NOT_FOUND');
  expect(await f.request('POST', '/sessions', { ...booking(), memberId: other.memberId }, member), 403, 'FORBIDDEN');
  expect(await f.request('POST', '/sessions', booking(), pt), 403, 'FORBIDDEN');
  expect(await f.request('PATCH', '/sessions/1', { status: 'completed' }, member), 403, 'FORBIDDEN');
  expect(await f.request('PATCH', '/sessions/1', { status: 'completed' }, pt), 409, 'INVALID_TRANSITION');
  expect(await f.request('GET', `/sessions?ptId=${other.ptId}`, undefined, pt), 403);
  assert(expect(await f.request('GET', '/sessions', undefined, pt), 200).every(x => x.ptId === 3));
  assert(expect(await f.request('GET', '/sessions', undefined, member), 200).every(x => x.memberId === 1));
  f.clock.value = Date.parse('2026-11-05T02:00:00.000Z');
  const currentMember = await f.login('member'), currentPt = await f.login('pt'), currentOwner = await f.login('owner');
  expect(await f.request('PATCH', '/sessions/1', { status: 'cancelled' }, currentMember), 409, 'INVALID_TRANSITION');
  f.clock.value = Date.parse('2026-11-05T03:00:00.000Z');
  expect(await f.request('PATCH', '/sessions/1', { status: 'completed' }, currentPt), 200);
  expect(await f.request('PATCH', '/sessions/1', { status: 'cancelled' }, currentOwner), 409, 'INVALID_TRANSITION');
});

test('PT booking validates times, calendar coverage and forged ownership fields', async t => {
  const f = await fixture(t), owner = await f.login('owner'), member = await f.login('member');
  for (const [start, end] of [
    ['2026-11-03T02:00:00.000Z', '2026-11-03T03:00:00.000Z'],
    ['2026-11-05T04:01:00.000Z', '2026-11-05T05:01:00.000Z'],
    ['2026-11-05T04:00:00.000Z', '2026-11-05T04:15:00.000Z'],
    ['2026-11-05T16:30:00.000Z', '2026-11-05T17:30:00.000Z'],
  ]) expect(await f.request('POST', '/sessions', booking(start, end), owner), 400, 'VALIDATION_ERROR');
  expect(await f.request('POST', '/sessions', booking('2026-11-24T02:00:00.000Z', '2026-11-24T03:00:00.000Z'), owner), 409, 'NO_ACTIVE_MEMBERSHIP');
  expect(await f.request('POST', '/sessions', { ...booking(), createdBy: 1 }, member), 400);
  const own = expect(await f.request('POST', '/sessions', booking('2026-11-23T02:00:00.000Z', '2026-11-23T03:00:00.000Z'), member), 201);
  expect(await f.request('PATCH', `/sessions/${own.id}`, { status: 'cancelled' }, member), 200);
  expect(await f.request('PATCH', `/sessions/${own.id}`, { status: 'cancelled' }, member), 409);
});
