import { fail, requireRole, transaction, parseMoney, parseDate, vietnamDate, addDays, isoNow, hashPassword, membershipView, sessionView } from './core.mjs';

const invalid = (field, message = 'Giá trị không hợp lệ') => fail(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', { [field]: message });
const missing = () => fail(404, 'NOT_FOUND', 'Không tìm thấy dữ liệu');
function fields(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.keys(body).length || Object.keys(body).some(k => !allowed.includes(k))) invalid('body');
}
function queries(query, allowed = []) {
  for (const key of query.keys()) if (!allowed.includes(key) || query.getAll(key).length !== 1) invalid(key);
}
function id(value, field = 'id', body = false) {
  if (body ? !Number.isSafeInteger(value) || value <= 0 : !/^[0-9]+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) invalid(field);
  return Number(value);
}
function name(value, field) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 100) invalid(field);
  return value.trim();
}
function phone(value) {
  if (typeof value !== 'string' || !/^\+?\d{8,15}$/.test(value.trim())) invalid('phone');
  return value.trim();
}
function email(value) {
  if (value === null) return null;
  if (typeof value !== 'string' || value.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) invalid('email');
  return value.trim();
}
function duration(value) {
  if (!Number.isInteger(value) || value < 1 || value > 366) invalid('durationDays');
  return value;
}
function price(value) {
  try { return parseMoney(value, { allowZero: true }); } catch (error) { if (error.status === 400) invalid('priceVnd'); throw error; }
}
const memberSql = 'SELECT m.id, m.user_id, u.login, u.full_name, m.phone, m.email, m.created_at FROM members m JOIN users u ON u.id=m.user_id';
const member = r => ({ id:r.id, userId:r.user_id, login:r.login, fullName:r.full_name, phone:r.phone, email:r.email, createdAt:r.created_at });
const pack = r => ({ id:r.id, name:r.name, durationDays:r.duration_days, priceVnd:r.price_vnd, isActive:!!r.is_active, createdAt:r.created_at });
const attendanceSql = 'SELECT a.*, u.full_name AS member_name FROM attendance a JOIN members m ON m.id=a.member_id JOIN users u ON u.id=m.user_id';
const attendance = r => ({ id:r.id, memberId:r.member_id, memberName:r.member_name, date:r.date, checkedInAt:r.checked_in_at, checkedInBy:r.checked_in_by });
const getMember = (db, value) => { const row = db.prepare(`${memberSql} WHERE m.id=?`).get(value); if (!row) missing(); return member(row); };
const getPackage = (db, value) => { const row = db.prepare('SELECT * FROM packages WHERE id=?').get(value); if (!row) missing(); return pack(row); };
function safe(value) { if (!Number.isSafeInteger(value)) fail(500, 'INTERNAL_ERROR', 'Không thể tính tổng'); return value; }
function dashboard({db, user, now}) {
  const today = vietnamDate(now), month = today.slice(0,7), timestamp = isoNow(now);
  const scalar = (sql, ...args) => safe(db.prepare(sql).get(...args).n);
  const sessionScope = user.role === 'pt' ? ' AND pt_id=?' : user.role === 'member' ? ' AND member_id=?' : '';
  const scopeArgs = user.role === 'pt' ? [user.id] : user.role === 'member' ? [user.memberId] : [];
  const upcomingSessions = db.prepare(`SELECT * FROM pt_sessions WHERE status='booked' AND starts_at>=?${sessionScope} ORDER BY starts_at,id LIMIT 5`).all(timestamp, ...scopeArgs).map(row => sessionView(db,row));
  const todaySessions = () => scalar(`SELECT count(*) n FROM pt_sessions WHERE status!='cancelled' AND date(starts_at,'+7 hours')=?${sessionScope}`, today, ...scopeArgs);
  if (user.role === 'pt') return {role:user.role, todaySessions:todaySessions(), completedSessionsThisMonth:scalar("SELECT count(*) n FROM pt_sessions WHERE pt_id=? AND status='completed' AND substr(date(starts_at,'+7 hours'),1,7)=?",user.id,month), upcomingSessions};
  if (user.role === 'member') {
    const row = db.prepare('SELECT * FROM memberships WHERE member_id=? ORDER BY CASE WHEN start_date<=? AND end_date>=? THEN 0 WHEN start_date>? THEN 1 ELSE 2 END, CASE WHEN start_date>? THEN start_date END ASC, CASE WHEN end_date<? THEN end_date END DESC, id DESC LIMIT 1').get(user.memberId,today,today,today,today,today);
    return { role:user.role, membership:row ? membershipView(db,row,now) : null, todayCheckedIn:!!db.prepare('SELECT 1 FROM attendance WHERE member_id=? AND date=?').get(user.memberId,today), outstandingVnd:scalar('SELECT COALESCE((SELECT sum(price_vnd) FROM memberships WHERE member_id=?),0)-COALESCE((SELECT sum(p.amount_vnd) FROM payments p JOIN memberships m ON m.id=p.membership_id WHERE m.member_id=?),0) n',user.memberId,user.memberId), upcomingSessions };
  }
  requireRole(user,'owner','staff');
  return { role:user.role, totalMembers:scalar('SELECT count(*) n FROM members'), activeMemberships:scalar('SELECT count(*) n FROM memberships WHERE start_date<=? AND end_date>=?',today,today), expiringSoonCount:scalar('SELECT count(*) n FROM memberships WHERE start_date<=? AND end_date BETWEEN ? AND ?',today,today,addDays(today,7)), todayCheckIns:scalar('SELECT count(*) n FROM attendance WHERE date=?',today), todaySessions:todaySessions(), outstandingVnd:scalar('SELECT COALESCE((SELECT sum(price_vnd) FROM memberships),0)-COALESCE((SELECT sum(amount_vnd) FROM payments),0) n'), revenueTodayVnd:scalar("SELECT COALESCE(sum(amount_vnd),0) n FROM payments WHERE date(created_at,'+7 hours')=?",today), revenueMonthVnd:scalar("SELECT COALESCE(sum(amount_vnd),0) n FROM payments WHERE substr(date(created_at,'+7 hours'),1,7)=?",month), upcomingSessions };
}

