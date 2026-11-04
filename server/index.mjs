import { createServer } from 'node:http';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createDatabase, fail, requireRole, transaction, parseMoney, parseDate, parseInstant,
  vietnamDate, addDays, isoNow, hashPassword, verifyPassword, publicUser, membershipView, sessionView,
} from './core.mjs';
import { handleManagement } from './management.mjs';

const notFound = () => fail(404, 'NOT_FOUND', 'Không tìm thấy dữ liệu.');
const invalid = field => fail(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ.', { [field]: 'Kiểm tra lại giá trị.' });
const origins = new Set(['http://127.0.0.1:5180', 'http://localhost:5180', 'http://127.0.0.1:3010', 'http://localhost:3010']);
const digest = value => createHash('sha256').update(value).digest('hex');
const equal = (a, b) => typeof a === 'string' && typeof b === 'string'
  && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const cookie = token => `gym_session=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${token ? 28800 : 0}`;

function fields(body, allowed, required = allowed) {
  if (Object.keys(body).some(key => !allowed.includes(key))) invalid('body');
  for (const key of required) if (!Object.hasOwn(body, key)) invalid(key);
}
function queries(query, allowed = []) {
  for (const key of query.keys()) if (!allowed.includes(key) || query.getAll(key).length !== 1) invalid(key);
}
function id(value, field = 'id', fromQuery = false) {
  if (fromQuery) {
    if (typeof value !== 'string' || !/^\d+$/.test(value)) invalid(field);
    value = Number(value);
  }
  if (!Number.isSafeInteger(value) || value <= 0) invalid(field);
  return value;
}
function note(value = '') {
  if (typeof value !== 'string' || value.trim().length > 500) invalid('note');
  return value.trim();
}
function scopeMember(user, memberId) {
  if (user.role === 'member') {
    if (memberId !== null && memberId !== user.memberId) fail(403, 'FORBIDDEN', 'Không có quyền truy cập hội viên này.');
    return user.memberId;
  }
  return memberId;
}
const optionalId = (query, field) => query.has(field) ? id(query.get(field), field, true) : null;

function paymentView(db, row) {
  const member = db.prepare(`SELECT m.id, u.full_name FROM memberships ms JOIN members m ON m.id=ms.member_id
    JOIN users u ON u.id=m.user_id WHERE ms.id=?`).get(row.membership_id);
  return { id: row.id, membershipId: row.membership_id, memberId: member.id, memberName: member.full_name,
    amountVnd: row.amount_vnd, method: row.method, note: row.note, requestId: row.request_id,
    recordedBy: row.recorded_by, createdAt: row.created_at };
}

function handleBusiness({ db, user, method, pathname, query, body, now }) {
  if (pathname === '/api/memberships' && method === 'GET') {
    requireRole(user, 'owner', 'staff', 'member'); queries(query, ['memberId']);
    const memberId = scopeMember(user, optionalId(query, 'memberId'));
    return { status: 200, data: db.prepare('SELECT * FROM memberships WHERE (? IS NULL OR member_id=?) ORDER BY start_date DESC,id DESC')
      .all(memberId, memberId).map(row => membershipView(db, row, now)) };
  }
  if (pathname === '/api/memberships' && method === 'POST') {
    requireRole(user, 'owner', 'staff'); queries(query); fields(body, ['memberId', 'packageId', 'startDate']);
    const memberId = id(body.memberId, 'memberId'), packageId = id(body.packageId, 'packageId'), start = parseDate(body.startDate);
    return transaction(db, () => {
      if (!db.prepare('SELECT 1 FROM members WHERE id=?').get(memberId)) notFound();
      const pack = db.prepare('SELECT * FROM packages WHERE id=?').get(packageId);
      if (!pack) notFound();
      if (!pack.is_active) fail(409, 'PACKAGE_INACTIVE', 'Gói tập đã ngừng bán.');
      const end = parseDate(addDays(start, pack.duration_days - 1));
      if (db.prepare('SELECT 1 FROM memberships WHERE member_id=? AND start_date<=? AND end_date>=?').get(memberId, end, start)) {
        fail(409, 'MEMBERSHIP_OVERLAP', 'Thời hạn bị trùng với thẻ đã có.');
      }
      const result = db.prepare(`INSERT INTO memberships(member_id,package_id,package_name,duration_days,price_vnd,start_date,end_date,created_by,created_at)
        VALUES(?,?,?,?,?,?,?,?,?)`).run(memberId, packageId, pack.name, pack.duration_days, pack.price_vnd, start, end, user.id, isoNow(now));
      return { status: 201, data: membershipView(db, db.prepare('SELECT * FROM memberships WHERE id=?').get(result.lastInsertRowid), now) };
    });
  }
  if (pathname === '/api/payments' && method === 'GET') {
    requireRole(user, 'owner', 'staff', 'member'); queries(query, ['memberId', 'membershipId']);
    const memberId = scopeMember(user, optionalId(query, 'memberId')), membershipId = optionalId(query, 'membershipId');
    if (user.role === 'member' && membershipId !== null) {
      const membership = db.prepare('SELECT member_id FROM memberships WHERE id=?').get(membershipId);
      if (membership && membership.member_id !== memberId) notFound();
    }
    return { status: 200, data: db.prepare(`SELECT p.* FROM payments p JOIN memberships ms ON ms.id=p.membership_id
      WHERE (? IS NULL OR ms.member_id=?) AND (? IS NULL OR p.membership_id=?) ORDER BY p.created_at DESC,p.id DESC`)
      .all(memberId, memberId, membershipId, membershipId).map(row => paymentView(db, row)) };
  }
  if (pathname === '/api/payments' && method === 'POST') {
    requireRole(user, 'owner', 'staff'); queries(query);
    fields(body, ['membershipId', 'amountVnd', 'method', 'requestId', 'note'], ['membershipId', 'amountVnd', 'method', 'requestId']);
    const membershipId = id(body.membershipId, 'membershipId'), amount = parseMoney(body.amountVnd), memo = note(body.note);
    if (!['cash', 'bank_transfer'].includes(body.method)) invalid('method');
    if (typeof body.requestId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(body.requestId)) invalid('requestId');
    return transaction(db, () => {
      const existing = db.prepare('SELECT * FROM payments WHERE request_id=?').get(body.requestId);
      if (existing) {
        if (existing.membership_id !== membershipId || existing.amount_vnd !== amount || existing.method !== body.method
            || existing.note !== memo || existing.recorded_by !== user.id) {
          fail(409, 'IDEMPOTENCY_CONFLICT', 'Mã yêu cầu đã được dùng cho giao dịch khác.');
        }
        return { status: 200, data: paymentView(db, existing) };
      }
      const membership = db.prepare('SELECT * FROM memberships WHERE id=?').get(membershipId);
      if (!membership) notFound();
      if (amount > membershipView(db, membership, now).balanceVnd) fail(409, 'OVERPAYMENT', 'Số tiền vượt số còn nợ.');
      const result = db.prepare('INSERT INTO payments(membership_id,amount_vnd,method,note,request_id,recorded_by,created_at) VALUES(?,?,?,?,?,?,?)')
        .run(membershipId, amount, body.method, memo, body.requestId, user.id, isoNow(now));
      return { status: 201, data: paymentView(db, db.prepare('SELECT * FROM payments WHERE id=?').get(result.lastInsertRowid)) };
    });
  }
  if (pathname === '/api/trainers' && method === 'GET') {
    queries(query);
    return { status: 200, data: db.prepare("SELECT id, full_name fullName FROM users WHERE role='pt' ORDER BY id").all() };
  }
  if (pathname === '/api/sessions' && method === 'GET') {
    queries(query, ['memberId', 'ptId', 'from', 'to']);
    const memberId = scopeMember(user, optionalId(query, 'memberId'));
    let ptId = optionalId(query, 'ptId');
    if (user.role === 'pt') {
      if (ptId !== null && ptId !== user.id) fail(403, 'FORBIDDEN', 'Không có quyền truy cập lịch PT này.');
      ptId = user.id;
    }
    const from = query.has('from') ? parseDate(query.get('from')) : null;
    const to = query.has('to') ? parseDate(query.get('to')) : null;
    if (from && to && from > to) invalid('from');
    return { status: 200, data: db.prepare(`SELECT * FROM pt_sessions WHERE (? IS NULL OR member_id=?) AND (? IS NULL OR pt_id=?)
      AND (? IS NULL OR date(starts_at,'+7 hours')>=?) AND (? IS NULL OR date(starts_at,'+7 hours')<=?) ORDER BY starts_at,id`)
      .all(memberId, memberId, ptId, ptId, from, from, to, to).map(row => sessionView(db, row)) };
  }
  if (pathname === '/api/sessions' && method === 'POST') {
    requireRole(user, 'owner', 'staff', 'member'); queries(query);
    fields(body, ['memberId', 'ptId', 'startsAt', 'endsAt', 'note'], ['memberId', 'ptId', 'startsAt', 'endsAt']);
    const memberId = scopeMember(user, id(body.memberId, 'memberId')), ptId = id(body.ptId, 'ptId');
    const startsAt = parseInstant(body.startsAt), endsAt = parseInstant(body.endsAt), memo = note(body.note);
    const start = Date.parse(startsAt), end = Date.parse(endsAt), duration = (end - start) / 60000;
    if (start < now || start % 900000 || end % 900000 || duration < 30 || duration > 180 || duration % 15
        || vietnamDate(start) !== vietnamDate(end)) invalid('startsAt');
    const date = parseDate(vietnamDate(start));
    return transaction(db, () => {
      if (!db.prepare('SELECT 1 FROM members WHERE id=?').get(memberId)
          || !db.prepare("SELECT 1 FROM users WHERE id=? AND role='pt'").get(ptId)) notFound();
      if (!db.prepare('SELECT 1 FROM memberships WHERE member_id=? AND start_date<=? AND end_date>=?').get(memberId, date, date)) {
        fail(409, 'NO_ACTIVE_MEMBERSHIP', 'Hội viên không có thẻ bao phủ ngày đặt lịch.');
      }
      if (db.prepare("SELECT 1 FROM pt_sessions WHERE status!='cancelled' AND starts_at<? AND ends_at>? AND (pt_id=? OR member_id=?)")
        .get(endsAt, startsAt, ptId, memberId)) fail(409, 'BOOKING_CONFLICT', 'Khung giờ đã có lịch PT hoặc hội viên.');
      const stamp = isoNow(now);
      const result = db.prepare('INSERT INTO pt_sessions(member_id,pt_id,starts_at,ends_at,note,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)')
        .run(memberId, ptId, startsAt, endsAt, memo, user.id, stamp, stamp);
      return { status: 201, data: sessionView(db, db.prepare('SELECT * FROM pt_sessions WHERE id=?').get(result.lastInsertRowid)) };
    });
  }
  const match = /^\/api\/sessions\/([^/]+)$/.exec(pathname);
  if (match && method === 'PATCH') {
    queries(query); fields(body, ['status']);
    if (!['completed', 'cancelled'].includes(body.status)) invalid('status');
    const sessionId = id(match[1], 'id', true);
    return transaction(db, () => {
      const row = db.prepare('SELECT * FROM pt_sessions WHERE id=?').get(sessionId);
      if (!row || (user.role === 'pt' && row.pt_id !== user.id) || (user.role === 'member' && row.member_id !== user.memberId)) notFound();
      if (user.role === 'member' && body.status === 'completed') fail(403, 'FORBIDDEN', 'Hội viên không được hoàn thành buổi PT.');
      if (row.status !== 'booked' || (body.status === 'completed' && Date.parse(row.ends_at) > now)
          || (user.role === 'member' && Date.parse(row.starts_at) <= now)) {
        fail(409, 'INVALID_TRANSITION', 'Không thể đổi trạng thái buổi PT lúc này.');
      }
      db.prepare('UPDATE pt_sessions SET status=?, updated_at=? WHERE id=?').run(body.status, isoNow(now), sessionId);
      return { status: 200, data: sessionView(db, db.prepare('SELECT * FROM pt_sessions WHERE id=?').get(sessionId)) };
    });
  }
  return null;
}

async function readBody(req) {
  if (Number(req.headers['content-length']) > 16384) { req.resume(); fail(413, 'PAYLOAD_TOO_LARGE', 'Dữ liệu gửi lên quá lớn.'); }
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
    req.resume(); fail(415, 'UNSUPPORTED_MEDIA_TYPE', 'Yêu cầu cần Content-Type application/json.');
  }
  const chunks = [];
  let length = 0;
  const raw = await new Promise((resolveBody, reject) => {
    req.on('data', chunk => {
      length += chunk.length;
      if (length > 16384) {
        const error = Object.assign(new Error('Dữ liệu gửi lên quá lớn.'), { status: 413, code: 'PAYLOAD_TOO_LARGE' });
        reject(error);
      } else chunks.push(chunk);
    });
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
  let body;
  try { body = JSON.parse(raw); } catch { invalid('body'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('body');
  return body;
}

export function createApp({ dbPath = 'data/gym.sqlite', seed = true, now = Date.now } = {}) {
  const db = createDatabase({ filename: dbPath, seed, now });
  const dummyHash = hashPassword(randomBytes(24).toString('hex'));
  const limits = new Map();
  function limit(ip, login, epoch) {
    for (const [key, value] of limits) if (value.until <= epoch) limits.delete(key);
    const ipKey = `ip:${ip}`, pairKey = `pair:${ip}:${login}`;
    for (const key of [ipKey, pairKey]) if (!limits.has(key)) limits.set(key, { count: 0, until: epoch + 900000 });
    const ipLimit = limits.get(ipKey), pair = limits.get(pairKey);
    if (ipLimit.count >= 30 || pair.count >= 5) {
      const until = Math.max(ipLimit.count >= 30 ? ipLimit.until : 0, pair.count >= 5 ? pair.until : 0);
      try { fail(429, 'RATE_LIMITED', 'Đăng nhập quá nhiều lần. Vui lòng thử lại sau.'); }
      catch (error) { error.retryAfter = Math.ceil((until - epoch) / 1000); throw error; }
    }
    ipLimit.count++;
    return { pair, pairKey };
  }
  function currentSession(req, epoch) {
    db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(epoch);
    const tokens = (req.headers.cookie || '').split(';').map(part => part.trim()).filter(part => part.startsWith('gym_session='));
    if (tokens.length !== 1) return null;
    const token = tokens[0].slice('gym_session='.length);
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    return db.prepare('SELECT * FROM sessions WHERE token_hash=? AND expires_at>?').get(digest(token), epoch) ?? null;
  }
  function auth(ctx, req, res, session) {
    const { pathname, method, query, body, now: epoch, user } = ctx;
    if (pathname === '/api/auth/login' && method === 'POST') {
      queries(query); fields(body, ['login', 'password']);
      if (typeof body.login !== 'string' || !/^[a-z0-9._@-]{2,64}$/.test(body.login.trim().toLowerCase())) invalid('login');
      if (typeof body.password !== 'string' || body.password.length > 128) invalid('password');
      const login = body.login.trim().toLowerCase();
      const { pair, pairKey } = limit(req.socket.remoteAddress, login, epoch);
      const row = db.prepare('SELECT * FROM users WHERE login=? COLLATE NOCASE').get(login);
      const valid = verifyPassword(body.password, row?.password_hash ?? dummyHash);
      if (!row || !valid) { pair.count++; fail(401, 'INVALID_CREDENTIALS', 'Tên đăng nhập hoặc mật khẩu không đúng.'); }
      limits.delete(pairKey);
      const token = randomBytes(32).toString('base64url'), csrf = randomBytes(32).toString('base64url');
      transaction(db, () => {
        if (session) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(session.token_hash);
        db.prepare('INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at,created_at) VALUES(?,?,?,?,?)')
          .run(digest(token), row.id, csrf, epoch + 28800000, isoNow(epoch));
      });
      res.setHeader('Set-Cookie', cookie(token));
      return { status: 200, data: { user: publicUser(db, row), csrfToken: csrf } };
    }
    if (pathname === '/api/auth/me' && method === 'GET') {
      queries(query);
      return { status: 200, data: { user, csrfToken: session.csrf_token } };
    }
    if (pathname === '/api/auth/logout' && method === 'POST') {
      queries(query); fields(body, []);
      db.prepare('DELETE FROM sessions WHERE token_hash=?').run(session.token_hash);
      res.setHeader('Set-Cookie', cookie(''));
      return { status: 200, data: null };
    }
    if (pathname === '/api/auth/change-password' && method === 'POST') {
      queries(query); fields(body, ['currentPassword', 'newPassword']);
      if (typeof body.currentPassword !== 'string' || body.currentPassword.length > 128) invalid('currentPassword');
      const row = db.prepare('SELECT * FROM users WHERE id=?').get(user.id);
      if (!verifyPassword(body.currentPassword, row.password_hash)) fail(401, 'INVALID_CREDENTIALS', 'Mật khẩu hiện tại không đúng.');
      const hash = hashPassword(body.newPassword);
      transaction(db, () => {
        db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash, user.id);
        db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
      });
      res.setHeader('Set-Cookie', cookie(''));
      return { status: 200, data: null };
    }
    return null;
  }
  const server = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      if (!/^(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(req.headers.host || '')) invalid('host');
      const url = new URL(req.url, 'http://127.0.0.1');
      const epoch = now();
      const method = req.method;
      const mutation = method === 'POST' || method === 'PATCH';
      if (mutation && !origins.has(req.headers.origin)) fail(403, 'CSRF_INVALID', 'Nguồn yêu cầu không hợp lệ.');
      if (method === 'GET' && (Number(req.headers['content-length']) > 0 || req.headers['transfer-encoding'])) invalid('body');
      const body = mutation ? await readBody(req) : null;
      if (!mutation) req.resume();
      const session = currentSession(req, epoch);
      const row = session ? db.prepare('SELECT * FROM users WHERE id=?').get(session.user_id) : null;
      const user = row ? publicUser(db, row) : null;
      const login = url.pathname === '/api/auth/login' && method === 'POST';
      const health = url.pathname === '/api/health' && method === 'GET';
      if (!login && !health) requireRole(user, 'owner', 'staff', 'pt', 'member');
      if (mutation && !login && !equal(req.headers['x-csrf-token'], session.csrf_token)) fail(403, 'CSRF_INVALID', 'Mã bảo vệ phiên không hợp lệ.');
      const ctx = { db, user, method, pathname: url.pathname, query: url.searchParams, body, now: epoch };
      let result;
      if (health) { queries(ctx.query); result = { status: 200, data: { status: 'ok' } }; }
      else result = auth(ctx, req, res, session) ?? handleBusiness(ctx) ?? handleManagement(ctx);
      if (!result) notFound();
      res.statusCode = result.status;
      res.end(JSON.stringify({ data: result.data }));
    } catch (error) {
      const expected = Number.isInteger(error.status) && error.status >= 400 && error.status <= 599 && typeof error.code === 'string';
      res.statusCode = expected ? error.status : 500;
      if (error.retryAfter) res.setHeader('Retry-After', String(error.retryAfter));
      res.end(JSON.stringify({ error: expected
        ? { code: error.code, message: error.message, ...(error.fields ? { fields: error.fields } : {}) }
        : { code: 'INTERNAL_ERROR', message: 'Không thể xử lý yêu cầu. Vui lòng thử lại.' } }));
    }
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 10000;
  server.maxHeadersCount = 100;
  return { server, db };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT || 3010);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be 1..65535');
  const { server, db } = createApp({ dbPath: process.env.DB_PATH || 'data/gym.sqlite' });
  server.listen(port, '127.0.0.1', () => console.log(`Gym API: http://127.0.0.1:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(() => db.close()));
  server.once('error', () => { db.close(); console.error('Không thể khởi động máy chủ.'); process.exitCode = 1; });
}
