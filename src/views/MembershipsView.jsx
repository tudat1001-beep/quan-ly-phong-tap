import React, { useEffect, useState } from 'react';
import { api, formatDate, formatVnd, getVietnamTodayDateString } from '../api.js';
import { Modal } from '../components/Modal.jsx';
import { AlertBanner, EmptyState, InlineError, SkeletonRow } from '../components/Feedback.jsx';
import { IconCreditCard, IconPlus, IconRefreshCw, IconDollarSign } from '../icons.jsx';

export function MembershipsView({ user, preselectedMemberId = null, onOpenPaymentModal }) {
  const isStaffOrOwner = user.role === 'owner' || user.role === 'staff';

  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  // Danh sách hội viên & gói tập để phục vụ tạo thẻ
  const [members, setMembers] = useState([]);
  const [packages, setPackages] = useState([]);

  // Modal tạo thẻ mới (Bán gói)
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    memberId: preselectedMemberId || '',
    packageId: '',
    startDate: getVietnamTodayDateString(),
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createErrors, setCreateErrors] = useState({});

  const fetchMemberships = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.memberships.list();
      setMemberships(data || []);
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách thẻ hội viên.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAuxData = async () => {
    if (!isStaffOrOwner) return;
    try {
      const [membersData, pkgsData] = await Promise.all([
        api.members.list(),
        api.packages.list(),
      ]);
      setMembers(membersData || []);
      // Chỉ cho phép chọn gói đang bán (isActive = true)
      setPackages((pkgsData || []).filter((p) => p.isActive));
    } catch {
      // bỏ qua
    }
  };

  useEffect(() => {
    fetchMemberships();
    fetchAuxData();
  }, []);

  useEffect(() => {
    if (preselectedMemberId) {
      setCreateForm((prev) => ({
        ...prev,
        memberId: preselectedMemberId,
      }));
      setIsCreateOpen(true);
    }
  }, [preselectedMemberId]);

  const handleOpenCreate = () => {
    setCreateForm({
      memberId: preselectedMemberId || '',
      packageId: packages.length > 0 ? String(packages[0].id) : '',
      startDate: getVietnamTodayDateString(),
    });
    setCreateErrors({});
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateErrors({});

    const errs = {};
    if (!createForm.memberId) errs.memberId = 'Vui lòng chọn hội viên';
    if (!createForm.packageId) errs.packageId = 'Vui lòng chọn gói tập';
    if (!createForm.startDate) errs.startDate = 'Vui lòng chọn ngày bắt đầu';

    if (Object.keys(errs).length > 0) {
      setCreateErrors(errs);
      return;
    }

    setCreateLoading(true);
    try {
      const created = await api.memberships.create({
        memberId: Number(createForm.memberId),
        packageId: Number(createForm.packageId),
        startDate: createForm.startDate,
      });

      setIsCreateOpen(false);
      setToast({
        type: 'success',
        message: `Kích hoạt thẻ "${created.packageName}" cho ${created.memberName} thành công (Từ ${formatDate(created.startDate)} đến ${formatDate(created.endDate)})!`,
      });
      fetchMemberships();
    } catch (err) {
      if (err.fields) {
        setCreateErrors(err.fields);
      }
      setToast({ type: 'danger', message: err.message || 'Không thể tạo thẻ hội viên.' });
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header-row">
        <div>
          <h2 className="page-title">
            {isStaffOrOwner ? 'Quản Lý Thẻ Hội Viên & Gói Tập Đã Bán' : 'Thẻ Hội Viên Của Bạn'}
          </h2>
          <p className="page-subtitle">
            {isStaffOrOwner
              ? 'Theo dõi thời hạn hiệu lực, tiền đóng và công nợ của từng thẻ'
              : 'Kiểm tra ngày hết hạn và số dư các gói tập bạn đã mua'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={fetchMemberships}>
            <IconRefreshCw size={14} /> Tải lại
          </button>
          {isStaffOrOwner && (
            <button type="button" className="btn btn-primary btn-sm" onClick={handleOpenCreate}>
              <IconPlus size={16} /> Bán Thẻ Mới
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

      {/* BẢNG THẺ HỘI VIÊN */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Danh Sách Thẻ Tập ({memberships.length} thẻ)</h3>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div className="table-responsive">
              <table className="data-table">
                <tbody>
                  <SkeletonRow cols={7} />
                  <SkeletonRow cols={7} />
                </tbody>
              </table>
            </div>
          ) : memberships.length === 0 ? (
            <EmptyState
              icon={IconCreditCard}
              title="Chưa có thẻ hội viên nào"
              message={isStaffOrOwner ? 'Bấm nút Bán Thẻ Mới để tạo thẻ cho hội viên.' : 'Bạn chưa có thẻ hội viên.'}
              actionText={isStaffOrOwner ? '+ Bán Thẻ Đầu Tiên' : null}
              onAction={isStaffOrOwner ? handleOpenCreate : null}
            />
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Mã thẻ</th>
                    {isStaffOrOwner && <th>Hội viên</th>}
                    <th>Gói tập (Snapshot)</th>
                    <th>Thời hạn</th>
                    <th>Giá gói</th>
                    <th>Đã nộp / Còn nợ</th>
                    <th>Trạng thái</th>
                    {isStaffOrOwner && <th style={{ textAlign: 'right' }}>Thao tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {memberships.map((m) => (
                    <tr key={m.id}>
                      <td style={{ color: 'var(--text-secondary)' }}>#{m.id}</td>
                      {isStaffOrOwner && (
                        <td style={{ fontWeight: 600 }}>{m.memberName} (Mã #{m.memberId})</td>
                      )}
                      <td>
                        <span style={{ fontWeight: 600 }}>{m.packageName}</span>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{m.durationDays} ngày</div>
                      </td>
                      <td>
                        <div>{formatDate(m.startDate)} → {formatDate(m.endDate)}</div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{formatVnd(m.priceVnd)}</td>
                      <td>
                        <div>Đã nộp: <span style={{ color: 'var(--primary-emerald)', fontWeight: 600 }}>{formatVnd(m.paidVnd)}</span></div>
                        {m.balanceVnd > 0 ? (
                          <div style={{ color: '#e11d48', fontWeight: 600, fontSize: '12px' }}>
                            Còn nợ: {formatVnd(m.balanceVnd)}
                          </div>
                        ) : (
                          <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Đủ tiền</div>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${m.status === 'active' ? 'badge-success' : (m.status === 'upcoming' ? 'badge-warning' : 'badge-danger')}`}>
                          {m.status === 'active' ? 'Đang hoạt động' : (m.status === 'upcoming' ? 'Chưa tới ngày' : 'Đã hết hạn')}
                        </span>
                      </td>
                      {isStaffOrOwner && (
                        <td style={{ textAlign: 'right' }}>
                          {m.balanceVnd > 0 && onOpenPaymentModal && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => onOpenPaymentModal(m)}
                              title="Thu tiền cho thẻ này"
                            >
                              <IconDollarSign size={13} /> Thu tiền
                            </button>
                          )}
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

      {/* MODAL TẠO THẺ MỚI (BÁN GÓI) */}
      {isStaffOrOwner && (
        <Modal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Bán Gói Tập / Kích Hoạt Thẻ Hội Viên"
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
                {createLoading ? 'Đang kích hoạt...' : 'Kích Hoạt Thẻ'}
              </button>
            </>
          )}
        >
          <form onSubmit={handleCreateSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="mem-select-member">
                Chọn hội viên <span className="required">*</span>
              </label>
              <select
                id="mem-select-member"
                className={`form-select ${createErrors.memberId ? 'is-invalid' : ''}`}
                value={createForm.memberId}
                onChange={(e) => setCreateForm({ ...createForm, memberId: e.target.value })}
                disabled={createLoading}
              >
                <option value="">-- Chọn hội viên ({members.length} người) --</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    #{m.id} - {m.fullName} ({m.phone})
                  </option>
                ))}
              </select>
              {createErrors.memberId && <InlineError message={createErrors.memberId} />}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="mem-select-package">
                Chọn gói tập đang bán <span className="required">*</span>
              </label>
              <select
                id="mem-select-package"
                className={`form-select ${createErrors.packageId ? 'is-invalid' : ''}`}
                value={createForm.packageId}
                onChange={(e) => setCreateForm({ ...createForm, packageId: e.target.value })}
                disabled={createLoading}
              >
                <option value="">-- Chọn gói tập ({packages.length} gói) --</option>
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.durationDays} ngày) - {formatVnd(p.priceVnd)}
                  </option>
                ))}
              </select>
              {createErrors.packageId && <InlineError message={createErrors.packageId} />}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="mem-start-date">
                Ngày bắt đầu có hiệu lực (YYYY-MM-DD) <span className="required">*</span>
              </label>
              <input
                id="mem-start-date"
                type="date"
                className={`form-input ${createErrors.startDate ? 'is-invalid' : ''}`}
                value={createForm.startDate}
                onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })}
                disabled={createLoading}
              />
              <div className="form-help-text">
                Ngày kết thúc sẽ được hệ thống tính tự động: [Ngày bắt đầu + Số ngày của gói - 1].
                Hội viên không được có 2 thẻ trùng thời gian.
              </div>
              {createErrors.startDate && <InlineError message={createErrors.startDate} />}
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
