import React from 'react';
import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';

export default function AppShell() {
  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <div className="max-w-lg mx-auto pb-20">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}