import React from 'react';
import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';

export default function AppShell() {
  return (
    <div className="dark min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Ambient background glow layers — same as gym owner dashboard */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-accent/20 rounded-full blur-[100px]" />
        <div className="absolute top-1/3 -right-24 w-64 h-64 bg-yellow-400/15 rounded-full blur-[80px]" />
        <div className="absolute bottom-0 left-1/4 w-96 h-48 bg-accent/15 rounded-full blur-[80px]" />
        <div className="absolute top-2/3 left-0 w-56 h-56 bg-yellow-500/10 rounded-full blur-[70px]" />
      </div>
      <div className="relative z-10 max-w-lg mx-auto" style={{ paddingBottom: '90px' }}>
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}