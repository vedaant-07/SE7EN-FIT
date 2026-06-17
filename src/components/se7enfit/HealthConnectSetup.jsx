// Health Tracking Connection Placeholder
// Native Android Health Connect / iOS HealthKit integration via Capacitor/React Native — future release.

import React, { useState } from 'react';
import { Smartphone, Apple, PenLine, X } from 'lucide-react';

const OPTIONS = [
  {
    id: 'health_connect',
    label: 'Connect Health Tracking',
    subtitle: 'Android Health Connect',
    icon: Smartphone,
    color: 'text-green-400',
    bg: 'bg-green-400/10',
    border: 'border-green-400/20',
    comingSoon: true,
  },
  {
    id: 'apple_health',
    label: 'Connect Apple Health',
    subtitle: 'iOS HealthKit',
    icon: Apple,
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    border: 'border-blue-400/20',
    comingSoon: true,
  },
  {
    id: 'manual',
    label: 'Manual Tracking',
    subtitle: 'Log steps, sleep & water yourself',
    icon: PenLine,
    color: 'text-accent',
    bg: 'bg-accent/10',
    border: 'border-accent/20',
    comingSoon: false,
  },
];

export default function HealthConnectSetup({ onDismiss }) {
  const [selected, setSelected] = useState(null);

  const handleSelect = (option) => {
    setSelected(option.id);
    if (!option.comingSoon && onDismiss) {
      setTimeout(onDismiss, 400);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-heading font-semibold text-sm">Health Tracking</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Choose how to sync your fitness data</p>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
            <X size={13} className="text-muted-foreground" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        {OPTIONS.map(option => {
          const Icon = option.icon;
          return (
            <button
              key={option.id}
              onClick={() => handleSelect(option)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all active:scale-[0.98] ${
                selected === option.id
                  ? `${option.border} ${option.bg}`
                  : 'border-border bg-background hover:border-muted-foreground/30'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${option.bg} flex-shrink-0`}>
                <Icon size={16} className={option.color} />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold">{option.label}</p>
                <p className="text-[10px] text-muted-foreground">{option.subtitle}</p>
              </div>
              {option.comingSoon && (
                <span className="text-[9px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">Soon</span>
              )}
              {selected === option.id && !option.comingSoon && (
                <span className="text-[9px] bg-accent/15 text-accent px-2 py-0.5 rounded-full font-medium">Active</span>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-[9px] text-muted-foreground text-center px-2 leading-relaxed">
        Native Health Connect & Apple Health sync requires the SE7ENFIT mobile app. Web manual tracking is always available.
      </p>
    </div>
  );
}