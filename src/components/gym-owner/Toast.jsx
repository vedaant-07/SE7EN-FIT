import React, { useEffect } from 'react';
import { CheckCircle2, XCircle, Info } from 'lucide-react';

export default function GymToast({ toasts, setToasts }) {
  useEffect(() => {
    if (toasts.length === 0) return;
    const t = setTimeout(() => setToasts(prev => prev.slice(1)), 3000);
    return () => clearTimeout(t);
  }, [toasts, setToasts]);

  if (toasts.length === 0) return null;
  const toast = toasts[0];
  const icons = { success: CheckCircle2, error: XCircle, info: Info };
  const Icon = icons[toast.type || 'success'];
  const colors = {
    success: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
    error: 'bg-red-500/15 border-red-500/30 text-red-400',
    info: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
  };

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
      <div className={`border rounded-2xl px-4 py-3 flex items-center gap-3 shadow-lg ${colors[toast.type || 'success']}`}>
        <Icon size={16} className="flex-shrink-0" />
        <p className="text-sm font-semibold">{toast.message}</p>
      </div>
    </div>
  );
}