import React from 'react';
import { Button } from '@/components/ui/button';

export default function ConfirmModal({ open, title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel, destructive }) {
  if (!open) return null;
  return (
    <div className="mx-4 mt-2 mb-4 bg-card border border-border rounded-2xl p-4">
      <h3 className="font-heading font-bold text-sm mb-1">{title}</h3>
      {description && <p className="text-xs text-muted-foreground leading-relaxed mb-4">{description}</p>}
      <div className="flex gap-3 mt-3">
        <Button variant="outline" onClick={onCancel} className="flex-1 rounded-xl h-10">{cancelLabel}</Button>
        <Button
          onClick={onConfirm}
          className={`flex-1 rounded-xl h-10 ${destructive ? 'bg-destructive text-white hover:bg-destructive/90 border border-destructive' : 'bg-accent text-accent-foreground hover:bg-accent/90'}`}
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
