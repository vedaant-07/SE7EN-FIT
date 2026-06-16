import React from 'react';
import { Button } from '@/components/ui/button';

export default function ConfirmModal({ open, title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel, destructive }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="bg-card border border-border rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="font-heading font-bold text-base mb-2">{title}</h3>
        {description && <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>}
        <div className="flex gap-3 mt-5">
          <Button variant="outline" onClick={onCancel} className="flex-1 rounded-xl h-11">{cancelLabel}</Button>
          <Button
            onClick={onConfirm}
            className={`flex-1 rounded-xl h-11 ${destructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'bg-accent text-accent-foreground hover:bg-accent/90'}`}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}