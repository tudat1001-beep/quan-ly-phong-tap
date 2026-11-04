import React, { useEffect, useState } from 'react';
import { api, formatDate, formatDateTime, getVietnamTodayDateString } from '../api.js';
import { AlertBanner, EmptyState, SkeletonRow } from '../components/Feedback.jsx';
import { IconCheckSquare, IconSearch, IconRefreshCw } from '../icons.jsx';

export function AttendanceView({ user }) {
  const isStaffOrOwner = user.role === 'owner' || user.role === 'staff';

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Trạng thái cho nhân viên check-in
  const [members, setMembers] = useState([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type, message }

  const fetchAttendance = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.attendance.list();
      setRecords(data || []);
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách điểm danh.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    if (!isStaffOrOwner) return;
    try {
      const data = await api.members.list();
      setMembers(data || []);
    } catch {
      // bỏ qua
    }
  };

  useEffect(() => {
    fetchAttendance();
    fetchMembers();
  }, []);

  const handleCheckInSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMemberId) {
      setFeedback({ type: 'danger', message: 'Vui lòng chọn hoặc nhập hội viên để điểm danh.' });
      return;
    }

    setCheckInLoading(true);
    setFeedback(null);

    try {
      const res = await api.attendance.checkIn({
        memberId: Number(selectedMemberId),
      });

      const todayStr = getVietnamTodayDateString();
      if (res.date === todayStr) {
        setFeedback({
          type: 'success',
          message: `Check-in thành công cho hội viên: ${res.memberName} (Mã #${res.memberId}) vào lúc ${formatDateTime(res.checkedInAt)}!`,
        });
      } else {
        setFeedback({
          type: 'info',
          message: `Ghi nhận lượt vào cho ${res.memberName}.`,
        });
      }

      // Làm mới danh sách điểm danh
      fetchAttendance();
      setSelectedMemberId('');
      setMemberSearchQuery('');
    } catch (err) {
      setFeedback({
        type: 'danger',
        message: err.message || 'Điểm danh không thành công.',
      });
    } finally {
      setCheckInLoading(false);
    }
  };

  // Lọc danh sách hội viên cho dropdown / gợi ý
  const filteredMembers = members.filter((m) => {
    if (!memberSearchQuery) return true;
    const q = memberSearchQuery.toLowerCase();
    return (
      m.fullName.toLowerCase().includes(q) ||
      m.phone.includes(q) ||
      m.login.toLowerCase().includes(q) ||
      String(m.id).includes(q)
    );
  });

  return (
    <div>
      <div className="page-header-row">
        <div>
          <h2 className="page-title">
            {isStaffOrOwner ? 'Trạm Điểm Danh Quầy Lễ Tân' : 'Lịch Sử Điểm Danh Vào Tập'}
          </h2>
          <p className="page-subtitle">
            {isStaffOrOwner
              ? 'Xác nhận hội viên vào phòng tập trong ngày và kiểm tra hiệu lực thẻ'
              : 'Theo dõi nhật ký các ngày bạn đã đến phòng tập'}
          </p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={fetchAttendance}>
          <IconRefreshCw size={14} /> Làm mới
        </button>
      </div>

      {feedback && (
        <AlertBanner
          type={feedback.type}
          message={feedback.message}
          onClose={() => setFeedback(null)}
        />
      )}

      {error && <AlertBanner type="danger" message={error} />}

      {/* KHỐI CHECK-IN TỐC ĐỘ CAO CHO NHÂN VIÊN */}
      {isStaffOrOwner && (
        <div className="checkin-hero-box">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconCheckSquare size={22} style={{ color: 'var(--primary-emerald)' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Điểm Danh Nhanh Hội Viên</h3>
          </div>
          <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
            Chọn hội viên còn hạn thẻ để ghi nhận lượt vào tập hôm nay (Mỗi hội viên 1 lượt/ngày).
          </p>

          <form onSubmit={handleCheckInSubmit} className="checkin-form-row">
            <div style={{ flex: 1, minWidth: '220px' }}>
              <input
                type="text"
                className="checkin-input"
                placeholder="Tìm tên, SĐT hoặc mã hội viên..."
                value={memberSearchQuery}
                onChange={(e) => {
                  setMemberSearchQuery(e.target.value);
                  setSelectedMemberId('');
                }}
              />
            </div>

            <div style={{ flex: 1.5, minWidth: '240px' }}>
              <select
                className="form-select"
                style={{ height: '48px', fontSize: '14px', backgroundColor: '#0f172a', color: '#ffffff', borderColor: '#334155' }}
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
              >
                <option value="">-- Chọn hội viên ({filteredMembers.length} người) --</option>
                {filteredMembers.slice(0, 30).map((m) => (
                  <option key={m.id} value={m.id}>
                    #{m.id} - {m.fullName} ({m.phone}) - @{m.login}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ minHeight: '48px', padding: '0 24px', fontSize: '15px' }}
              disabled={checkInLoading || !selectedMemberId}
            >
              {checkInLoading ? 'Đang kiểm tra thẻ...' : 'Xác Nhận Vào Tập'}
            </button>
          </form>
        </div>
      )}

      {/* BẢNG LỊCH SỬ ĐIỂM DANH */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Nhật Ký Điểm Danh ({records.length} lượt)</h3>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div className="table-responsive">
              <table className="data-table">
                <tbody>
                  <SkeletonRow cols={4} />
                  <SkeletonRow cols={4} />
                  <SkeletonRow cols={4} />
                </tbody>
              </table>
            </div>
          ) : records.length === 0 ? (
            <EmptyState
              icon={IconCheckSquare}
              title="Chưa có lượt điểm danh nào"
              message="Các lượt vào phòng tập sẽ hiển thị tại bảng này."
            />
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Mã lượt</th>
                    <th>Hội viên</th>
                    <th>Ngày tập</th>
                    <th>Thời gian check-in</th>
                    {isStaffOrOwner && <th>Người ghi nhận</th>}
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id}>
                      <td style={{ color: 'var(--text-secondary)' }}>#{r.id}</td>
                      <td style={{ fontWeight: 600 }}>{r.memberName} (Mã #{r.memberId})</td>
                      <td>{formatDate(r.date)}</td>
                      <td>{formatDateTime(r.checkedInAt)}</td>
                      {isStaffOrOwner && (
                        <td style={{ color: 'var(--text-secondary)' }}>Nhân viên ID #{r.checkedInBy}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
