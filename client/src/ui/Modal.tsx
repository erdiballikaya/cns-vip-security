import React from "react";
import "../styles/modal.css"; // CSS dosyasını içe aktarıyoruz

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: "md" | "lg";
}

export default function Modal({ title, onClose, children, size = "md" }: ModalProps) {
  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div 
        className={`modal-container modal-${size}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button 
            className="modal-close-btn" 
            onClick={onClose} 
            aria-label="Kapat"
          >
            ✕
          </button>
        </header>

        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}
