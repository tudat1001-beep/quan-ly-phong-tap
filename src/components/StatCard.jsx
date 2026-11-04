import React from 'react';

export function StatCard({ title, value, meta, icon: Icon, isWarning = false }) {
  return (
    <div className={`kpi-card ${isWarning ? 'kpi-warning' : ''}`}>
      <div className="kpi-header">
        <span className="kpi-title">{title}</span>
        {Icon && (
          <div className="kpi-icon-wrap">
            <Icon size={18} />
          </div>
        )}
      </div>
      <div className="kpi-value">{value}</div>
      {meta && <div className="kpi-meta">{meta}</div>}
    </div>
  );
}
