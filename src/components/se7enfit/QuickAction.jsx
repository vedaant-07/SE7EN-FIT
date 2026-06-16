import React from 'react';

export default function QuickAction({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-card border border-border hover:border-accent/30 transition-all active:scale-95 min-w-[72px]"
    >
      <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
        {icon}
      </div>
      <span className="text-[10px] font-medium text-muted-foreground leading-tight text-center">{label}</span>
    </button>
  );
}