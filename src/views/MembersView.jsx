import React, { useEffect, useState } from 'react';
import { api, formatDate } from '../api.js';
import { Modal } from '../components/Modal.jsx';
import { AlertBanner, EmptyState, InlineError, SkeletonRow } from '../components/Feedback.jsx';
import { IconUsers, IconPlus, IconSearch, IconEdit2, IconRefreshCw } from '../icons.jsx';

export function MembersView({ onOpenMembershipModal }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');

  // Trạng thái modal thêm mới
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    login: '',
    initialPassword: 'Gym@2026Demo!',
    fullName: '',
    phone: '',
    email: '',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createErrors, setCreateErrors] = useState({});

  // Trạng thái modal chỉnh sửa
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [editForm, setEditForm] = useState({
    fullName: '',
    phone: '',
    email: '',
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editErrors, setEditErrors] = useState({});

  // Thông báo phản hồi chung
  const [toast, setToast] = useState(null);

  const fetchMembers = async (q = '') => {
    setLoading(true);
    setError('');
    try {
      const data = await api.members.list(q);
      setMembers(data || []);
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách hội viên.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchMembers(searchQuery);
  };

  // Mở modal tạo mới
  const handleOpenCreate = () => {
    setCreateForm({
      login: '',
      initialPassword: 'Gym@2026Demo!',
      fullName: '',
      phone: '',
      email: '',
    });
    setCreateErrors({});
    setIsCreateOpen(true);
  };

  // Submit tạo mới
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateErrors({});

    // Client-side quick validation
    const errs = {};
    if (!createForm.login.trim()) errs.login = 'Vui lòng nhập tên đăng nhập';
    if (!createForm.initialPassword || createForm.initialPassword.length < 10) {
      errs.initialPassword = 'Mật khẩu phải từ 10 ký tự trở lên';
    }
    if (!createForm.fullName.trim()) errs.fullName = 'Vui lòng nhập họ tên hội viên';
    if (!createForm.phone.trim()) errs.phone = 'Vui lòng nhập số điện thoại';

    if (Object.keys(errs).length > 0) {
      setCreateErrors(errs);
      return;
    }

    setCreateLoading(true);
    try {
      const newMember = await api.members.create({
        login: createForm.login.trim().toLowerCase(),
        initialPassword: createForm.initialPassword,
        fullName: createForm.fullName.trim(),
        phone: createForm.phone.trim(),
        email: createForm.email.trim() || undefined,
      });

      setIsCreateOpen(false);
      setToast({ type: 'success', message: `Thêm hội viên thành công: ${newMember.fullName} (Mã #${newMember.id})` });
      fetchMembers(searchQuery);
    } catch (err) {
      if (err.fields) {
        setCreateErrors(err.fields);
      }
      setToast({ type: 'danger', message: err.message || 'Không thể tạo tài khoản hội viên.' });
    } finally {
      setCreateLoading(false);
    }
  };

  // Mở modal sửa
  const handleOpenEdit = (m) => {
    setEditingMember(m);
    setEditForm({
      fullName: m.fullName || '',
      phone: m.phone || '',
      email: m.email || '',
    });
    setEditErrors({});
    setIsEditOpen(true);
  };

  // Submit sửa
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditErrors({});

    if (!editForm.fullName.trim()) {
      setEditErrors({ fullName: 'Vui lòng nhập họ tên' });
      return;
    }
    if (!editForm.phone.trim()) {
      setEditErrors({ phone: 'Vui lòng nhập số điện thoại' });
      return;
    }

    setEditLoading(true);
    try {
      const updated = await api.members.update(editingMember.id, {
        fullName: editForm.fullName.trim(),
        phone: editForm.phone.trim(),
        email: editForm.email.trim(),
      });

      setIsEditOpen(false);
      setToast({ type: 'success', message: `Cập nhật thông tin hội viên #${updated.id} thành công!` });
      fetchMembers(searchQuery);
    } catch (err) {
      if (err.fields) {
        setEditErrors(err.fields);
      }
      setToast({ type: 'danger', message: err.message || 'Không thể cập nhật hồ sơ hội viên.' });
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header-row">
        <div>
          <h2 className="page-title">Quản Lý Hồ Sơ Hội Viên</h2>
          <p className="page-subtitle">Tìm kiếm, tạo mới và chỉnh sửa thông tin hội viên phòng tập</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => fetchMembers(searchQuery)}>
            <IconRefreshCw size={14} /> Tải lại
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleOpenCreate}>
            <IconPlus size={16} /> Thêm Hội Viên Mới
          </button>
        </div>
      </div>

      {toast && (
        <AlertBanner
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {error && <AlertBanner type="danger" message={error} />}

      {/* THANH TÌM KIẾM */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-body" style={{ padding: '12px 16px' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Tìm theo họ tên, số điện thoại, tên đăng nhập hoặc email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ padding: '0 20px' }}>
              <IconSearch size={16} /> Tìm Kiếm
            </button>
            {searchQuery && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setSearchQuery('');
                  fetchMembers('');
                }}
              >
                Xóa lọc
              </button>
            )}
          </form>
        </div>
      </div>

      {/* BẢNG DANH SÁCH HỘI VIÊN */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Danh Sách Hội Viên ({members.length} người)</h3>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div className="table-responsive">
              <table className="data-table">
                <tbody>
                  <SkeletonRow cols={6} />
                  <SkeletonRow cols={6} />
                  <SkeletonRow cols={6} />
                </tbody>
              </table>
            </div>
          ) : members.length === 0 ? (
            <EmptyState
              icon={IconUsers}
              title="Không tìm thấy hội viên nào"
              message={searchQuery ? 'Thử tìm với từ khóa khác hoặc xóa bộ lọc.' : 'Chưa có hội viên nào trong hệ thống.'}
              actionText="+ Đăng Ký Hội Viên Đầu Tiên"
              onAction={handleOpenCreate}
            />
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Mã số</th>
                    <th>Họ và tên</th>
                    <th>Tài khoản</th>
                    <th>Số điện thoại</th>
                    <th>Email</th>
                    <th>Ngày tạo</th>
                    <th style={{ textAlign: 'right' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id}>
                      <td style={{ color: 'var(--text-secondary)' }}>#{m.id}</td>
                      <td style={{ fontWeight: 600 }}>{m.fullName}</td>
                      <td>
                        <span className="badge badge-neutral">@{m.login}</span>
                      </td>
                      <td>{m.phone}</td>
                      <td style={{ color: m.email ? 'inherit' : 'var(--text-muted)' }}>
                        {m.email || '—'}
                      </td>
                      <td>{formatDate(m.createdAt ? m.createdAt.slice(0, 10) : '')}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenEdit(m)}
                            title="Sửa thông tin"
                          >
                            <IconEdit2 size={13} /> Sửa
                          </button>
                          {onOpenMembershipModal && (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => onOpenMembershipModal(m.id)}
                              title="Bán gói / Làm thẻ tập mới"
                            >
                              + Bán Thẻ
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODAL THÊM HỘI VIÊN MỚI */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Đăng Ký Hội Viên Mới"
        footer={(
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsCreateOpen(false)}
              disabled={createLoading}
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCreateSubmit}
              disabled={createLoading}
            >
              {createLoading ? 'Đang tạo...' : 'Lưu Hội Viên'}
            </button>
          </>
        )}
      >
        <form onSubmit={handleCreateSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="new-fullname">
              Họ và tên hội viên <span className="required">*</span>
            </label>
            <input
              id="new-fullname"
              type="text"
              className={`form-input ${createErrors.fullName ? 'is-invalid' : ''}`}
              placeholder="VD: Nguyễn Văn An"
              value={createForm.fullName}
              onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
              disabled={createLoading}
              autoFocus
            />
            {createErrors.fullName && <InlineError message={createErrors.fullName} />}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="new-phone">
              Số điện thoại <span className="required">*</span>
            </label>
            <input
              id="new-phone"
              type="tel"
              className={`form-input ${createErrors.phone ? 'is-invalid' : ''}`}
              placeholder="VD: 0912345678"
              value={createForm.phone}
              onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
              disabled={createLoading}
            />
            {createErrors.phone && <InlineError message={createErrors.phone} />}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="new-login">
              Tên đăng nhập (chữ thường, số, dấu chấm/gạch) <span className="required">*</span>
            </label>
            <input
              id="new-login"
              type="text"
              className={`form-input ${createErrors.login ? 'is-invalid' : ''}`}
              placeholder="VD: vanan.gym, annguyen99..."
              value={createForm.login}
              onChange={(e) => setCreateForm({ ...createForm, login: e.target.value })}
              disabled={createLoading}
            />
            {createErrors.login && <InlineError message={createErrors.login} />}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="new-password">
              Mật khẩu khởi tạo (tối thiểu 10 ký tự) <span className="required">*</span>
            </label>
            <input
              id="new-password"
              type="text"
              className={`form-input ${createErrors.initialPassword ? 'is-invalid' : ''}`}
              value={createForm.initialPassword}
              onChange={(e) => setCreateForm({ ...createForm, initialPassword: e.target.value })}
              disabled={createLoading}
            />
            {createErrors.initialPassword && <InlineError message={createErrors.initialPassword} />}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="new-email">
              Địa chỉ Email (tùy chọn)
            </label>
            <input
              id="new-email"
              type="email"
              className={`form-input ${createErrors.email ? 'is-invalid' : ''}`}
              placeholder="VD: an@example.com"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              disabled={createLoading}
            />
            {createErrors.email && <InlineError message={createErrors.email} />}
          </div>
        </form>
      </Modal>

      {/* MODAL SỬA THÔNG TIN HỘI VIÊN */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title={`Chỉnh Sửa Hồ Sơ Hội Viên #${editingMember ? editingMember.id : ''}`}
        footer={(
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsEditOpen(false)}
              disabled={editLoading}
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleEditSubmit}
              disabled={editLoading}
            >
              {editLoading ? 'Đang cập nhật...' : 'Lưu Thay Đổi'}
            </button>
          </>
        )}
      >
        <form onSubmit={handleEditSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="edit-fullname">
              Họ và tên <span className="required">*</span>
            </label>
            <input
              id="edit-fullname"
              type="text"
              className={`form-input ${editErrors.fullName ? 'is-invalid' : ''}`}
              value={editForm.fullName}
              onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
              disabled={editLoading}
            />
            {editErrors.fullName && <InlineError message={editErrors.fullName} />}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="edit-phone">
              Số điện thoại <span className="required">*</span>
            </label>
            <input
              id="edit-phone"
              type="tel"
              className={`form-input ${editErrors.phone ? 'is-invalid' : ''}`}
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              disabled={editLoading}
            />
            {editErrors.phone && <InlineError message={editErrors.phone} />}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="edit-email">
              Địa chỉ Email
            </label>
            <input
              id="edit-email"
              type="email"
              className={`form-input ${editErrors.email ? 'is-invalid' : ''}`}
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              disabled={editLoading}
            />
            {editErrors.email && <InlineError message={editErrors.email} />}
          </div>
        </form>
      </Modal>
    </div>
  );
}
