import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function fail(status, code, message, fields) {
  throw Object.assign(new Error(message), { status, code, ...(fields ? { fields } : {}) });
}

export function requireRole(user, ...roles) {
  if (!user) fail(401, 'AUTH_REQUIRED', 'Vui lòng đăng nhập.');
  if (!roles.includes(user.role)) fail(403, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.');
}

export function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    if (result && typeof result.then === 'function') throw new Error('Transaction must be synchronous');
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function parseMoney(value, { allowZero = false } = {}) {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1) || value > 1000000000) {
    fail(400, 'VALIDATION_ERROR', 'Số tiền VND không hợp lệ.', { amountVnd: 'Nhập số nguyên trong giới hạn cho phép.' });
  }
  return value;
}

export function parseDate(value) {
  if (typeof value !== 'string' || !/^(20\d{2}|2100)-\d{2}-\d{2}$/.test(value)
      || !Number.isFinite(Date.parse(`${value}T00:00:00.000Z`))
      || new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value) {
    fail(400, 'VALIDATION_ERROR', 'Ngày phải đúng lịch và có dạng YYYY-MM-DD.');
  }
  return value;
}

export function parseInstant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
      || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    fail(400, 'VALIDATION_ERROR', 'Giờ phải có dạng UTC ISO đầy đủ.');
  }
  return value;
}

export const isoNow = epochMs => new Date(epochMs).toISOString();
export const vietnamDate = epochMs => isoNow(epochMs + 7 * 3600000).slice(0, 10);
export const addDays = (date, days) => isoNow(Date.parse(`${parseDate(date)}T00:00:00.000Z`) + days * 86400000).slice(0, 10);

export function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 10 || password.length > 128) {
    fail(400, 'VALIDATION_ERROR', 'Mật khẩu cần từ 10 đến 128 ký tự.');
  }
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('hex')}$${key.toString('hex')}`;
}

export function verifyPassword(password, storedHash) {
  if (typeof password !== 'string' || password.length > 128 || typeof storedHash !== 'string') return false;
  const match = /^scrypt\$16384\$8\$1\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(storedHash);
  if (!match) return false;
  const actual = scryptSync(password, Buffer.from(match[1], 'hex'), 64, { N: 16384, r: 8, p: 1 });
  return timingSafeEqual(actual, Buffer.from(match[2], 'hex'));
}

export function publicUser(db, row) {
  const member = row.role === 'member' ? db.prepare('SELECT id FROM members WHERE user_id = ?').get(row.id) : null;
  return { id: row.id, login: row.login, fullName: row.full_name, role: row.role, memberId: member?.id ?? null };
}

export function membershipView(db, row, nowMs) {
  const { full_name: memberName } = db.prepare('SELECT u.full_name FROM members m JOIN users u ON u.id=m.user_id WHERE m.id=?').get(row.member_id);
  const { total: paidVnd } = db.prepare('SELECT COALESCE(SUM(amount_vnd),0) total FROM payments WHERE membership_id=?').get(row.id);
  if (!Number.isSafeInteger(paidVnd)) throw new Error('Unsafe money aggregate');
  const today = vietnamDate(nowMs);
  return {
    id: row.id, memberId: row.member_id, memberName, packageId: row.package_id, packageName: row.package_name,
    durationDays: row.duration_days, priceVnd: row.price_vnd, startDate: row.start_date, endDate: row.end_date,
    paidVnd, balanceVnd: row.price_vnd - paidVnd,
    status: today < row.start_date ? 'upcoming' : today > row.end_date ? 'expired' : 'active',
    createdBy: row.created_by, createdAt: row.created_at,
  };
}

export function sessionView(db, row) {
  const names = db.prepare(`SELECT u.full_name memberName, p.full_name ptName FROM members m
    JOIN users u ON u.id=m.user_id JOIN users p ON p.id=? WHERE m.id=?`).get(row.pt_id, row.member_id);
  return {
    id: row.id, memberId: row.member_id, memberName: names.memberName, ptId: row.pt_id, ptName: names.ptName,
    startsAt: row.starts_at, endsAt: row.ends_at, status: row.status, note: row.note,
    createdBy: row.created_by, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, login TEXT NOT NULL COLLATE NOCASE UNIQUE,
  full_name TEXT NOT NULL CHECK(length(full_name) BETWEEN 1 AND 100),
  role TEXT NOT NULL CHECK(role IN ('owner','staff','pt','member')),
  password_hash TEXT NOT NULL, created_at TEXT NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  phone TEXT NOT NULL, email TEXT, created_at TEXT NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS packages (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
  duration_days INTEGER NOT NULL CHECK(duration_days BETWEEN 1 AND 366),
  price_vnd INTEGER NOT NULL CHECK(price_vnd BETWEEN 0 AND 1000000000),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)), created_at TEXT NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS memberships (
  id INTEGER PRIMARY KEY, member_id INTEGER NOT NULL REFERENCES members(id),
  package_id INTEGER NOT NULL REFERENCES packages(id), package_name TEXT NOT NULL,
  duration_days INTEGER NOT NULL CHECK(duration_days BETWEEN 1 AND 366),
  price_vnd INTEGER NOT NULL CHECK(price_vnd BETWEEN 0 AND 1000000000),
  start_date TEXT NOT NULL, end_date TEXT NOT NULL CHECK(end_date >= start_date),
  created_by INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS idx_memberships_member_dates ON memberships(member_id,start_date,end_date);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY, membership_id INTEGER NOT NULL REFERENCES memberships(id),
  amount_vnd INTEGER NOT NULL CHECK(amount_vnd BETWEEN 1 AND 1000000000),
  method TEXT NOT NULL CHECK(method IN ('cash','bank_transfer')),
  note TEXT NOT NULL DEFAULT '' CHECK(length(note) <= 500), request_id TEXT NOT NULL UNIQUE,
  recorded_by INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS idx_payments_membership ON payments(membership_id);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at);
CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY, member_id INTEGER NOT NULL REFERENCES members(id), date TEXT NOT NULL,
  checked_in_at TEXT NOT NULL, checked_in_by INTEGER NOT NULL REFERENCES users(id), UNIQUE(member_id,date)
) STRICT;
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE TABLE IF NOT EXISTS pt_sessions (
  id INTEGER PRIMARY KEY, member_id INTEGER NOT NULL REFERENCES members(id), pt_id INTEGER NOT NULL REFERENCES users(id),
  starts_at TEXT NOT NULL, ends_at TEXT NOT NULL CHECK(ends_at > starts_at),
  status TEXT NOT NULL DEFAULT 'booked' CHECK(status IN ('booked','completed','cancelled')),
  note TEXT NOT NULL DEFAULT '' CHECK(length(note) <= 500), created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS idx_pt_sessions_pt_time ON pt_sessions(pt_id,starts_at,ends_at);
CREATE INDEX IF NOT EXISTS idx_pt_sessions_member_time ON pt_sessions(member_id,starts_at,ends_at);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), csrf_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL, created_at TEXT NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
`;

