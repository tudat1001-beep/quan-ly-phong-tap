import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import { Sidebar } from './components/Sidebar.jsx';
import { TopBar } from './components/TopBar.jsx';
import { LoginView } from './views/LoginView.jsx';
import { DashboardView } from './views/DashboardView.jsx';
import { AttendanceView } from './views/AttendanceView.jsx';
import { MembersView } from './views/MembersView.jsx';
import { MembershipsView } from './views/MembershipsView.jsx';
import { PackagesView } from './views/PackagesView.jsx';
import { PaymentsView } from './views/PaymentsView.jsx';
import { SessionsView } from './views/SessionsView.jsx';
import { ChangePasswordModal } from './views/ChangePasswordModal.jsx';

export function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentView, setCurrentView] = useState('dashboard');

  // Điều khiển modal đổi mật khẩu
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  // Điều khiển sidebar trên mobile
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Tham số liên kết nhanh giữa các trang
  const [quickMembershipMemberId, setQuickMembershipMemberId] = useState(null);
  const [quickPaymentMembership, setQuickPaymentMembership] = useState(null);

  // Kiểm tra phiên đăng nhập ban đầu
  useEffect(() => {
    async function checkSession() {
      try {
        const data = await api.auth.me();
        if (data && data.user) {
          setUser(data.user);
        }
      } catch {
        setUser(null);
      } finally {
        setAuthLoading(false);
      }
    }
    checkSession();
  }, []);

  const handleLoginSuccess = (loggedInUser) => {
    setUser(loggedInUser);
    setCurrentView('dashboard');
  };

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // bỏ qua lỗi logout
    }
    setUser(null);
    setCurrentView('dashboard');
  };

  const handlePasswordChanged = () => {
    setUser(null);
    setCurrentView('dashboard');
  };

  // Chuyển hướng tắt từ danh sách hội viên sang trang bán thẻ
  const handleOpenMembershipModal = (memberId) => {
    setQuickMembershipMemberId(memberId);
    setCurrentView('memberships');
  };

  // Chuyển hướng tắt từ trang thẻ sang trang thu tiền
  const handleOpenPaymentModal = (membership) => {
    setQuickPaymentMembership(membership);
    setCurrentView('payments');
  };

  // Tiêu đề trang tương ứng
  const viewTitles = {
    dashboard: 'Bảng Điều Khiển Tổng Quan',
    attendance: user?.role === 'member' ? 'Lịch Sử Điểm Danh' : 'Trạm Điểm Danh Quầy Lễ Tân',
    members: 'Quản Lý Hồ Sơ Hội Viên',
    memberships: user?.role === 'member' ? 'Thẻ Tập Của Tôi' : 'Quản Lý Thẻ Hội Viên',
    packages: 'Danh Mục Gói Tập & Bảng Giá',
    payments: user?.role === 'member' ? 'Lịch Sử Nộp Tiền' : 'Sổ Thu Tiền & Hóa Đơn (VND)',
    sessions: user?.role === 'pt' ? 'Lịch Dạy Huấn Luyện Viên' : (user?.role === 'member' ? 'Lịch Tập Với PT' : 'Quản Lý Lịch Huấn Luyện Viên (PT)'),
  };

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', color: '#ffffff' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>GYM MANAGEMENT SYSTEM</div>
          <div style={{ fontSize: '13px', color: '#94a3b8' }}>Đang kiểm tra phiên làm việc...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  // Bảo vệ view theo quyền: nếu view hiện tại không hợp lệ với vai trò, fallback về dashboard
  const allowedViewsByRole = {
    owner: ['dashboard', 'attendance', 'members', 'memberships', 'packages', 'payments', 'sessions'],
    staff: ['dashboard', 'attendance', 'members', 'memberships', 'packages', 'payments', 'sessions'],
    pt: ['dashboard', 'packages', 'sessions'],
    member: ['dashboard', 'attendance', 'memberships', 'packages', 'payments', 'sessions'],
  };

  const allowedViews = allowedViewsByRole[user.role] || ['dashboard'];
  const activeView = allowedViews.includes(currentView) ? currentView : 'dashboard';

  return (
    <div className="app-container">
      <Sidebar
        user={user}
        currentView={activeView}
        onViewChange={(v) => {
          setQuickMembershipMemberId(null);
          setQuickPaymentMembership(null);
          setCurrentView(v);
        }}
        onLogout={handleLogout}
        onChangePasswordClick={() => setIsPasswordModalOpen(true)}
        isOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      <div className="app-main">
        <TopBar
          title={viewTitles[activeView] || 'Quản Lý Phòng Tập'}
          onToggleMobileMenu={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        />

        <main className="content-body">
          {activeView === 'dashboard' && (
            <DashboardView user={user} onNavigate={(v) => setCurrentView(v)} />
          )}

          {activeView === 'attendance' && (
            <AttendanceView user={user} />
          )}

          {activeView === 'members' && (
            <MembersView onOpenMembershipModal={handleOpenMembershipModal} />
          )}

          {activeView === 'memberships' && (
            <MembershipsView
              user={user}
              preselectedMemberId={quickMembershipMemberId}
              onOpenPaymentModal={handleOpenPaymentModal}
            />
          )}

          {activeView === 'packages' && (
            <PackagesView user={user} />
          )}

          {activeView === 'payments' && (
            <PaymentsView
              user={user}
              preselectedMembership={quickPaymentMembership}
            />
          )}

          {activeView === 'sessions' && (
            <SessionsView user={user} />
          )}
        </main>
      </div>

      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        onPasswordChanged={handlePasswordChanged}
      />
    </div>
  );
}
