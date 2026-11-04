import React from 'react';
import { IconMenu, IconCalendar } from '../icons.jsx';
import { formatDate, getVietnamTodayDateString } from '../api.js';

export function TopBar({ title, onToggleMobileMenu }) {
  const todayVn = getVietnamTodayDateString();

  return (
    <header className="app-topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={onToggleMobileMenu}
          aria-label="Mở bảng điều hướng"
        >
          <IconMenu size={22} />
        </button>
        <h1 className="topbar-title">{title}</h1>
      </div>
      <div className="topbar-right">
        <div className="date-indicator" title="Ngày làm việc theo giờ Việt Nam (UTC+7)">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <IconCalendar size={14} />
            Hôm nay: {formatDate(todayVn)}
          </span>
        </div>
      </div>
    </header>
  );
}
