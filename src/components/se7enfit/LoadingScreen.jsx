import React from 'react';

export default function LoadingScreen({ fullScreen }) {
  if (fullScreen) {
    return (
      <div className="dark fixed inset-0 bg-background flex flex-col items-center justify-center gap-4 z-50">
        <div className="font-display font-bold text-3xl tracking-tight">
          SE<span className="text-accent">7</span>EN <span className="text-accent">FIT</span>
        </div>
        <div className="w-8 h-8 border-4 border-transparent border-t-accent rounded-full animate-spin" />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-4 border-transparent border-t-accent rounded-full animate-spin" />
    </div>
  );
}
