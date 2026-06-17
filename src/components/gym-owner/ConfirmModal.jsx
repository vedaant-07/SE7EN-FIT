import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ConfirmModal({ open, title, message, confirmLabel = 'Confirm', confirmClass = 'bg-red-500 text-white', onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-card border border-border rounded-t-3xl sm:rounded-3xl w-full max-w-sm mx-auto p-6 z-10 animate-in slide-in-from-bottom-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-red-500/15 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={18} className="text-red-400" />
          </div>
          <div className="flex-1">
            <p className="font-heading font-bold text-sm">{title}</p>
          </div>
          <button onClick={onCancel} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
            <X size={14} />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-5">{message}</p>
        <div className="flex gap-2.5">
          <button onClick={onCancel} className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-all">
            Cancel
          </button>
          <button onClick={onConfirm} className={`flex-1 h-11 rounded-xl text-sm font-semibold transition-all ${confirmClass}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}