// Quản lý API Client và xử lý dữ liệu cho ứng dụng Phòng tập Gym
// Tuân thủ nghiêm ngặt hợp đồng tại docs/API.md và docs/PLAN.md
// Hỗ trợ chế độ Demo Client-side khi triển khai trên GitHub Pages (VITE_DEMO_MODE=true)

import { demoStore } from './demoStore.js';
export * from './dateUtils.js';

let inMemoryCsrfToken = '';

export function getCsrfToken() {
  return inMemoryCsrfToken;
}

export function setCsrfToken(token) {
  inMemoryCsrfToken = token || '';
}

export class ApiError extends Error {
  constructor(status, code, message, fields = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

// Kiểm tra xem có đang chạy trong môi trường demo tĩnh (GitHub Pages) hay không
function isDemoEnvironment() {
  if (import.meta.env.VITE_DEMO_MODE === 'true') return true;
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('github.io')) return true;
  return false;
}

// Hàm gửi request chuẩn tới server backend cục bộ
async function request(endpoint, options = {}) {
  const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const headers = {
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  const method = (options.method || 'GET').toUpperCase();

  // Đính kèm CSRF token cho các mutation (POST, PATCH, DELETE)
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    if (inMemoryCsrfToken) {
      headers['X-CSRF-Token'] = inMemoryCsrfToken;
    }
    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }
  }

  const fetchOptions = {
    ...options,
    method,
    headers,
    credentials: 'same-origin',
  };

  let response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (err) {
    throw new ApiError(0, 'NETWORK_ERROR', 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra dịch vụ backend.');
  }

  let json = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      json = await response.json();
    } catch {
      // bỏ qua lỗi parse json
    }
  }

  if (!response.ok) {
    if (json && json.error) {
      throw new ApiError(
        response.status,
        json.error.code || 'UNKNOWN_ERROR',
        json.error.message || 'Đã có lỗi xảy ra từ máy chủ.',
        json.error.fields || null
      );
    }
    throw new ApiError(
      response.status,
      `HTTP_${response.status}`,
      `Yêu cầu thất bại với mã trạng thái ${response.status}.`
    );
  }

  return json ? json.data : null;
}