export function handleManagement(ctx) {
  const {db,user,method,pathname,query,body,now} = ctx;
  const match = pathname.match(/^\/api\/(members|packages)\/([^/]+)$/);
  if (pathname === '/api/dashboard' && method === 'GET') { queries(query); requireRole(user,'owner','staff','pt','member'); return {status:200,data:dashboard(ctx)}; }
  if (pathname === '/api/members' && method === 'GET') {
    requireRole(user,'owner','staff'); queries(query,['q']);
    const q = query.get('q'); if (q !== null && q.length > 100) invalid('q');
    const rows = db.prepare(memberSql + ' ORDER BY m.id DESC').all();
    const term = q?.trim().toLowerCase();
    return {status:200,data:rows.filter(r => !term || [r.full_name,r.login,r.phone,r.email].some(v => v?.toLowerCase().includes(term))).map(member)};
  }
  if (pathname === '/api/members' && method === 'POST') {
    requireRole(user,'owner','staff'); queries(query); fields(body,['login','initialPassword','fullName','phone','email']);
    if (typeof body.login !== 'string' || !/^[a-z0-9._@-]{3,64}$/.test(body.login.trim().toLowerCase())) invalid('login');
    if (typeof body.initialPassword !== 'string' || body.initialPassword.length < 10 || body.initialPassword.length > 128) invalid('initialPassword');
    const login=body.login.trim().toLowerCase(), fullName=name(body.fullName,'fullName'), p=phone(body.phone), e=body.email === undefined ? null : email(body.email), hash=hashPassword(body.initialPassword), timestamp=isoNow(now);
    return transaction(db,() => {
      if (db.prepare('SELECT 1 FROM users WHERE login=? COLLATE NOCASE').get(login)) fail(409,'DUPLICATE_LOGIN','Tên đăng nhập đã tồn tại');
      const userId=Number(db.prepare("INSERT INTO users(login,full_name,role,password_hash,created_at) VALUES(?,?,'member',?,?)").run(login,fullName,hash,timestamp).lastInsertRowid);
      const memberId=Number(db.prepare('INSERT INTO members(user_id,phone,email,created_at) VALUES(?,?,?,?)').run(userId,p,e,timestamp).lastInsertRowid);
      return {status:201,data:getMember(db,memberId)};
    });
  }
  if (match && match[1] === 'members' && (method === 'GET' || method === 'PATCH')) {
    queries(query); const memberId=id(match[2]);
    if (method === 'GET') { requireRole(user,'owner','staff','member'); if (user.role === 'member' && user.memberId !== memberId) missing(); return {status:200,data:getMember(db,memberId)}; }
    requireRole(user,'owner','staff'); fields(body,['fullName','phone','email']);
    const current=getMember(db,memberId), fullName=body.fullName === undefined ? current.fullName : name(body.fullName,'fullName'), p=body.phone === undefined ? current.phone : phone(body.phone), e=body.email === undefined ? current.email : email(body.email);
    return transaction(db,() => { db.prepare('UPDATE users SET full_name=? WHERE id=?').run(fullName,current.userId); db.prepare('UPDATE members SET phone=?,email=? WHERE id=?').run(p,e,memberId); return {status:200,data:getMember(db,memberId)}; });
  }
  if (pathname === '/api/packages' && method === 'GET') { requireRole(user,'owner','staff','pt','member'); queries(query); return {status:200,data:db.prepare(`SELECT * FROM packages ${['pt','member'].includes(user.role) ? 'WHERE is_active=1' : ''} ORDER BY id`).all().map(pack)}; }
  if (pathname === '/api/packages' && method === 'POST') {
    requireRole(user,'owner'); queries(query); fields(body,['name','durationDays','priceVnd']);
    const result=db.prepare('INSERT INTO packages(name,duration_days,price_vnd,created_at) VALUES(?,?,?,?)').run(name(body.name,'name'),duration(body.durationDays),price(body.priceVnd),isoNow(now));
    return {status:201,data:getPackage(db,Number(result.lastInsertRowid))};
  }
  if (match && match[1] === 'packages' && method === 'PATCH') {
    requireRole(user,'owner'); queries(query); fields(body,['name','durationDays','priceVnd','isActive']); const packageId=id(match[2]), current=getPackage(db,packageId);
    if (body.isActive !== undefined && typeof body.isActive !== 'boolean') invalid('isActive');
    db.prepare('UPDATE packages SET name=?,duration_days=?,price_vnd=?,is_active=? WHERE id=?').run(body.name === undefined ? current.name : name(body.name,'name'),body.durationDays === undefined ? current.durationDays : duration(body.durationDays),body.priceVnd === undefined ? current.priceVnd : price(body.priceVnd),Number(body.isActive === undefined ? current.isActive : body.isActive),packageId);
    return {status:200,data:getPackage(db,packageId)};
  }
  if (pathname === '/api/attendance' && method === 'GET') {
    requireRole(user,'owner','staff','member'); queries(query,['memberId','from','to']);
    let memberId=query.has('memberId') ? id(query.get('memberId'),'memberId') : null;
    if (user.role === 'member') { if (memberId !== null && memberId !== user.memberId) fail(403,'FORBIDDEN','Không có quyền truy cập'); memberId=user.memberId; }
    const from=query.has('from') ? parseDate(query.get('from')) : null, to=query.has('to') ? parseDate(query.get('to')) : null;
    if (from && to && from > to) invalid('from');
    return {status:200,data:db.prepare(`${attendanceSql} WHERE (? IS NULL OR a.member_id=?) AND (? IS NULL OR a.date>=?) AND (? IS NULL OR a.date<=?) ORDER BY a.date DESC,a.id DESC`).all(memberId,memberId,from,from,to,to).map(attendance)};
  }
  if (pathname === '/api/attendance' && method === 'POST') {
    requireRole(user,'owner','staff'); queries(query); fields(body,['memberId']); const memberId=id(body.memberId,'memberId',true), today=vietnamDate(now);
    return transaction(db,() => {
      getMember(db,memberId);
      const existing=db.prepare(`${attendanceSql} WHERE a.member_id=? AND a.date=?`).get(memberId,today);
      if (existing) return {status:200,data:attendance(existing)};
      if (!db.prepare('SELECT 1 FROM memberships WHERE member_id=? AND start_date<=? AND end_date>=?').get(memberId,today,today)) fail(409,'NO_ACTIVE_MEMBERSHIP','Hội viên không có thẻ còn hiệu lực');
      const result=db.prepare('INSERT INTO attendance(member_id,date,checked_in_at,checked_in_by) VALUES(?,?,?,?)').run(memberId,today,isoNow(now),user.id);
      return {status:201,data:attendance(db.prepare(`${attendanceSql} WHERE a.id=?`).get(Number(result.lastInsertRowid)))};
    });
  }
  return null;
}

