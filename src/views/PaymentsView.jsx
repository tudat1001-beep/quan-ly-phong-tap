import React, { useEffect, useRef, useState } from 'react';
import { api, formatDate, formatDateTime, formatVnd } from '../api.js';
import { Modal } from '../components/Modal.jsx';
import { AlertBanner, EmptyState, InlineError, SkeletonRow } from '../components/Feedback.jsx';
import { IconDollarSign, IconPlus, IconRefreshCw } from '../icons.jsx';

export function PaymentsView({ user, preselectedMembership = null }) {
  const isStaffOrOwner = user.role === 'owner' || user.role === 'staff';

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  // Danh sách thẻ còn nợ để nhân viên chọn
  const [memberships, setMemberships] = useState([]);

  // Modal thu tiền
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    membershipId: '',
    amountVnd: '',
    method: 'cash',
    note: '',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createErrors, setCreateErrors] = useState({});
  const paymentIntent = useRef({ key: '', requestId: '' });

  const fetchPayments = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.payments.list();
      setPayments(data || []);
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách phiếu thu.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMemberships = async () => {
    if (!isStaffOrOwner) return;
    try {
      const data = await api.memberships.list();
      setMemberships(data || []);
    } catch {
      // bỏ qua
    }
  };

  useEffect(() => {
    fetchPayments();
    fetchMemberships();
  }, []);

  useEffect(() => {
    if (preselectedMembership) {
      setCreateForm({
        membershipId: String(preselectedMembership.id),
        amountVnd: String(preselectedMembership.balanceVnd > 0 ? preselectedMembership.balanceVnd : ''),
        method: 'cash',
        note: '',
      });
      setIsCreateOpen(true);
    }
  }, [preselectedMembership]);

  const handleOpenCreate = () => {
    // Tìm thẻ đầu tiên còn nợ nếu có
    const unpaid = memberships.find((m) => m.balanceVnd > 0);
    setCreateForm({
      membershipId: unpaid ? String(unpaid.id) : (memberships.length > 0 ? String(memberships[0].id) : ''),
      amountVnd: unpaid ? String(unpaid.balanceVnd) : '',
      method: 'cash',
      note: '',
    });
    setCreateErrors({});
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateErrors({});

    const errs = {};
    if (!createForm.membershipId) errs.membershipId = 'Vui lòng chọn thẻ hội viên cần thu';
    const amount = Number(createForm.amountVnd);
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1000000000) {
      errs.amountVnd = 'Số tiền phải là số nguyên dương hợp lệ (tối đa 1 tỷ VND)';
    }

    const selectedM = memberships.find((m) => String(m.id) === String(createForm.membershipId));
    if (selectedM && amount > selectedM.balanceVnd) {
      errs.amountVnd = `Số tiền thu không được vượt quá số còn nợ (${formatVnd(selectedM.balanceVnd)})`;
    }

    if (Object.keys(errs).length > 0) {
      setCreateErrors(errs);
      return;
    }

    setCreateLoading(true);
    try {
      const payment = {
        membershipId: Number(createForm.membershipId),
        amountVnd: amount,
        method: createForm.method,
        note: createForm.note.trim(),
      };
      const key = JSON.stringify(payment);
      if (paymentIntent.current.key !== key) {
        paymentIntent.current = { key, requestId: crypto.randomUUID() };
      }
      const recorded = await api.payments.create({
        ...payment,
        requestId: paymentIntent.current.requestId,
      });

      setIsCreateOpen(false);
      paymentIntent.current = { key: '', requestId: '' };
      setToast({
        type: 'success',
        message: `Lập phiếu thu thành công: ${formatVnd(recorded.amountVnd)} từ ${recorded.memberName} (Phiếu #${recorded.id})!`,
      });
      fetchPayments();
      fetchMemberships();
    } catch (err) {
      if (err.fields) {
        setCreateErrors(err.fields);
      }
      setToast({ type: 'danger', message: err.message || 'Không thể ghi nhận phiếu thu.' });
    } finally {
      setCreateLoading(false);
    }
  };

  const selectedMembershipInfo = memberships.find((m) => String(m.id) === String(createForm.membershipId));

  return (
    <div>
      <div className="page-header-row">
        <div>
          <h2 className="page-title">
            {isStaffOrOwner ? 'Sổ Thu Tiền & Lịch Sử Giao Dịch (VND)' : 'Lịch Sử Nộp Tiền Của Bạn'}
          </h2>
          <p className="page-subtitle">
            {isStaffOrOwner
              ? 'Ghi nhận các khoản thu bằng tiền mặt hoặc chuyển khoản, ngăn thu thừa và chống trùng lặp'
              : 'Theo dõi chi tiết các phiếu thu và số tiền bạn đã thanh toán cho phòng tập'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={fetchPayments}>
            <IconRefreshCw size={14} /> Tải lại
          </button>
          {isStaffOrOwner && (
            <button type="button" className="btn btn-primary btn-sm" onClick={handleOpenCreate}>
              <IconPlus size={16} /> Lập Phiếu Thu Mới
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

      {/* BẢNG LỊCH SỬ THU */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Danh Sách Phiếu Thu ({payments.length} phiếu)</h3>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div className="table-responsive">
              <table className="data-table">
                <tbody>
                  <SkeletonRow cols={6} />
                  <SkeletonRow cols={6} />
                </tbody>
              </table>
            </div>
          ) : payments.length === 0 ? (
            <EmptyState
              icon={IconDollarSign}
              title="Chưa có khoản thu nào"
              message={isStaffOrOwner ? 'Bấm nút Lập Phiếu Thu Mới để ghi nhận thanh toán.' : 'Bạn chưa có phiếu thu nào.'}
              actionText={isStaffOrOwner ? '+ Lập Phiếu Thu Đầu Tiên' : null}
              onAction={isStaffOrOwner ? handleOpenCreate : null}
            />
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Mã phiếu</th>
                    {isStaffOrOwner && <th>Hội viên</th>}
                    <th>Thẻ liên quan</th>
                    <th>Số tiền thu</th>
                    <th>Hình thức</th>
                    <th>Ghi chú</th>
                    <th>Thời gian thu</th>
                    {isStaffOrOwner && <th>Thu ngân</th>}
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td style={{ color: 'var(--text-secondary)' }}>#{p.id}</td>
                      {isStaffOrOwner && (
                        <td style={{ fontWeight: 600 }}>{p.memberName}</td>
                      )}
                      <td>Thẻ #{p.membershipId}</td>
                      <td style={{ fontWeight: 700, color: 'var(--primary-emerald)' }}>
                        {formatVnd(p.amountVnd)}
                      </td>
                      <td>
                        <span className={`badge ${p.method === 'cash' ? 'badge-success' : 'badge-info'}`}>
                          {p.method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{p.note || '—'}</td>
                      <td>{formatDateTime(p.createdAt)}</td>
                      {isStaffOrOwner && (
                        <td style={{ color: 'var(--text-secondary)' }}>Nhân viên #{p.recordedBy}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODAL LẬP PHIẾU THU (OWNER / STAFF) */}
      {isStaffOrOwner && (
        <Modal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Lập Phiếu Thu Tiền Thẻ Hội Viên"
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
                {createLoading ? 'Đang lưu phiếu thu...' : 'Xác Nhận Thu Tiền'}
              </button>
            </>
          )}
        >
          <form onSubmit={handleCreateSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="pay-select-membership">
                Chọn thẻ hội viên <span className="required">*</span>
              </label>
              <select
                id="pay-select-membership"
                className={`form-select ${createErrors.membershipId ? 'is-invalid' : ''}`}
                value={createForm.membershipId}
                onChange={(e) => {
                  const mId = e.target.value;
                  const found = memberships.find((m) => String(m.id) === String(mId));
                  setCreateForm({
                    ...createForm,
                    membershipId: mId,
                    amountVnd: found && found.balanceVnd > 0 ? String(found.balanceVnd) : '',
                  });
                }}
                disabled={createLoading}
              >
                <option value="">-- Chọn thẻ cần thu ({memberships.length} thẻ) --</option>
                {memberships.map((m) => (
                  <option key={m.id} value={m.id}>
                    Thẻ #{m.id} - {m.memberName} ({m.packageName}) - Còn nợ: {formatVnd(m.balanceVnd)}
                  </option>
                ))}
              </select>
              {createErrors.membershipId && <InlineError message={createErrors.membershipId} />}
            </div>

            {selectedMembershipInfo && (
              <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Thông tin thẻ đã chọn:</div>
                <div style={{ fontWeight: 600 }}>{selectedMembershipInfo.packageName} (Hội viên: {selectedMembershipInfo.memberName})</div>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>
                  Giá gói: <strong>{formatVnd(selectedMembershipInfo.priceVnd)}</strong> | Đã nộp: <strong>{formatVnd(selectedMembershipInfo.paidVnd)}</strong> | Còn nợ tối đa: <strong style={{ color: '#e11d48' }}>{formatVnd(selectedMembershipInfo.balanceVnd)}</strong>
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="pay-amount">
                Số tiền thu (VND, số nguyên) <span className="required">*</span>
              </label>
              <input
                id="pay-amount"
                type="number"
                min="1"
                step="1000"
                className={`form-input ${createErrors.amountVnd ? 'is-invalid' : ''}`}
                placeholder="VD: 300000"
                value={createForm.amountVnd}
                onChange={(e) => setCreateForm({ ...createForm, amountVnd: e.target.value })}
                disabled={createLoading}
              />
              <div className="form-help-text">
                Hiển thị: {formatVnd(Number(createForm.amountVnd) || 0)}
              </div>
              {createErrors.amountVnd && <InlineError message={createErrors.amountVnd} />}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="pay-method">
                Phương thức thanh toán <span className="required">*</span>
              </label>
              <select
                id="pay-method"
                className="form-select"
                value={createForm.method}
                onChange={(e) => setCreateForm({ ...createForm, method: e.target.value })}
                disabled={createLoading}
              >
                <option value="cash">Tiền mặt tại quầy</option>
                <option value="bank_transfer">Chuyển khoản ngân hàng</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="pay-note">
                Ghi chú phiếu thu (tùy chọn)
              </label>
              <input
                id="pay-note"
                type="text"
                className="form-input"
                placeholder="VD: Khách trả trước đợt 1..."
                value={createForm.note}
                onChange={(e) => setCreateForm({ ...createForm, note: e.target.value })}
                disabled={createLoading}
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