// === API CLIENT VỚI FALLBACK DEMO CHO GITHUB PAGES ===
export const api = {
  auth: {
    async login({ login, password }) {
      if (isDemoEnvironment()) {
        const data = demoStore.login({ login, password });
        setCsrfToken(data.csrfToken);
        return data;
      }
      try {
        const data = await request('/api/auth/login', {
          method: 'POST',
          body: { login, password },
        });
        if (data && data.csrfToken) {
          setCsrfToken(data.csrfToken);
        }
        return data;
      } catch (err) {
        if (err.code === 'NETWORK_ERROR') {
          const data = demoStore.login({ login, password });
          setCsrfToken(data.csrfToken);
          return data;
        }
        throw err;
      }
    },

    async me() {
      if (isDemoEnvironment()) {
        const data = demoStore.me();
        setCsrfToken(data.csrfToken);
        return data;
      }
      try {
        const data = await request('/api/auth/me');
        if (data && data.csrfToken) {
          setCsrfToken(data.csrfToken);
        }
        return data;
      } catch (err) {
        if (err.code === 'NETWORK_ERROR') {
          const data = demoStore.me();
          setCsrfToken(data.csrfToken);
          return data;
        }
        throw err;
      }
    },

    async logout() {
      if (isDemoEnvironment()) {
        demoStore.logout();
        setCsrfToken('');
        return;
      }
      try {
        await request('/api/auth/logout', {
          method: 'POST',
          body: {},
        });
      } finally {
        demoStore.logout();
        setCsrfToken('');
      }
    },

    async changePassword({ currentPassword, newPassword }) {
      if (isDemoEnvironment()) {
        demoStore.changePassword();
        setCsrfToken('');
        return null;
      }
      const data = await request('/api/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      });
      setCsrfToken('');
      return data;
    },
  },

  // === MEMBERS ===
  members: {
    async list(q = '') {
      if (isDemoEnvironment()) return demoStore.getMembers(q);
      try {
        const query = q ? `?q=${encodeURIComponent(q.trim())}` : '';
        return await request(`/api/members${query}`);
      } catch (err) {
        if (err.code === 'NETWORK_ERROR') return demoStore.getMembers(q);
        throw err;
      }
    },

    async get(id) {
      if (isDemoEnvironment()) return demoStore.getMembers().find((m) => m.id === Number(id));
      return request(`/api/members/${id}`);
    },

    async create({ login, initialPassword, fullName, phone, email }) {
      if (isDemoEnvironment()) return demoStore.createMember({ login, fullName, phone, email });
      const body = { login, initialPassword, fullName, phone };
      if (email !== undefined && email !== '') {
        body.email = email;
      }
      return request('/api/members', {
        method: 'POST',
        body,
      });
    },

    async update(id, { fullName, phone, email }) {
      if (isDemoEnvironment()) return demoStore.updateMember(id, { fullName, phone, email });
      const body = {};
      if (fullName !== undefined) body.fullName = fullName;
      if (phone !== undefined) body.phone = phone;
      if (email !== undefined) body.email = email === '' ? null : email;
      return request(`/api/members/${id}`, {
        method: 'PATCH',
        body,
      });
    },
  },

  // === PACKAGES ===
  packages: {
    async list() {
      if (isDemoEnvironment()) return demoStore.getPackages();
      try {
        return await request('/api/packages');
      } catch (err) {
        if (err.code === 'NETWORK_ERROR') return demoStore.getPackages();
        throw err;
      }
    },

    async create({ name, durationDays, priceVnd }) {
      if (isDemoEnvironment()) return demoStore.createPackage({ name, durationDays, priceVnd });
      return request('/api/packages', {
        method: 'POST',
        body: {
          name: name.trim(),
          durationDays: Number(durationDays),
          priceVnd: Number(priceVnd),
        },
      });
    },

    async update(id, updates) {
      if (isDemoEnvironment()) return demoStore.updatePackage(id, updates);
      const body = {};
      if (updates.name !== undefined) body.name = updates.name.trim();
      if (updates.durationDays !== undefined) body.durationDays = Number(updates.durationDays);
      if (updates.priceVnd !== undefined) body.priceVnd = Number(updates.priceVnd);
      if (updates.isActive !== undefined) body.isActive = Boolean(updates.isActive);

      return request(`/api/packages/${id}`, {
        method: 'PATCH',
        body,
      });
    },
  },

  // === MEMBERSHIPS ===
  memberships: {
    async list(memberId = null) {
      if (isDemoEnvironment()) return demoStore.getMemberships(memberId);
      try {
        const query = memberId ? `?memberId=${encodeURIComponent(memberId)}` : '';
        return await request(`/api/memberships${query}`);
      } catch (err) {
        if (err.code === 'NETWORK_ERROR') return demoStore.getMemberships(memberId);
        throw err;
      }
    },

    async create({ memberId, packageId, startDate }) {
      if (isDemoEnvironment()) return demoStore.createMembership({ memberId, packageId, startDate });
      return request('/api/memberships', {
        method: 'POST',
        body: {
          memberId: Number(memberId),
          packageId: Number(packageId),
          startDate,
        },
      });
    },
  },

  // === PAYMENTS ===
  payments: {
    async list(params = {}) {
      if (isDemoEnvironment()) return demoStore.getPayments(params);
      try {
        const sp = new URLSearchParams();
        if (params.memberId) sp.set('memberId', params.memberId);
        if (params.membershipId) sp.set('membershipId', params.membershipId);
        const query = sp.toString() ? `?${sp.toString()}` : '';
        return await request(`/api/payments${query}`);
      } catch (err) {
        if (err.code === 'NETWORK_ERROR') return demoStore.getPayments(params);
        throw err;
      }
    },

    async create({ membershipId, amountVnd, method, requestId, note }) {
      if (isDemoEnvironment()) return demoStore.createPayment({ membershipId, amountVnd, method, note });
      const body = {
        membershipId: Number(membershipId),
        amountVnd: Number(amountVnd),
        method,
        requestId: requestId || crypto.randomUUID(),
      };
      if (note !== undefined && note !== '') {
        body.note = note.trim();
      }
      return request('/api/payments', {
        method: 'POST',
        body,
      });
    },
  },

  // === ATTENDANCE ===
  attendance: {
    async list(params = {}) {
      if (isDemoEnvironment()) return demoStore.getAttendance(params);
      try {
        const sp = new URLSearchParams();
        if (params.memberId) sp.set('memberId', params.memberId);
        if (params.from) sp.set('from', params.from);
        if (params.to) sp.set('to', params.to);
        const query = sp.toString() ? `?${sp.toString()}` : '';
        return await request(`/api/attendance${query}`);
      } catch (err) {
        if (err.code === 'NETWORK_ERROR') return demoStore.getAttendance(params);
        throw err;
      }
    },

    async checkIn({ memberId }) {
      if (isDemoEnvironment()) return demoStore.checkIn({ memberId });
      return request('/api/attendance', {
        method: 'POST',
        body: {
          memberId: Number(memberId),
        },
      });
    },
  },

  // === TRAINERS & PT SESSIONS ===
  trainers: {
    async list() {
      if (isDemoEnvironment()) return demoStore.getTrainers();
      try {
        return await request('/api/trainers');
      } catch (err) {
        if (err.code === 'NETWORK_ERROR') return demoStore.getTrainers();
        throw err;
      }
    },
  },

  sessions: {
    async list(params = {}) {
      if (isDemoEnvironment()) return demoStore.getSessions(params);
      try {
        const sp = new URLSearchParams();
        if (params.memberId) sp.set('memberId', params.memberId);
        if (params.ptId) sp.set('ptId', params.ptId);
        if (params.from) sp.set('from', params.from);
        if (params.to) sp.set('to', params.to);
        const query = sp.toString() ? `?${sp.toString()}` : '';
        return await request(`/api/sessions${query}`);
      } catch (err) {
        if (err.code === 'NETWORK_ERROR') return demoStore.getSessions(params);
        throw err;
      }
    },

    async create({ memberId, ptId, startsAt, endsAt, note }) {
      if (isDemoEnvironment()) return demoStore.createSession({ memberId, ptId, startsAt, endsAt, note });
      const body = {
        memberId: Number(memberId),
        ptId: Number(ptId),
        startsAt,
        endsAt,
      };
      if (note !== undefined && note !== '') {
        body.note = note.trim();
      }
      return request('/api/sessions', {
        method: 'POST',
        body,
      });
    },

    async updateStatus(id, status) {
      if (isDemoEnvironment()) return demoStore.updateSessionStatus(id, status);
      return request(`/api/sessions/${id}`, {
        method: 'PATCH',
        body: { status },
      });
    },
  },

  // === DASHBOARD ===
  dashboard: {
    async get() {
      if (isDemoEnvironment()) return demoStore.getDashboard();
      try {
        return await request('/api/dashboard');
      } catch (err) {
        if (err.code === 'NETWORK_ERROR') return demoStore.getDashboard();
        throw err;
      }
    },
  },
};
