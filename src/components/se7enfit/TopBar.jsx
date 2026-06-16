import React from 'react';
import { Link } from 'react-router-dom';
import { Bell, User } from 'lucide-react';

export default function TopBar({ title, showBack, backTo = '/' }) {
  return (
    <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border/50">
      <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-3">
        {showBack ? (
          <Link to={backTo} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          </Link>
        ) : (
          <div className="font-display font-bold text-lg tracking-tight">
            SE<span className="text-accent">7</span>ENFIT
          </div>
        )}
        {title && <h1 className="text-base font-heading font-semibold">{title}</h1>}
        <div className="flex items-center gap-2">
          <Link to="/notifications" className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted relative">
            <Bell size={18} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full" />
          </Link>
          <Link to="/profile" className="w-8 h-8 flex items-center justify-center rounded-full bg-muted">
            <User size={16} />
          </Link>
        </div>
      </div>
    </header>
  );
}