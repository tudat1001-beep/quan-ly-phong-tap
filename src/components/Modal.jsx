import React, { useEffect, useRef } from 'react';
import { IconX } from '../icons.jsx';

export function Modal({ isOpen, onClose, title, children, footer = null, maxWidth = '520px' }) {
  const modalRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const focusable = () => modalRef.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])') || [];
    requestAnimationFrame(() => focusable()[0]?.focus());
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      } else if (e.key === 'Tab') {
        const items = focusable();
        if (!items.length) return;
        if (e.shiftKey && document.activeElement === items[0]) {
          e.preventDefault();
          items[items.length - 1].focus();
        } else if (!e.shiftKey && document.activeElement === items[items.length - 1]) {
          e.preventDefault();
          items[0].focus();
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="modal-content" style={{ maxWidth }} ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header">
          <h3 id="modal-title" className="modal-title">{title}</h3>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Đóng cửa sổ">
            <IconX size={18} />
          </button>
        </div>
        <div className="modal-body">
          {children}
        </div>
        {footer && (
          <div className="modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
