import React from 'react';
import { Button } from '@/components/ui/button';

export default function EmptyState({ icon: Icon, title, description, actionLabel, onAction, compact }) {
  if (compact) {
    return (
      <div className="bg-card border border-dashed border-border rounded-2xl p-6 text-center">
        {Icon && <Icon size={28} className="text-muted-foreground mx-auto mb-2" />}
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {description && <p className="text-xs text-muted-foreground/70 mt-1">{description}</p>}
        {actionLabel && onAction && (
          <Button onClick={onAction} size="sm" className="mt-3 rounded-xl bg-accent text-accent-foreground text-xs h-8">
            {actionLabel}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Icon size={28} className="text-muted-foreground" />
        </div>
      )}
      <h3 className="font-heading font-semibold text-base">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-2 max-w-xs leading-relaxed">{description}</p>}
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-5 rounded-xl bg-accent text-accent-foreground px-6">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}