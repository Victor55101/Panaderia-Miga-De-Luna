import React, { createContext, useContext, useState, useCallback } from 'react';

const ConfirmDialogContext = createContext();

export function useConfirmDialog() {
  const context = useContext(ConfirmDialogContext);
  if (!context) {
    throw new Error('useConfirmDialog debe ser usado dentro de un ConfirmDialogProvider');
  }
  return context;
}

export function ConfirmDialogProvider({ children }) {
  const [dialogConfig, setDialogConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    onCancel: null,
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    type: 'warning' // warning, danger, info
  });

  const confirm = useCallback(({ title, message, confirmText = 'Confirmar', cancelText = 'Cancelar', type = 'warning' }) => {
    return new Promise((resolve) => {
      setDialogConfig({
        isOpen: true,
        title,
        message,
        confirmText,
        cancelText,
        type,
        onConfirm: () => {
          setDialogConfig((prev) => ({ ...prev, isOpen: false }));
          resolve(true);
        },
        onCancel: () => {
          setDialogConfig((prev) => ({ ...prev, isOpen: false }));
          resolve(false);
        }
      });
    });
  }, []);

  return (
    <ConfirmDialogContext.Provider value={{ confirm }}>
      {children}
      {dialogConfig.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>{dialogConfig.title}</h3>
            </div>
            <div className="modal-body">
              <p>{dialogConfig.message}</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={dialogConfig.onCancel}>
                {dialogConfig.cancelText}
              </button>
              <button 
                className={`btn ${dialogConfig.type === 'danger' ? 'btn-danger' : 'btn-primary'}`} 
                onClick={dialogConfig.onConfirm}
              >
                {dialogConfig.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmDialogContext.Provider>
  );
}
