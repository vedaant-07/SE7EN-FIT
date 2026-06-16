import React from 'react';

export default function StatCard({ icon, label, value, subtitle, onClick, accent = false, gradient }) {
  const base = `relative overflow-hidden bg-card border border-border rounded-2xl p-4 transition-all duration-200 ${
    onClick ? 'cursor-pointer active:scale-[0.97] hover:border-accent/30 hover:shadow-sm hover:shadow-accent/5' : ''
  } ${accent ? 'border-accent/30 bg-accent/5' : ''}`;

  return (
    <div className={base} onClick={onClick}>
      {gradient && (
        <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ background: gradient }} />
      )}
      <div className="flex items-start justify-between mb-2">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${accent ? 'bg-accent/20 text-accent' : 'bg-muted text-muted-foreground'}`}>
          {icon}
        </div>
      </div>
      <p className="text-lg font-heading font-bold leading-none">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1 font-medium">{label}</p>
      {subtitle && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{subtitle}</p>}
    </div>
  );
}