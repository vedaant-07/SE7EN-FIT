import React from 'react';

export default function StatCard({ icon, label, value, subtitle, onClick, className = '' }) {
  return (
    <div
      onClick={onClick}
      className={`bg-card border border-border rounded-2xl p-4 transition-all duration-200 active:scale-[0.98] ${onClick ? 'cursor-pointer hover:border-accent/30' : ''} ${className}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold font-heading">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      {subtitle && <p className="text-[10px] text-accent mt-1">{subtitle}</p>}
    </div>
  );
}