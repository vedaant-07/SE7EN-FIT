import React from 'react';

export default function ConfirmModal({ open, title, message, confirmLabel = 'Confirm', confirmClass = 'bg-red-500 text-white', onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="mx-4 mt-2 mb-4 bg-card border border-border rounded-2xl p-4">
      <p className="font-heading font-bold text-sm mb-1">{title}</p>
      <p className="text-xs text-muted-foreground mb-4">{message}</p>
      <div className="flex gap-2.5">
        <button onClick={onCancel} className="flex-1 h-10 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-all">
          Cancel
        </button>
        <button onClick={onConfirm} className={`flex-1 h-10 rounded-xl text-sm font-semibold transition-all ${confirmClass}`}>
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}