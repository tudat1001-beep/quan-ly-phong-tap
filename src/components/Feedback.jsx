import React from 'react';
import { IconAlertCircle, IconCheck, IconPackage } from '../icons.jsx';

export function AlertBanner({ type = 'info', message, onClose = null }) {
  if (!message) return null;

  const icon = type === 'success' ? <IconCheck size={18} /> : <IconAlertCircle size={18} />;

  return (
    <div className={`alert-banner alert-${type}`} role="alert">
      <div style={{ flexShrink: 0, marginTop: '2px' }}>{icon}</div>
      <div style={{ flex: 1, wordBreak: 'break-word' }}>{message}</div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'inherit' }}
          aria-label="Đóng thông báo"
        >
          ×
        </button>
      )}
    </div>
  );
}

export function InlineError({ message }) {
  if (!message) return null;
  return (
    <div className="form-error-msg" role="alert">
      <IconAlertCircle size={14} />
      <span>{message}</span>
    </div>
  );
}

export function EmptyState({ icon: Icon = IconPackage, title, message, actionText, onAction }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <Icon size={24} />
      </div>
      <div className="empty-state-title">{title}</div>
      {message && <div className="empty-state-text">{message}</div>}
      {actionText && onAction && (
        <button type="button" className="btn btn-primary btn-sm" onClick={onAction}>
          {actionText}
        </button>
      )}
    </div>
  );
}

export function SkeletonRow({ cols = 5 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i}>
          <div className="skeleton-box" style={{ height: '18px', width: i === 0 ? '60%' : '80%' }} />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonCards({ count = 4 }) {
  return (
    <div className="kpi-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="kpi-card">
          <div className="skeleton-box" style={{ height: '14px', width: '50%', marginBottom: '12px' }} />
          <div className="skeleton-box" style={{ height: '28px', width: '70%', marginBottom: '8px' }} />
          <div className="skeleton-box" style={{ height: '12px', width: '40%' }} />
        </div>
      ))}
    </div>
  );
}