export function createDatabase({ filename = 'data/gym.sqlite', seed = false, now = Date.now } = {}) {
  if (filename !== ':memory:') mkdirSync(dirname(resolve(filename)), { recursive: true });
  const db = new DatabaseSync(filename);
  try {
    db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
    db.exec(SCHEMA);
    if (seed) transaction(db, () => {
      if (db.prepare('SELECT COUNT(*) count FROM users').get().count) return;
      const epoch = now();
      const stamp = isoNow(epoch);
      const today = vietnamDate(epoch);
      const insertUser = db.prepare('INSERT INTO users(id,login,full_name,role,password_hash,created_at) VALUES(?,?,?,?,?,?)');
      for (const [id, login, fullName] of [[1, 'owner', 'Nguyễn Minh Anh'], [2, 'staff', 'Trần Thu Hà'], [3, 'pt', 'Lê Hoàng Nam'], [4, 'member', 'Phạm Ngọc Linh']]) {
        insertUser.run(id, login, fullName, login, hashPassword('Gym@2026Demo!'), stamp);
      }
      db.prepare('INSERT INTO members(id,user_id,phone,email,created_at) VALUES(1,4,?,?,?)').run('0901234567', 'linh@example.test', stamp);
      db.prepare('INSERT INTO packages(id,name,duration_days,price_vnd,created_at) VALUES(1,?,30,300000,?),(2,?,90,800000,?)')
        .run('Cơ bản 30 ngày', stamp, 'Tiết kiệm 90 ngày', stamp);
      db.prepare(`INSERT INTO memberships(id,member_id,package_id,package_name,duration_days,price_vnd,start_date,end_date,created_by,created_at)
        VALUES(1,1,1,?,30,300000,?,?,1,?)`).run('Cơ bản 30 ngày', addDays(today, -10), addDays(today, 19), stamp);
      db.prepare(`INSERT INTO payments(id,membership_id,amount_vnd,method,note,request_id,recorded_by,created_at)
        VALUES(1,1,150000,'cash','','00000000-0000-4000-8000-000000000001',1,?)`).run(stamp);
      db.prepare('INSERT INTO attendance(id,member_id,date,checked_in_at,checked_in_by) VALUES(1,1,?,?,2)').run(today, stamp);
      const tomorrow = addDays(today, 1);
      db.prepare(`INSERT INTO pt_sessions(id,member_id,pt_id,starts_at,ends_at,created_by,created_at,updated_at)
        VALUES(1,1,3,?,?,1,?,?)`).run(`${tomorrow}T02:00:00.000Z`, `${tomorrow}T03:00:00.000Z`, stamp, stamp);
    });
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
