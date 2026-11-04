import React, { useState } from 'react';
import { api } from '../api.js';
import { IconDumbbell, IconLock, IconUser, IconAlertCircle } from '../icons.jsx';
import { AlertBanner, InlineError } from '../components/Feedback.jsx';

export function LoginView({ onLoginSuccess }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const seedAccounts = [
    { role: 'Chủ phòng (Owner)', username: 'owner', desc: 'Nguyễn Minh Anh' },
    { role: 'Lễ tân (Staff)', username: 'staff', desc: 'Trần Thu Hà' },
    { role: 'Huấn luyện viên (PT)', username: 'pt', desc: 'Lê Hoàng Nam' },
    { role: 'Hội viên (Member)', username: 'member', desc: 'Phạm Ngọc Linh' },
  ];

  const handleSelectSeed = (username) => {
    setLogin(username);
    setPassword('Gym@2026Demo!');
    setErrorMsg('');
    setFieldErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!login.trim()) {
      setFieldErrors({ login: 'Vui lòng nhập tên đăng nhập' });
      return;
    }
    if (!password) {
      setFieldErrors({ password: 'Vui lòng nhập mật khẩu' });
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setFieldErrors({});

    try {
      const data = await api.auth.login({
        login: login.trim(),
        password,
      });
      if (data && data.user) {
        onLoginSuccess(data.user);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Đăng nhập thất bại.');
      if (err.fields) {
        setFieldErrors(err.fields);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-wrap">
      <div className="login-card">
        <div className="login-brand-header">
          <div className="login-brand-logo">
            <IconDumbbell size={28} />
          </div>
          <h2 className="login-brand-title">HỆ THỐNG PHÒNG TẬP GYM</h2>
          <p className="login-brand-desc">Đăng nhập để truy cập trang quản lý & tập luyện</p>
        </div>

        {/* Khối tài khoản mẫu Demo */}
        <div className="seed-accounts-box">
          <div className="seed-accounts-title">
            <span>Tài khoản Demo có sẵn (Chọn nhanh):</span>
          </div>
          <div className="seed-buttons-grid">
            {seedAccounts.map((seed) => (
              <button
                key={seed.username}
                type="button"
                className="btn-seed"
                onClick={() => handleSelectSeed(seed.username)}
              >
                <span className="btn-seed-role">{seed.role}</span>
                <span className="btn-seed-login">{seed.desc} ({seed.username})</span>
              </button>
            ))}
          </div>
        </div>

        {errorMsg && <AlertBanner type="danger" message={errorMsg} />}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="login-input">
              Tên đăng nhập <span className="required">*</span>
            </label>
            <input
              id="login-input"
              type="text"
              className={`form-input ${fieldErrors.login ? 'is-invalid' : ''}`}
              placeholder="VD: owner, staff, pt, member..."
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              disabled={loading}
              autoComplete="username"
              autoFocus
            />
            {fieldErrors.login && <InlineError message={fieldErrors.login} />}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password-input">
              Mật khẩu <span className="required">*</span>
            </label>
            <input
              id="password-input"
              type="password"
              className={`form-input ${fieldErrors.password ? 'is-invalid' : ''}`}
              placeholder="Nhập mật khẩu..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="current-password"
            />
            {fieldErrors.password && <InlineError message={fieldErrors.password} />}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '8px' }}
            disabled={loading}
          >
            {loading ? 'Đang xác thực...' : 'Đăng Nhập'}
          </button>
        </form>
      </div>
    </div>
  );
}
