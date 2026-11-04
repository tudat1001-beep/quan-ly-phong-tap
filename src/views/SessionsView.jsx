import React, { useEffect, useState } from 'react';
import {
  api,
  formatDate,
  formatDateTime,
  getVietnamTodayDateString,
  vnDateTimeToUtcIso,
} from '../api.js';
import { Modal } from '../components/Modal.jsx';
import { AlertBanner, EmptyState, InlineError, SkeletonRow } from '../components/Feedback.jsx';
import { IconCalendar, IconPlus, IconRefreshCw, IconCheck, IconX } from '../icons.jsx';

export function SessionsView({ user }) {
  const role = user.role;
  const canBook = role === 'owner' || role === 'staff' || role === 'member';

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  // Danh sách PT (Huấn luyện viên) và Hội viên để đặt lịch
  const [trainers, setTrainers] = useState([]);
  const [members, setMembers] = useState([]);

  // Modal đặt lịch
  const [isBookOpen, setIsBookOpen] = useState(false);
  const [bookForm, setBookForm] = useState({
    memberId: role === 'member' ? String(user.memberId) : '',
    ptId: '',
    date: getVietnamTodayDateString(),
    startTime: '09:00',
    durationMinutes: 60,
    note: '',
  });
  const [bookLoading, setBookLoading] = useState(false);
  const [bookErrors, setBookErrors] = useState({});

  // Loading cho nút hoàn thành / hủy
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const fetchSessions = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.sessions.list();
      setSessions(data || []);
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách lịch PT.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAux = async () => {
    try {
      const trs = await api.trainers.list();
      setTrainers(trs || []);
      if (role === 'owner' || role === 'staff') {
        const mems = await api.members.list();
        setMembers(mems || []);
      }
    } catch {
      // bỏ qua
    }
  };

  useEffect(() => {
    fetchSessions();
    fetchAux();
  }, []);

  const handleOpenBook = () => {
    setBookForm({
      memberId: role === 'member' ? String(user.memberId) : (members.length > 0 ? String(members[0].id) : ''),
      ptId: trainers.length > 0 ? String(trainers[0].id) : '',
      date: getVietnamTodayDateString(),
      startTime: '09:00',
      durationMinutes: 60,
      note: '',
    });
    setBookErrors({});
    setIsBookOpen(true);
  };

  const handleBookSubmit = async (e) => {
    e.preventDefault();
    setBookErrors({});

    const errs = {};
    if (!bookForm.memberId) errs.memberId = 'Vui lòng chọn hội viên';
    if (!bookForm.ptId) errs.ptId = 'Vui lòng chọn huấn luyện viên (PT)';
    if (!bookForm.date) errs.date = 'Vui lòng chọn ngày tập';
    if (!bookForm.startTime) errs.startTime = 'Vui lòng chọn giờ bắt đầu';

    const dur = Number(bookForm.durationMinutes);
    if (isNaN(dur) || dur < 30 || dur > 180 || dur % 15 !== 0) {
      errs.durationMinutes = 'Thời lượng phải từ 30 đến 180 phút và chia hết cho 15';
    }

    if (Object.keys(errs).length > 0) {
      setBookErrors(errs);
      return;
    }

    // Tính toán startsAt và endsAt theo giờ Việt Nam
    const [startH, startM] = bookForm.startTime.split(':').map(Number);
    const totalStartMins = startH * 60 + startM;
    const totalEndMins = totalStartMins + dur;

    const endH = Math.floor(totalEndMins / 60);
    const endM = totalEndMins % 60;

    if (endH >= 24) {
      setBookErrors({ startTime: 'Buổi tập phải kết thúc trong cùng ngày' });
      return;
    }

    const pad = (n) => String(n).padStart(2, '0');
    const endTimeStr = `${pad(endH)}:${pad(endM)}`;

    const startsAtIso = vnDateTimeToUtcIso(bookForm.date, bookForm.startTime);
    const endsAtIso = vnDateTimeToUtcIso(bookForm.date, endTimeStr);

    setBookLoading(true);
    try {
      const created = await api.sessions.create({
        memberId: Number(bookForm.memberId),
        ptId: Number(bookForm.ptId),
        startsAt: startsAtIso,
        endsAt: endsAtIso,
        note: bookForm.note.trim() || undefined,
      });

      setIsBookOpen(false);
      setToast({
        type: 'success',
        message: `Đặt lịch thành công: Buổi tập của ${created.memberName} với PT ${created.ptName} lúc ${formatDateTime(created.startsAt)}!`,
      });
      fetchSessions();
    } catch (err) {
      if (err.fields) {
        setBookErrors(err.fields);
      }
      setToast({ type: 'danger', message: err.message || 'Không thể đặt lịch PT.' });
    } finally {
      setBookLoading(false);
    }
  };

  const handleUpdateStatus = async (sessionId, newStatus) => {
    setActionLoadingId(sessionId);
    try {
      await api.sessions.updateStatus(sessionId, newStatus);
      setToast({
        type: 'success',
        message: `Đã ${newStatus === 'completed' ? 'xác nhận hoàn thành' : 'hủy'} buổi tập thành công!`,
      });
      fetchSessions();
    } catch (err) {
      setToast({ type: 'danger', message: err.message || 'Không thể cập nhật trạng thái buổi tập.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div>
      <div className="page-header-row">
        <div>
          <h2 className="page-title">
            {role === 'pt' ? 'Lịch Giảng Dạy Của Bạn (PT)' : (role === 'member' ? 'Lịch Hẹn Tập Với Huấn Luyện Viên' : 'Quản Lý Lịch Huấn Luyện Viên (PT)')}
          </h2>
          <p className="page-subtitle">
            {role === 'pt'
              ? 'Xem các buổi dạy được giao và xác nhận hoàn thành buổi tập với học viên'
              : 'Đặt lịch hẹn tập 1-1 với Huấn luyện viên thể hình chuyên nghiệp'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={fetchSessions}>
            <IconRefreshCw size={14} /> Tải lại
          </button>
          {canBook && (
            <button type="button" className="btn btn-primary btn-sm" onClick={handleOpenBook}>
              <IconPlus size={16} /> Đặt Lịch Buổi Tập Mới
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

      {/* DANH SÁCH LỊCH PT */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Danh Sách Buổi Tập ({sessions.length} buổi)</h3>
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
          ) : sessions.length === 0 ? (
            <EmptyState
              icon={IconCalendar}
              title="Chưa có buổi tập nào"
              message={canBook ? 'Bấm nút Đặt Lịch Buổi Tập Mới để lên lịch hẹn.' : 'Bạn chưa có lịch dạy nào.'}
              actionText={canBook ? '+ Đặt Lịch Buổi Tập Mới' : null}
              onAction={canBook ? handleOpenBook : null}
            />
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Mã số</th>
                    <th>Hội viên</th>
                    <th>Huấn luyện viên (PT)</th>
                    <th>Thời gian bắt đầu</th>
                    <th>Thời gian kết thúc</th>
                    <th>Trạng thái</th>
                    <th>Ghi chú</th>
                    <th style={{ textAlign: 'right' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => {
                    const isBooked = s.status === 'booked';
                    const isActing = actionLoadingId === s.id;

                    // Quyền hoàn thành: Owner, Staff, hoặc PT của buổi này; và đã đến/qua giờ kết thúc
                    const canComplete = isBooked && (role === 'owner' || role === 'staff' || (role === 'pt' && s.ptId === user.id));

                    // Quyền hủy: Owner/Staff, hoặc PT của buổi, hoặc Member của buổi
                    const canCancel = isBooked && (role === 'owner' || role === 'staff' || (role === 'pt' && s.ptId === user.id) || (role === 'member' && s.memberId === user.memberId));

                    return (
                      <tr key={s.id}>
                        <td style={{ color: 'var(--text-secondary)' }}>#{s.id}</td>
                        <td style={{ fontWeight: 600 }}>{s.memberName}</td>
                        <td style={{ fontWeight: 600, color: 'var(--primary-emerald)' }}>{s.ptName}</td>
                        <td>{formatDateTime(s.startsAt)}</td>
                        <td>{formatDateTime(s.endsAt)}</td>
                        <td>
                          <span className={`badge ${s.status === 'booked' ? 'badge-warning' : (s.status === 'completed' ? 'badge-success' : 'badge-danger')}`}>
                            {s.status === 'booked' ? 'Đã lên lịch' : (s.status === 'completed' ? 'Đã hoàn thành' : 'Đã hủy')}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{s.note || '—'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            {canComplete && (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => handleUpdateStatus(s.id, 'completed')}
                                disabled={isActing}
                                title="Xác nhận đã dạy xong buổi này"
                              >
                                <IconCheck size={13} /> Hoàn thành
                              </button>
                            )}
                            {canCancel && (
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => handleUpdateStatus(s.id, 'cancelled')}
                                disabled={isActing}
                                title="Hủy buổi tập"
                              >
                                <IconX size={13} /> Hủy
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODAL ĐẶT LỊCH PT */}
      {canBook && (
        <Modal
          isOpen={isBookOpen}
          onClose={() => setIsBookOpen(false)}
          title="Đặt Lịch Buổi Tập Huấn Luyện Viên (PT)"
          footer={(
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsBookOpen(false)}
                disabled={bookLoading}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleBookSubmit}
                disabled={bookLoading}
              >
                {bookLoading ? 'Đang kiểm tra lịch...' : 'Xác Nhận Đặt Lịch'}
              </button>
            </>
          )}
        >
          <form onSubmit={handleBookSubmit}>
            {/* Chọn hội viên (nếu là Owner/Staff) */}
            {role !== 'member' ? (
              <div className="form-group">
                <label className="form-label" htmlFor="sess-select-member">
                  Chọn hội viên <span className="required">*</span>
                </label>
                <select
                  id="sess-select-member"
                  className={`form-select ${bookErrors.memberId ? 'is-invalid' : ''}`}
                  value={bookForm.memberId}
                  onChange={(e) => setBookForm({ ...bookForm, memberId: e.target.value })}
                  disabled={bookLoading}
                >
                  <option value="">-- Chọn hội viên ({members.length} người) --</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      #{m.id} - {m.fullName} ({m.phone})
                    </option>
                  ))}
                </select>
                {bookErrors.memberId && <InlineError message={bookErrors.memberId} />}
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">Hội viên:</label>
                <div style={{ fontWeight: 600 }}>{user.fullName} (Bạn)</div>
              </div>
            )}

            {/* Chọn Huấn luyện viên (PT) */}
            <div className="form-group">
              <label className="form-label" htmlFor="sess-select-pt">
                Chọn Huấn luyện viên (PT) <span className="required">*</span>
              </label>
              <select
                id="sess-select-pt"
                className={`form-select ${bookErrors.ptId ? 'is-invalid' : ''}`}
                value={bookForm.ptId}
                onChange={(e) => setBookForm({ ...bookForm, ptId: e.target.value })}
                disabled={bookLoading}
              >
                <option value="">-- Chọn Huấn luyện viên ({trainers.length} PT) --</option>
                {trainers.map((t) => (
                  <option key={t.id} value={t.id}>
                    HLV #{t.id} - {t.fullName}
                  </option>
                ))}
              </select>
              {bookErrors.ptId && <InlineError message={bookErrors.ptId} />}
            </div>

            {/* Chọn Ngày tập */}
            <div className="form-group">
              <label className="form-label" htmlFor="sess-date">
                Ngày tập (giờ Việt Nam) <span className="required">*</span>
              </label>
              <input
                id="sess-date"
                type="date"
                className={`form-input ${bookErrors.date ? 'is-invalid' : ''}`}
                value={bookForm.date}
                onChange={(e) => setBookForm({ ...bookForm, date: e.target.value })}
                disabled={bookLoading}
              />
              {bookErrors.date && <InlineError message={bookErrors.date} />}
            </div>

            {/* Giờ bắt đầu và thời lượng */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="sess-start-time">
                  Giờ bắt đầu (phút chia hết cho 15) <span className="required">*</span>
                </label>
                <input
                  id="sess-start-time"
                  type="time"
                  step="900"
                  className={`form-input ${bookErrors.startTime ? 'is-invalid' : ''}`}
                  value={bookForm.startTime}
                  onChange={(e) => setBookForm({ ...bookForm, startTime: e.target.value })}
                  disabled={bookLoading}
                />
                {bookErrors.startTime && <InlineError message={bookErrors.startTime} />}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="sess-duration">
                  Thời lượng <span className="required">*</span>
                </label>
                <select
                  id="sess-duration"
                  className={`form-select ${bookErrors.durationMinutes ? 'is-invalid' : ''}`}
                  value={bookForm.durationMinutes}
                  onChange={(e) => setBookForm({ ...bookForm, durationMinutes: Number(e.target.value) })}
                  disabled={bookLoading}
                >
                  <option value={30}>30 phút</option>
                  <option value={45}>45 phút</option>
                  <option value={60}>60 phút (1 tiếng)</option>
                  <option value={90}>90 phút (1.5 tiếng)</option>
                  <option value={120}>120 phút (2 tiếng)</option>
                  <option value={180}>180 phút (3 tiếng)</option>
                </select>
                {bookErrors.durationMinutes && <InlineError message={bookErrors.durationMinutes} />}
              </div>
            </div>

            {/* Ghi chú */}
            <div className="form-group">
              <label className="form-label" htmlFor="sess-note">
                Ghi chú bài tập (tối đa 500 ký tự)
              </label>
              <textarea
                id="sess-note"
                rows="2"
                className="form-textarea"
                placeholder="VD: Tập nhóm cơ ngực & vai, mang theo khăn lau..."
                value={bookForm.note}
                onChange={(e) => setBookForm({ ...bookForm, note: e.target.value })}
                disabled={bookLoading}
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
