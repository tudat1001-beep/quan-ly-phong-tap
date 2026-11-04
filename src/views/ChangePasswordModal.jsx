import React, { useState } from 'react';
import { api } from '../api.js';
import { Modal } from '../components/Modal.jsx';
import { AlertBanner, InlineError } from '../components/Feedback.jsx';

export function ChangePasswordModal({ isOpen, onClose, onPasswordChanged }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setFieldErrors({});

    const errs = {};
    if (!currentPassword) {
      errs.currentPassword = 'Vui lòng nhập mật khẩu hiện tại';
    }
    if (!newPassword || newPassword.length < 10) {
      errs.newPassword = 'Mật khẩu mới phải có ít nhất 10 ký tự';
    }
    if (newPassword !== confirmPassword) {
      errs.confirmPassword = 'Mật khẩu xác nhận không khớp';
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setLoading(true);
    try {
      await api.auth.changePassword({
        currentPassword,
        newPassword,
      });

      alert('Đổi mật khẩu thành công! Tất cả các phiên đã bị thu hồi. Vui lòng đăng nhập lại.');
      onClose();
      onPasswordChanged();
    } catch (err) {
      setErrorMsg(err.message || 'Không thể đổi mật khẩu.');
      if (err.fields) {
        setFieldErrors(err.fields);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Đổi Mật Khẩu Tài Khoản"
      footer={(
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Đang cập nhật...' : 'Xác Nhận Đổi MK'}
          </button>
        </>
      )}
    >
      <form onSubmit={handleSubmit}>
        {errorMsg && <AlertBanner type="danger" message={errorMsg} />}

        <div className="form-group">
          <label className="form-label" htmlFor="cur-pass">
            Mật khẩu hiện tại <span className="required">*</span>
          </label>
          <input
            id="cur-pass"
            type="password"
            className={`form-input ${fieldErrors.currentPassword ? 'is-invalid' : ''}`}
            placeholder="Nhập mật khẩu hiện tại..."
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={loading}
            autoFocus
          />
          {fieldErrors.currentPassword && <InlineError message={fieldErrors.currentPassword} />}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="new-pass">
            Mật khẩu mới (tối thiểu 10 ký tự) <span className="required">*</span>
          </label>
          <input
            id="new-pass"
            type="password"
            className={`form-input ${fieldErrors.newPassword ? 'is-invalid' : ''}`}
            placeholder="Nhập mật khẩu mới..."
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={loading}
          />
          {fieldErrors.newPassword && <InlineError message={fieldErrors.newPassword} />}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="confirm-pass">
            Xác nhận mật khẩu mới <span className="required">*</span>
          </label>
          <input
            id="confirm-pass"
            type="password"
            className={`form-input ${fieldErrors.confirmPassword ? 'is-invalid' : ''}`}
            placeholder="Nhập lại mật khẩu mới..."
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
          />
          {fieldErrors.confirmPassword && <InlineError message={fieldErrors.confirmPassword} />}
        </div>

        <div className="form-help-text">
          Lưu ý: Sau khi đổi mật khẩu thành công, toàn bộ phiên đăng nhập hiện tại sẽ kết thúc và bạn cần đăng nhập lại với mật khẩu mới.
        </div>
      </form>
    </Modal>
  );
}
