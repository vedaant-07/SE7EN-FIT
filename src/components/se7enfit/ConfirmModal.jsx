import React from 'react';
import { Button } from '@/components/ui/button';

export default function ConfirmModal({ open, title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel, destructive }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-5">
      <div className="w-full max-w-sm bg-card border border-border rounded-3xl p-5 shadow-2xl">
        <h3 className="font-heading font-bold text-lg mb-1 text-foreground">{title}</h3>
        {description && <p className="text-sm text-muted-foreground leading-relaxed mb-5">{description}</p>}

        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel} className="flex-1 rounded-2xl h-12 font-semibold">
            {cancelLabel}
          </Button>
          <Button
            onClick={onConfirm}
            className={`flex-1 rounded-2xl h-12 font-semibold ${destructive ? 'bg-red-500 text-white hover:bg-red-500/90 border border-red-400/40' : 'bg-accent text-accent-foreground hover:bg-accent/90'}`}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
