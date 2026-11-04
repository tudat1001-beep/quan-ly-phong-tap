import React from 'react';
import {
  IconDumbbell,
  IconLayoutDashboard,
  IconCheckSquare,
  IconUsers,
  IconCreditCard,
  IconPackage,
  IconDollarSign,
  IconCalendar,
  IconLogOut,
  IconKeyRound,
} from '../icons.jsx';

export function Sidebar({ user, currentView, onViewChange, onLogout, onChangePasswordClick, isOpen, onCloseMobile }) {
  if (!user) return null;

  const role = user.role;

  // Xây dựng danh sách menu theo vai trò
  const navItems = [
    { id: 'dashboard', label: 'Tổng Quan', icon: IconLayoutDashboard, roles: ['owner', 'staff', 'pt', 'member'] },
    { id: 'attendance', label: role === 'member' ? 'Lịch Sử Điểm Danh' : 'Điểm Danh Quầy', icon: IconCheckSquare, roles: ['owner', 'staff', 'member'] },
    { id: 'members', label: 'Quản Lý Hội Viên', icon: IconUsers, roles: ['owner', 'staff'] },
    { id: 'memberships', label: role === 'member' ? 'Thẻ Tập Của Tôi' : 'Thẻ Hội Viên', icon: IconCreditCard, roles: ['owner', 'staff', 'member'] },
    { id: 'packages', label: 'Gói Tập & Dịch Vụ', icon: IconPackage, roles: ['owner', 'staff', 'pt', 'member'] },
    { id: 'payments', label: role === 'member' ? 'Lịch Sử Nộp Tiền' : 'Sổ Thu VND', icon: IconDollarSign, roles: ['owner', 'staff', 'member'] },
    { id: 'sessions', label: role === 'pt' ? 'Lịch Dạy PT' : (role === 'member' ? 'Lịch Buổi Tập PT' : 'Lịch Huấn Luyện Viên'), icon: IconCalendar, roles: ['owner', 'staff', 'pt', 'member'] },
  ];

  const visibleNavs = navItems.filter((item) => item.roles.includes(role));

  const roleNames = {
    owner: 'Chủ phòng tập',
    staff: 'Nhân viên quầy',
    pt: 'Huấn luyện viên',
    member: 'Hội viên',
  };

  const handleNavClick = (id) => {
    onViewChange(id);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {isOpen && <div className="sidebar-backdrop" onClick={onCloseMobile} />}
      <aside className={`app-sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div className="brand-badge">
            <div className="brand-icon">
              <IconDumbbell size={20} />
            </div>
            <div>
              <div className="brand-text">GYM MASTER</div>
              <div className="brand-subtitle">Fitness Management</div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-title">Chức năng chính</div>
          {visibleNavs.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => handleNavClick(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile-card">
            <div className="user-avatar-circle">
              {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="user-info">
              <div className="user-name" title={user.fullName}>{user.fullName}</div>
              <div className="user-role-badge">{roleNames[user.role] || user.role}</div>
            </div>
          </div>

          <div className="sidebar-footer-actions">
            <button
              type="button"
              className="btn-sidebar-action"
              onClick={onChangePasswordClick}
              title="Đổi mật khẩu"
            >
              <IconKeyRound size={14} />
              <span>Đổi MK</span>
            </button>
            <button
              type="button"
              className="btn-sidebar-action"
              onClick={onLogout}
              title="Đăng xuất"
            >
              <IconLogOut size={14} />
              <span>Thoát</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
