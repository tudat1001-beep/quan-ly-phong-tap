import React, { useEffect, useState } from 'react';
import { api, formatVnd } from '../api.js';
import { Modal } from '../components/Modal.jsx';
import { AlertBanner, EmptyState, InlineError, SkeletonRow } from '../components/Feedback.jsx';
import { IconPackage, IconPlus, IconEdit2, IconRefreshCw } from '../icons.jsx';

export function PackagesView({ user }) {
  const isOwner = user.role === 'owner';

  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  // Modal tạo gói mới (Owner)
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    durationDays: 30,
    priceVnd: 300000,
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createErrors, setCreateErrors] = useState({});

  // Modal chỉnh sửa gói (Owner)
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    durationDays: 30,
    priceVnd: 300000,
    isActive: true,
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editErrors, setEditErrors] = useState({});

  const fetchPackages = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.packages.list();
      setPackages(data || []);
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách gói tập.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  // Mở modal tạo
  const handleOpenCreate = () => {
    setCreateForm({
      name: '',
      durationDays: 30,
      priceVnd: 300000,
    });
    setCreateErrors({});
    setIsCreateOpen(true);
  };

  // Submit tạo gói
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateErrors({});

    const errs = {};
    if (!createForm.name.trim()) errs.name = 'Vui lòng nhập tên gói tập';
    const days = Number(createForm.durationDays);
    if (isNaN(days) || days < 1 || days > 366) {
      errs.durationDays = 'Thời hạn phải từ 1 đến 366 ngày';
    }
    const price = Number(createForm.priceVnd);
    if (isNaN(price) || price < 0 || price > 1000000000) {
      errs.priceVnd = 'Giá phải từ 0 đến 1.000.000.000 đ';
    }

    if (Object.keys(errs).length > 0) {
      setCreateErrors(errs);
      return;
    }

    setCreateLoading(true);
    try {
      const created = await api.packages.create({
        name: createForm.name.trim(),
        durationDays: days,
        priceVnd: price,
      });

      setIsCreateOpen(false);
      setToast({ type: 'success', message: `Tạo gói tập "${created.name}" thành công!` });
      fetchPackages();
    } catch (err) {
      if (err.fields) {
        setCreateErrors(err.fields);
      }
      setToast({ type: 'danger', message: err.message || 'Không thể tạo gói tập mới.' });
    } finally {
      setCreateLoading(false);
    }
  };

  // Mở modal sửa
  const handleOpenEdit = (pkg) => {
    setEditingPackage(pkg);
    setEditForm({
      name: pkg.name,
      durationDays: pkg.durationDays,
      priceVnd: pkg.priceVnd,
      isActive: Boolean(pkg.isActive),
    });
    setEditErrors({});
    setIsEditOpen(true);
  };

  // Submit sửa gói
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditErrors({});

    const errs = {};
    if (!editForm.name.trim()) errs.name = 'Vui lòng nhập tên gói tập';
    const days = Number(editForm.durationDays);
    if (isNaN(days) || days < 1 || days > 366) {
      errs.durationDays = 'Thời hạn phải từ 1 đến 366 ngày';
    }
    const price = Number(editForm.priceVnd);
    if (isNaN(price) || price < 0 || price > 1000000000) {
      errs.priceVnd = 'Giá phải từ 0 đến 1.000.000.000 đ';
    }

    if (Object.keys(errs).length > 0) {
      setEditErrors(errs);
      return;
    }

    setEditLoading(true);
    try {
      const updated = await api.packages.update(editingPackage.id, {
        name: editForm.name.trim(),
        durationDays: days,
        priceVnd: price,
        isActive: editForm.isActive,
      });

      setIsEditOpen(false);
      setToast({ type: 'success', message: `Cập nhật gói "${updated.name}" thành công!` });
      fetchPackages();
    } catch (err) {
      if (err.fields) {
        setEditErrors(err.fields);
      }
      setToast({ type: 'danger', message: err.message || 'Không thể cập nhật gói tập.' });
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header-row">
        <div>
          <h2 className="page-title">Danh Mục Gói Tập & Dịch Vụ</h2>
          <p className="page-subtitle">
            {isOwner
              ? 'Thiết lập thời hạn, bảng giá và kích hoạt gói tập cho phòng'
              : 'Xem các gói tập hiện đang được phòng tập áp dụng'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={fetchPackages}>
            <IconRefreshCw size={14} /> Tải lại
          </button>
          {isOwner && (
            <button type="button" className="btn btn-primary btn-sm" onClick={handleOpenCreate}>
              <IconPlus size={16} /> Tạo Gói Mới
            </button>
          )}
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

      {/* DANH SÁCH GÓI TẬP */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Bảng Giá & Gói Tập ({packages.length} gói)</h3>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div className="table-responsive">
              <table className="data-table">
                <tbody>
                  <SkeletonRow cols={5} />
                  <SkeletonRow cols={5} />
                </tbody>
              </table>
            </div>
          ) : packages.length === 0 ? (
            <EmptyState
              icon={IconPackage}
              title="Chưa có gói tập nào"
              message="Hiện chưa có gói tập nào trong danh mục."
              actionText={isOwner ? '+ Tạo Gói Tập Đầu Tiên' : null}
              onAction={isOwner ? handleOpenCreate : null}
            />
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Mã gói</th>
                    <th>Tên gói tập</th>
                    <th>Thời hạn</th>
                    <th>Giá niêm yết</th>
                    <th>Trạng thái bán</th>
                    {isOwner && <th style={{ textAlign: 'right' }}>Thao tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {packages.map((pkg) => (
                    <tr key={pkg.id}>
                      <td style={{ color: 'var(--text-secondary)' }}>#{pkg.id}</td>
                      <td style={{ fontWeight: 600 }}>{pkg.name}</td>
                      <td>{pkg.durationDays} ngày</td>
                      <td style={{ fontWeight: 600, color: 'var(--primary-emerald)' }}>
                        {formatVnd(pkg.priceVnd)}
                      </td>
                      <td>
                        <span className={`badge ${pkg.isActive ? 'badge-success' : 'badge-neutral'}`}>
                          {pkg.isActive ? 'Đang mở bán' : 'Ngừng bán'}
                        </span>
                      </td>
                      {isOwner && (
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenEdit(pkg)}
                          >
                            <IconEdit2 size={13} /> Sửa
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODAL TẠO GÓI MỚI (OWNER) */}
      {isOwner && (
        <Modal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Tạo Gói Tập Mới"
          footer={(
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsCreateOpen(false)}
                disabled={createLoading}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCreateSubmit}
                disabled={createLoading}
              >
                {createLoading ? 'Đang lưu...' : 'Lưu Gói Tập'}
              </button>
            </>
          )}
        >
          <form onSubmit={handleCreateSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="pkg-create-name">
                Tên gói tập <span className="required">*</span>
              </label>
              <input
                id="pkg-create-name"
                type="text"
                className={`form-input ${createErrors.name ? 'is-invalid' : ''}`}
                placeholder="VD: Gym Tiêu Chuẩn 30 Ngày"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                disabled={createLoading}
                autoFocus
              />
              {createErrors.name && <InlineError message={createErrors.name} />}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="pkg-create-duration">
                Thời hạn (số ngày, 1..366) <span className="required">*</span>
              </label>
              <input
                id="pkg-create-duration"
                type="number"
                min="1"
                max="366"
                className={`form-input ${createErrors.durationDays ? 'is-invalid' : ''}`}
                value={createForm.durationDays}
                onChange={(e) => setCreateForm({ ...createForm, durationDays: e.target.value })}
                disabled={createLoading}
              />
              {createErrors.durationDays && <InlineError message={createErrors.durationDays} />}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="pkg-create-price">
                Giá niêm yết VND (số nguyên, 0..1 tỷ) <span className="required">*</span>
              </label>
              <input
                id="pkg-create-price"
                type="number"
                min="0"
                step="1000"
                className={`form-input ${createErrors.priceVnd ? 'is-invalid' : ''}`}
                value={createForm.priceVnd}
                onChange={(e) => setCreateForm({ ...createForm, priceVnd: e.target.value })}
                disabled={createLoading}
              />
              <div className="form-help-text">Hiển thị: {formatVnd(Number(createForm.priceVnd) || 0)}</div>
              {createErrors.priceVnd && <InlineError message={createErrors.priceVnd} />}
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL SỬA GÓI TẬP (OWNER) */}
      {isOwner && (
        <Modal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          title={`Chỉnh Sửa Gói Tập #${editingPackage ? editingPackage.id : ''}`}
          footer={(
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsEditOpen(false)}
                disabled={editLoading}
              >
                Hủy
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
              <label className="form-label" htmlFor="pkg-edit-name">
                Tên gói tập <span className="required">*</span>
              </label>
              <input
                id="pkg-edit-name"
                type="text"
                className={`form-input ${editErrors.name ? 'is-invalid' : ''}`}
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                disabled={editLoading}
              />
              {editErrors.name && <InlineError message={editErrors.name} />}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="pkg-edit-duration">
                Thời hạn (ngày, 1..366) <span className="required">*</span>
              </label>
              <input
                id="pkg-edit-duration"
                type="number"
                min="1"
                max="366"
                className={`form-input ${editErrors.durationDays ? 'is-invalid' : ''}`}
                value={editForm.durationDays}
                onChange={(e) => setEditForm({ ...editForm, durationDays: e.target.value })}
                disabled={editLoading}
              />
              {editErrors.durationDays && <InlineError message={editErrors.durationDays} />}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="pkg-edit-price">
                Giá niêm yết VND (0..1 tỷ) <span className="required">*</span>
              </label>
              <input
                id="pkg-edit-price"
                type="number"
                min="0"
                step="1000"
                className={`form-input ${editErrors.priceVnd ? 'is-invalid' : ''}`}
                value={editForm.priceVnd}
                onChange={(e) => setEditForm({ ...editForm, priceVnd: e.target.value })}
                disabled={editLoading}
              />
              <div className="form-help-text">Hiển thị: {formatVnd(Number(editForm.priceVnd) || 0)}</div>
              {editErrors.priceVnd && <InlineError message={editErrors.priceVnd} />}
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  style={{ width: '18px', height: '18px' }}
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                  disabled={editLoading}
                />
                <span>Mở bán gói này (Đang bán)</span>
              </label>
              <div className="form-help-text">Gói ngừng bán sẽ không thể tạo thẻ mới, nhưng lịch sử thẻ cũ được giữ nguyên.</div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
