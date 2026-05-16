import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content slide-in" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}
