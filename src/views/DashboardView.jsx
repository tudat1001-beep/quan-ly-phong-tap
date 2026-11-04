import React, { useEffect, useState } from 'react';
import { api, formatVnd, formatDateTime, formatDate } from '../api.js';
import { StatCard } from '../components/StatCard.jsx';
import { AlertBanner, EmptyState, SkeletonCards } from '../components/Feedback.jsx';
import {
  IconUsers,
  IconCreditCard,
  IconCheckSquare,
  IconCalendar,
  IconDollarSign,
  IconAlertCircle,
  IconRefreshCw,
  IconPackage,
} from '../icons.jsx';

export function DashboardView({ user, onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.dashboard.get();
      setData(res);
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu bảng điều khiển.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div>
        <div className="page-header-row">
          <div>
            <h2 className="page-title">Bảng Điều Khiển Tổng Quan</h2>
            <p className="page-subtitle">Đang tải số liệu thời gian thực...</p>
          </div>
        </div>
        <SkeletonCards count={4} />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="page-header-row">
          <h2 className="page-title">Bảng Điều Khiển Tổng Quan</h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={fetchDashboard}>
            <IconRefreshCw size={14} /> Thử lại
          </button>
        </div>
        <AlertBanner type="danger" message={error} />
      </div>
    );
  }

  if (!data) return null;

  const role = user.role;

  return (
    <div>
      <div className="page-header-row">
        <div>
          <h2 className="page-title">
            {role === 'owner' || role === 'staff'
              ? 'Tổng Quan Vận Hành Phòng Tập'
              : (role === 'pt' ? 'Góc Làm Việc Huấn Luyện Viên' : 'Trang Tập Luyện Cá Nhân')}
          </h2>
          <p className="page-subtitle">Xin chào, {user.fullName}! Dưới đây là thông tin cập nhật mới nhất.</p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={fetchDashboard}>
          <IconRefreshCw size={14} /> Làm mới
        </button>
      </div>

      {/* DASHBOARD CHO CHỦ PHÒNG HOẶC LỄ TÂN */}
      {(role === 'owner' || role === 'staff') && (
        <>
          <div className="kpi-grid">
            <StatCard
              title="Tổng Số Hội Viên"
              value={data.totalMembers || 0}
              meta="Hội viên đã đăng ký"
              icon={IconUsers}
            />
            <StatCard
              title="Thẻ Đang Hoạt Động"
              value={data.activeMemberships || 0}
              meta="Đủ điều kiện vào phòng"
              icon={IconCreditCard}
            />
            <StatCard
              title="Thẻ Sắp Hết Hạn"
              value={data.expiringSoonCount || 0}
              meta="Hết hạn trong 7 ngày tới"
              icon={IconAlertCircle}
              isWarning={data.expiringSoonCount > 0}
            />
            <StatCard
              title="Lượt Check-in Hôm Nay"
              value={data.todayCheckIns || 0}
              meta="Ghi nhận tại quầy hôm nay"
              icon={IconCheckSquare}
            />
          </div>

          <div className="kpi-grid">
            <StatCard
              title="Doanh Thu Hôm Nay"
              value={formatVnd(data.revenueTodayVnd || 0)}
              meta="Tổng các phiếu thu trong ngày"
              icon={IconDollarSign}
            />
            <StatCard
              title="Doanh Thu Tháng Này"
              value={formatVnd(data.revenueMonthVnd || 0)}
              meta="Tính từ đầu tháng đến nay"
              icon={IconDollarSign}
            />
            <StatCard
              title="Tổng Công Nợ Thẻ"
              value={formatVnd(data.outstandingVnd || 0)}
              meta="Số tiền hội viên còn nợ"
              icon={IconDollarSign}
              isWarning={data.outstandingVnd > 0}
            />
            <StatCard
              title="Lịch PT Trong Ngày"
              value={data.todaySessions || 0}
              meta="Buổi tập lên lịch hôm nay"
              icon={IconCalendar}
            />
          </div>

          {/* Buổi PT sắp diễn ra */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Các Buổi PT Sắp Diễn Ra</h3>
              {onNavigate && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('sessions')}>
                  Xem tất cả lịch PT
                </button>
              )}
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {(!data.upcomingSessions || data.upcomingSessions.length === 0) ? (
                <EmptyState
                  title="Không có buổi PT nào sắp tới"
                  message="Hiện chưa có lịch hẹn PT nào được lên lịch cho thời gian tới."
                />
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Hội viên</th>
                        <th>Huấn luyện viên (PT)</th>
                        <th>Thời gian bắt đầu</th>
                        <th>Trạng thái</th>
                        <th>Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.upcomingSessions.map((s) => (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 600 }}>{s.memberName}</td>
                          <td>{s.ptName}</td>
                          <td>{formatDateTime(s.startsAt)}</td>
                          <td>
                            <span className={`badge ${s.status === 'booked' ? 'badge-warning' : (s.status === 'completed' ? 'badge-success' : 'badge-danger')}`}>
                              {s.status === 'booked' ? 'Đã đặt' : (s.status === 'completed' ? 'Hoàn thành' : 'Đã hủy')}
                            </span>
                          </td>
                          <td style={{ color: 'var(--text-secondary)' }}>{s.note || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* DASHBOARD CHO HUẤN LUYỆN VIÊN (PT) */}
      {role === 'pt' && (
        <>
          <div className="kpi-grid">
            <StatCard
              title="Buổi Dạy Hôm Nay"
              value={data.todaySessions || 0}
              meta="Lịch dạy trong ngày của bạn"
              icon={IconCalendar}
            />
            <StatCard
              title="Buổi Đã Hoàn Thành Tháng Này"
              value={data.completedSessionsThisMonth || 0}
              meta="Tổng buổi dạy thành công"
              icon={IconCheckSquare}
            />
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Lịch Dạy Sắp Tới Của Bạn</h3>
              {onNavigate && (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => onNavigate('sessions')}>
                  Đi đến Lịch Dạy
                </button>
              )}
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {(!data.upcomingSessions || data.upcomingSessions.length === 0) ? (
                <EmptyState
                  title="Chưa có buổi dạy sắp tới"
                  message="Bạn hiện không có lịch dạy nào đang chờ trong danh sách."
                />
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Học viên</th>
                        <th>Thời gian bắt đầu</th>
                        <th>Thời gian kết thúc</th>
                        <th>Trạng thái</th>
                        <th>Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.upcomingSessions.map((s) => (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 600 }}>{s.memberName}</td>
                          <td>{formatDateTime(s.startsAt)}</td>
                          <td>{formatDateTime(s.endsAt)}</td>
                          <td>
                            <span className="badge badge-warning">Đã đặt</span>
                          </td>
                          <td style={{ color: 'var(--text-secondary)' }}>{s.note || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* DASHBOARD CHO HỘI VIÊN (MEMBER) */}
      {role === 'member' && (
        <>
          <div className="kpi-grid">
            <StatCard
              title="Điểm Danh Hôm Nay"
              value={data.todayCheckedIn ? 'ĐÃ VÀO TẬP' : 'CHƯA CHECK-IN'}
              meta={data.todayCheckedIn ? 'Chúc bạn buổi tập tràn đầy năng lượng!' : 'Đến quầy lễ tân để quét thẻ'}
              icon={IconCheckSquare}
              isWarning={!data.todayCheckedIn}
            />
            <StatCard
              title="Công Nợ Cần Thanh Toán"
              value={formatVnd(data.outstandingVnd || 0)}
              meta={data.outstandingVnd > 0 ? 'Vui lòng nộp tiền tại quầy' : 'Đã thanh toán đủ'}
              icon={IconDollarSign}
              isWarning={data.outstandingVnd > 0}
            />
          </div>

          {/* Thẻ hội viên hiện tại */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Thẻ Hội Viên Của Bạn</h3>
              {onNavigate && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('memberships')}>
                  Xem lịch sử thẻ
                </button>
              )}
            </div>
            <div className="card-body">
              {!data.membership ? (
                <EmptyState
                  icon={IconCreditCard}
                  title="Bạn chưa có thẻ hội viên hợp lệ"
                  message="Vui lòng liên hệ quầy lễ tân để đăng ký gói tập phù hợp."
                />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Gói tập:</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--primary-emerald)' }}>
                      {data.membership.packageName}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Thời hạn hiệu lực:</div>
                    <div style={{ fontWeight: 600 }}>
                      {formatDate(data.membership.startDate)} → {formatDate(data.membership.endDate)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Trạng thái:</div>
                    <div>
                      <span className={`badge ${data.membership.status === 'active' ? 'badge-success' : (data.membership.status === 'upcoming' ? 'badge-warning' : 'badge-danger')}`}>
                        {data.membership.status === 'active' ? 'Đang hoạt động' : (data.membership.status === 'upcoming' ? 'Sắp có hiệu lực' : 'Đã hết hạn')}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Tiền gói / Đã nộp:</div>
                    <div style={{ fontWeight: 600 }}>
                      {formatVnd(data.membership.paidVnd)} / {formatVnd(data.membership.priceVnd)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Buổi PT sắp tới của hội viên */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Lịch Hẹn PT Của Bạn</h3>
              {onNavigate && (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => onNavigate('sessions')}>
                  Đặt lịch tập mới
                </button>
              )}
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {(!data.upcomingSessions || data.upcomingSessions.length === 0) ? (
                <EmptyState
                  icon={IconCalendar}
                  title="Chưa có lịch hẹn PT"
                  message="Bạn chưa đặt buổi tập nào với Huấn luyện viên."
                />
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Huấn luyện viên (PT)</th>
                        <th>Bắt đầu</th>
                        <th>Kết thúc</th>
                        <th>Trạng thái</th>
                        <th>Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.upcomingSessions.map((s) => (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 600 }}>{s.ptName}</td>
                          <td>{formatDateTime(s.startsAt)}</td>
                          <td>{formatDateTime(s.endsAt)}</td>
                          <td>
                            <span className="badge badge-warning">Đã đặt</span>
                          </td>
                          <td style={{ color: 'var(--text-secondary)' }}>{s.note || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
