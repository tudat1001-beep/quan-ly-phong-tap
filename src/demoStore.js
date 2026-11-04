// Client-side Demo Store cho môi trường tĩnh (GitHub Pages)
// Cho phép trải nghiệm đầy đủ 4 vai trò mà không cần máy chủ SQLite cục bộ.

import { formatVnd, getVietnamTodayDateString, vnDateTimeToUtcIso, addDaysToDateString } from './dateUtils.js';

const STORAGE_KEY = 'gym_master_demo_data_v1';
const SESSION_KEY = 'gym_master_demo_session_user';

function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getRelativeDateString(daysOffset) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function initInitialData() {
  const today = getTodayString();
  const start1 = getRelativeDateString(-10);
  const end1 = getRelativeDateString(19);

  const start2 = getRelativeDateString(-5);
  const end2 = getRelativeDateString(84);

  return {
    users: [
      { id: 1, login: 'owner', fullName: 'Nguyễn Minh Anh', role: 'owner', memberId: null },
      { id: 2, login: 'staff', fullName: 'Trần Thu Hà', role: 'staff', memberId: null },
      { id: 3, login: 'pt', fullName: 'Lê Hoàng Nam', role: 'pt', memberId: null },
      { id: 4, login: 'member', fullName: 'Phạm Ngọc Linh', role: 'member', memberId: 1 },
    ],
    members: [
      { id: 1, userId: 4, login: 'member', fullName: 'Phạm Ngọc Linh', phone: '0901234567', email: 'linh@example.test', createdAt: `${today}T08:00:00.000Z` },
      { id: 2, userId: 5, login: 'hoanganh', fullName: 'Hoàng Văn Anh', phone: '0912345678', email: 'anh@example.test', createdAt: `${today}T08:30:00.000Z` },
      { id: 3, userId: 6, login: 'maiphuong', fullName: 'Trần Mai Phương', phone: '0987654321', email: null, createdAt: `${today}T09:00:00.000Z` },
    ],
    packages: [
      { id: 1, name: 'Cơ bản 30 ngày', durationDays: 30, priceVnd: 300000, isActive: true, createdAt: `${today}T00:00:00.000Z` },
      { id: 2, name: 'Tiết kiệm 90 ngày', durationDays: 90, priceVnd: 800000, isActive: true, createdAt: `${today}T00:00:00.000Z` },
      { id: 3, name: 'VIP 180 ngày', durationDays: 180, priceVnd: 1500000, isActive: true, createdAt: `${today}T00:00:00.000Z` },
    ],
    memberships: [
      {
        id: 1,
        memberId: 1,
        memberName: 'Phạm Ngọc Linh',
        packageId: 1,
        packageName: 'Cơ bản 30 ngày',
        durationDays: 30,
        priceVnd: 300000,
        paidVnd: 150000,
        balanceVnd: 150000,
        startDate: start1,
        endDate: end1,
        status: 'active',
        createdBy: 1,
        createdAt: `${start1}T08:00:00.000Z`,
      },
      {
        id: 2,
        memberId: 2,
        memberName: 'Hoàng Văn Anh',
        packageId: 2,
        packageName: 'Tiết kiệm 90 ngày',
        durationDays: 90,
        priceVnd: 800000,
        paidVnd: 800000,
        balanceVnd: 0,
        startDate: start2,
        endDate: end2,
        status: 'active',
        createdBy: 2,
        createdAt: `${start2}T09:00:00.000Z`,
      },
    ],
    payments: [
      {
        id: 1,
        membershipId: 1,
        memberId: 1,
        memberName: 'Phạm Ngọc Linh',
        amountVnd: 150000,
        method: 'cash',
        note: 'Đóng cọc đợt 1',
        requestId: '00000000-0000-4000-8000-000000000001',
        recordedBy: 1,
        createdAt: `${start1}T08:15:00.000Z`,
      },
      {
        id: 2,
        membershipId: 2,
        memberId: 2,
        memberName: 'Hoàng Văn Anh',
        amountVnd: 800000,
        method: 'bank_transfer',
        note: 'Chuyển khoản VietQR',
        requestId: '00000000-0000-4000-8000-000000000002',
        recordedBy: 2,
        createdAt: `${start2}T09:15:00.000Z`,
      },
    ],
    attendance: [
      {
        id: 1,
        memberId: 1,
        memberName: 'Phạm Ngọc Linh',
        date: today,
        checkedInAt: `${today}T08:15:00.000Z`,
        checkedInBy: 2,
      },
    ],
    trainers: [
      { id: 3, fullName: 'Lê Hoàng Nam' },
    ],
    sessions: [
      {
        id: 1,
        memberId: 1,
        memberName: 'Phạm Ngọc Linh',
        ptId: 3,
        ptName: 'Lê Hoàng Nam',
        startsAt: `${getRelativeDateString(1)}T02:00:00.000Z`,
        endsAt: `${getRelativeDateString(1)}T03:00:00.000Z`,
        status: 'booked',
        note: 'Tập ngực & vai cơ bản',
        createdBy: 1,
        createdAt: `${today}T08:00:00.000Z`,
        updatedAt: `${today}T08:00:00.000Z`,
      },
    ],
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  const init = initInitialData();
  saveState(init);
  return init;
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export const demoStore = {
  getCurrentUser() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  setCurrentUser(user) {
    if (user) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  },

  login({ login, password }) {
    const state = loadState();
    const cleanLogin = String(login).trim().toLowerCase();
    const user = state.users.find((u) => u.login === cleanLogin);
    if (!user || password !== 'Gym@2026Demo!') {
      const err = new Error('Tên đăng nhập hoặc mật khẩu không chính xác.');
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }
    this.setCurrentUser(user);
    return { user, csrfToken: 'demo-csrf-token' };
  },

  logout() {
    this.setCurrentUser(null);
  },

  me() {
    const user = this.getCurrentUser();
    if (!user) {
      const err = new Error('Phiên đăng nhập đã hết hạn.');
      err.code = 'AUTH_REQUIRED';
      throw err;
    }
    return { user, csrfToken: 'demo-csrf-token' };
  },

  changePassword() {
    this.setCurrentUser(null);
    return null;
  },

  // Members
  getMembers(q = '') {
    const state = loadState();
    if (!q) return state.members;
    const cleanQ = q.toLowerCase();
    return state.members.filter(
      (m) =>
        m.fullName.toLowerCase().includes(cleanQ) ||
        m.phone.includes(cleanQ) ||
        m.login.toLowerCase().includes(cleanQ) ||
        (m.email && m.email.toLowerCase().includes(cleanQ))
    );
  },

  createMember({ login, fullName, phone, email }) {
    const state = loadState();
    const cleanLogin = login.trim().toLowerCase();
    if (state.users.some((u) => u.login === cleanLogin)) {
      const err = new Error('Tên đăng nhập đã tồn tại trong hệ thống.');
      err.code = 'DUPLICATE_LOGIN';
      err.fields = { login: 'Tên đăng nhập đã tồn tại' };
      throw err;
    }
    const newUserId = state.users.length + 1;
    const newMemberId = state.members.length + 1;

    const newUser = { id: newUserId, login: cleanLogin, fullName: fullName.trim(), role: 'member', memberId: newMemberId };
    state.users.push(newUser);

    const newMember = {
      id: newMemberId,
      userId: newUserId,
      login: cleanLogin,
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email ? email.trim() : null,
      createdAt: new Date().toISOString(),
    };
    state.members.unshift(newMember);
    saveState(state);
    return newMember;
  },

  updateMember(id, updates) {
    const state = loadState();
    const m = state.members.find((item) => item.id === Number(id));
    if (!m) {
      const err = new Error('Không tìm thấy hội viên.');
      err.code = 'NOT_FOUND';
      throw err;
    }
    if (updates.fullName !== undefined) m.fullName = updates.fullName.trim();
    if (updates.phone !== undefined) m.phone = updates.phone.trim();
    if (updates.email !== undefined) m.email = updates.email ? updates.email.trim() : null;
    saveState(state);
    return m;
  },

  // Packages
  getPackages() {
    const state = loadState();
    const user = this.getCurrentUser();
    if (user && (user.role === 'pt' || user.role === 'member')) {
      return state.packages.filter((p) => p.isActive);
    }
    return state.packages;
  },

  createPackage({ name, durationDays, priceVnd }) {
    const state = loadState();
    const newPkg = {
      id: state.packages.length + 1,
      name: name.trim(),
      durationDays: Number(durationDays),
      priceVnd: Number(priceVnd),
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    state.packages.push(newPkg);
    saveState(state);
    return newPkg;
  },

  updatePackage(id, updates) {
    const state = loadState();
    const p = state.packages.find((item) => item.id === Number(id));
    if (!p) {
      const err = new Error('Không tìm thấy gói tập.');
      err.code = 'NOT_FOUND';
      throw err;
    }
    if (updates.name !== undefined) p.name = updates.name.trim();
    if (updates.durationDays !== undefined) p.durationDays = Number(updates.durationDays);
    if (updates.priceVnd !== undefined) p.priceVnd = Number(updates.priceVnd);
    if (updates.isActive !== undefined) p.isActive = Boolean(updates.isActive);
    saveState(state);
    return p;
  },

  // Memberships
  getMemberships(memberId = null) {
    const state = loadState();
    const user = this.getCurrentUser();
    let list = state.memberships;
    if (user && user.role === 'member') {
      list = list.filter((m) => m.memberId === user.memberId);
    } else if (memberId) {
      list = list.filter((m) => m.memberId === Number(memberId));
    }
    return list;
  },

  createMembership({ memberId, packageId, startDate }) {
    const state = loadState();
    const member = state.members.find((m) => m.id === Number(memberId));
    const pkg = state.packages.find((p) => p.id === Number(packageId));
    if (!member || !pkg) {
      const err = new Error('Hội viên hoặc gói tập không tồn tại.');
      err.code = 'VALIDATION_ERROR';
      throw err;
    }
    const endDate = addDaysToDateString(startDate, pkg.durationDays - 1);
    const newM = {
      id: state.memberships.length + 1,
      memberId: member.id,
      memberName: member.fullName,
      packageId: pkg.id,
      packageName: pkg.name,
      durationDays: pkg.durationDays,
      priceVnd: pkg.priceVnd,
      paidVnd: 0,
      balanceVnd: pkg.priceVnd,
      startDate,
      endDate,
      status: 'active',
      createdBy: 1,
      createdAt: new Date().toISOString(),
    };
    state.memberships.unshift(newM);
    saveState(state);
    return newM;
  },

  // Payments
  getPayments(params = {}) {
    const state = loadState();
    const user = this.getCurrentUser();
    let list = state.payments;
    if (user && user.role === 'member') {
      list = list.filter((p) => p.memberId === user.memberId);
    } else {
      if (params.memberId) list = list.filter((p) => p.memberId === Number(params.memberId));
      if (params.membershipId) list = list.filter((p) => p.membershipId === Number(params.membershipId));
    }
    return list;
  },

  createPayment({ membershipId, amountVnd, method, note }) {
    const state = loadState();
    const m = state.memberships.find((item) => item.id === Number(membershipId));
    if (!m) {
      const err = new Error('Không tìm thấy thẻ hội viên.');
      err.code = 'NOT_FOUND';
      throw err;
    }
    const amt = Number(amountVnd);
    if (amt > m.balanceVnd) {
      const err = new Error('Số tiền thu không được vượt quá số nợ còn lại.');
      err.code = 'OVERPAYMENT';
      throw err;
    }
    m.paidVnd += amt;
    m.balanceVnd -= amt;

    const newPayment = {
      id: state.payments.length + 1,
      membershipId: m.id,
      memberId: m.memberId,
      memberName: m.memberName,
      amountVnd: amt,
      method,
      note: note || '',
      requestId: crypto.randomUUID(),
      recordedBy: 1,
      createdAt: new Date().toISOString(),
    };
    state.payments.unshift(newPayment);
    saveState(state);
    return newPayment;
  },

  // Attendance
  getAttendance(params = {}) {
    const state = loadState();
    const user = this.getCurrentUser();
    let list = state.attendance;
    if (user && user.role === 'member') {
      list = list.filter((a) => a.memberId === user.memberId);
    } else if (params.memberId) {
      list = list.filter((a) => a.memberId === Number(params.memberId));
    }
    return list;
  },

  checkIn({ memberId }) {
    const state = loadState();
    const today = getTodayString();
    const member = state.members.find((m) => m.id === Number(memberId));
    if (!member) {
      const err = new Error('Không tìm thấy hội viên.');
      err.code = 'NOT_FOUND';
      throw err;
    }
    // Kiểm tra đã check-in hôm nay
    const existing = state.attendance.find((a) => a.memberId === member.id && a.date === today);
    if (existing) {
      return existing;
    }
    // Kiểm tra thẻ
    const activeMem = state.memberships.find(
      (m) => m.memberId === member.id && m.startDate <= today && m.endDate >= today
    );
    if (!activeMem) {
      const err = new Error('Hội viên không có thẻ bao phủ ngày hôm nay.');
      err.code = 'NO_ACTIVE_MEMBERSHIP';
      throw err;
    }

    const newAtt = {
      id: state.attendance.length + 1,
      memberId: member.id,
      memberName: member.fullName,
      date: today,
      checkedInAt: new Date().toISOString(),
      checkedInBy: 1,
    };
    state.attendance.unshift(newAtt);
    saveState(state);
    return newAtt;
  },

  // Trainers & Sessions
  getTrainers() {
    const state = loadState();
    return state.trainers;
  },

  getSessions(params = {}) {
    const state = loadState();
    const user = this.getCurrentUser();
    let list = state.sessions;
    if (user && user.role === 'member') {
      list = list.filter((s) => s.memberId === user.memberId);
    } else if (user && user.role === 'pt') {
      list = list.filter((s) => s.ptId === user.id);
    } else {
      if (params.memberId) list = list.filter((s) => s.memberId === Number(params.memberId));
      if (params.ptId) list = list.filter((s) => s.ptId === Number(params.ptId));
    }
    return list;
  },

  createSession({ memberId, ptId, startsAt, endsAt, note }) {
    const state = loadState();
    const member = state.members.find((m) => m.id === Number(memberId));
    const pt = state.trainers.find((t) => t.id === Number(ptId));
    if (!member || !pt) {
      const err = new Error('Hội viên hoặc PT không tồn tại.');
      err.code = 'VALIDATION_ERROR';
      throw err;
    }
    const newSession = {
      id: state.sessions.length + 1,
      memberId: member.id,
      memberName: member.fullName,
      ptId: pt.id,
      ptName: pt.fullName,
      startsAt,
      endsAt,
      status: 'booked',
      note: note || '',
      createdBy: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.sessions.unshift(newSession);
    saveState(state);
    return newSession;
  },

  updateSessionStatus(id, status) {
    const state = loadState();
    const s = state.sessions.find((item) => item.id === Number(id));
    if (!s) {
      const err = new Error('Không tìm thấy buổi tập.');
      err.code = 'NOT_FOUND';
      throw err;
    }
    s.status = status;
    s.updatedAt = new Date().toISOString();
    saveState(state);
    return s;
  },

  // Dashboard
  getDashboard() {
    const state = loadState();
    const user = this.getCurrentUser();
    const today = getTodayString();

    if (user && user.role === 'pt') {
      const mySessions = state.sessions.filter((s) => s.ptId === user.id);
      return {
        role: 'pt',
        todaySessions: mySessions.filter((s) => s.startsAt.startsWith(today)).length,
        completedSessionsThisMonth: mySessions.filter((s) => s.status === 'completed').length,
        upcomingSessions: mySessions.filter((s) => s.status === 'booked').slice(0, 5),
      };
    }

    if (user && user.role === 'member') {
      const myMems = state.memberships.filter((m) => m.memberId === user.memberId);
      const activeMem = myMems.find((m) => m.startDate <= today && m.endDate >= today) || myMems[0] || null;
      const totalDebt = myMems.reduce((acc, m) => acc + (m.balanceVnd || 0), 0);
      const todayCheckedIn = state.attendance.some((a) => a.memberId === user.memberId && a.date === today);
      const mySessions = state.sessions.filter((s) => s.memberId === user.memberId && s.status === 'booked');

      return {
        role: 'member',
        membership: activeMem,
        todayCheckedIn,
        outstandingVnd: totalDebt,
        upcomingSessions: mySessions.slice(0, 5),
      };
    }

    // Owner / Staff
    const activeCount = state.memberships.filter((m) => m.startDate <= today && m.endDate >= today).length;
    const expiringSoon = state.memberships.filter((m) => {
      const end = m.endDate;
      const limit = getRelativeDateString(7);
      return m.startDate <= today && end >= today && end <= limit;
    }).length;

    const totalRevToday = state.payments
      .filter((p) => p.createdAt.startsWith(today))
      .reduce((acc, p) => acc + p.amountVnd, 0);

    const totalRevMonth = state.payments.reduce((acc, p) => acc + p.amountVnd, 0);
    const totalDebt = state.memberships.reduce((acc, m) => acc + (m.balanceVnd || 0), 0);
    const todayAttCount = state.attendance.filter((a) => a.date === today).length;
    const todaySessionsCount = state.sessions.filter((s) => s.startsAt.startsWith(today) && s.status !== 'cancelled').length;
    const upcoming = state.sessions.filter((s) => s.status === 'booked').slice(0, 5);

    return {
      role: user ? user.role : 'owner',
      totalMembers: state.members.length,
      activeMemberships: activeCount,
      expiringSoonCount: expiringSoon,
      todayCheckIns: todayAttCount,
      todaySessions: todaySessionsCount,
      outstandingVnd: totalDebt,
      revenueTodayVnd: totalRevToday,
      revenueMonthVnd: totalRevMonth,
      upcomingSessions: upcoming,
    };
  },
};
