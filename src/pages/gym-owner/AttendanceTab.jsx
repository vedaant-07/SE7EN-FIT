import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { CalendarCheck, QrCode, Hash, UserCheck, UserX, Copy, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

function generatePin() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export default function AttendanceTab({ owner, memberships, attendanceLogs, setAttendanceLogs, showToast }) {
  const today = new Date().toISOString().split('T')[0];
  const todayLogs = attendanceLogs.filter(a => a.date === today);
  const insideNow = todayLogs.filter(a => a.status === 'checked_in').length;
  const totalMembers = memberships.filter(m => m.status === 'active').length;

  const [dailyPin, setDailyPin] = useState('');
  const [pinCopied, setPinCopied] = useState(false);
  const [showCheckin, setShowCheckin] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [saving, setSaving] = useState(false);

  const generateDailyPin = () => {
    const pin = generatePin();
    setDailyPin(pin);
    showToast(`Daily PIN generated: ${pin}`, 'success');
  };

  const copyPin = () => {
    if (!dailyPin) return;
    navigator.clipboard.writeText(dailyPin);
    setPinCopied(true);
    setTimeout(() => setPinCopied(false), 2000);
    showToast('PIN copied!', 'success');
  };

  const manualCheckin = async () => {
    if (!selectedMemberId) return;
    setSaving(true);
    const now = new Date();
    const timeStr = now.toTimeString().slice(0, 5);
    const existing = todayLogs.find(a => a.user_id === selectedMemberId && a.status === 'checked_in');
    if (existing) {
      showToast('Member already checked in today', 'error');
      setSaving(false);
      return;
    }
    const log = await base44.entities.GymAttendanceLog.create({
      user_id: selectedMemberId,
      gym_id: owner.id,
      owner_id: owner.user_id,
      date: today,
      check_in_time: timeStr,
      check_in_method: 'owner_manual',
      status: 'checked_in',
    });
    setAttendanceLogs(prev => [log, ...prev]);
    setShowCheckin(false);
    setSelectedMemberId('');
    showToast('Member checked in successfully', 'success');
    setSaving(false);
  };

  const manualCheckout = async (logId) => {
    const now = new Date();
    const timeStr = now.toTimeString().slice(0, 5);
    const log = attendanceLogs.find(a => a.id === logId);
    if (!log) return;
    const checkinParts = log.check_in_time?.split(':') || [0, 0];
    const checkoutParts = timeStr.split(':');
    const durationMin = (parseInt(checkoutParts[0]) * 60 + parseInt(checkoutParts[1])) -
      (parseInt(checkinParts[0]) * 60 + parseInt(checkinParts[1]));
    await base44.entities.GymAttendanceLog.update(logId, {
      check_out_time: timeStr,
      status: 'checked_out',
      duration_minutes: Math.max(0, durationMin),
    });
    setAttendanceLogs(prev => prev.map(a => a.id === logId
      ? { ...a, check_out_time: timeStr, status: 'checked_out', duration_minutes: Math.max(0, durationMin) }
      : a
    ));
    showToast('Member checked out', 'success');
  };

  const activeMembers = memberships.filter(m => m.status === 'active');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-heading font-bold text-lg">Attendance</p>
        <button onClick={() => setShowCheckin(!showCheckin)}
          className="flex items-center gap-1.5 bg-accent text-accent-foreground text-xs font-semibold px-3 py-2 rounded-xl active:scale-95 transition-all">
          <Plus size={13} /> Check In
        </button>
      </div>

      {/* Stats Hero */}
      <div className="bg-gradient-to-br from-accent via-accent/90 to-accent/70 rounded-3xl p-5 text-accent-foreground">
        <p className="text-sm opacity-80 mb-4">Today — {today}</p>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div><p className="font-black text-3xl">{todayLogs.length}</p><p className="text-xs opacity-70 mt-0.5">Check-ins</p></div>
          <div><p className="font-black text-3xl">{insideNow}</p><p className="text-xs opacity-70 mt-0.5">Inside Now</p></div>
          <div><p className="font-black text-3xl">{totalMembers > 0 ? Math.round((todayLogs.length / totalMembers) * 100) : 0}%</p><p className="text-xs opacity-70 mt-0.5">Rate</p></div>
        </div>
        <div className="bg-white/25 rounded-full h-2 mt-4 overflow-hidden">
          <div className="h-full bg-white rounded-full transition-all" style={{ width: `${totalMembers > 0 ? Math.min(100, Math.round((todayLogs.length / totalMembers) * 100)) : 0}%` }} />
        </div>
      </div>

      {/* Manual Check-in Panel */}
      {showCheckin && (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <p className="font-semibold text-sm">Manual Check-in</p>
          <select value={selectedMemberId} onChange={e => setSelectedMemberId(e.target.value)}
            className="w-full h-10 px-3 rounded-xl border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="">Select member...</option>
            {activeMembers.map(m => (
              <option key={m.id} value={m.user_id}>Member #{m.user_id?.slice(-6)}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button onClick={() => setShowCheckin(false)} className="flex-1 h-10 rounded-xl border border-border text-sm font-semibold">Cancel</button>
            <button onClick={manualCheckin} disabled={!selectedMemberId || saving}
              className="flex-1 h-10 rounded-xl bg-accent text-accent-foreground text-sm font-semibold disabled:opacity-50">
              {saving ? 'Checking in...' : 'Check In'}
            </button>
          </div>
        </div>
      )}

      {/* QR & PIN Tools */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-2xl p-4 text-center">
          <QrCode size={26} className="text-accent mx-auto mb-2" />
          <p className="text-xs font-semibold mb-2">QR Check-In</p>
          <button
            onClick={() => showToast('QR Code feature — coming soon!', 'info')}
            className="text-[10px] bg-accent/10 text-accent px-3 py-1.5 rounded-lg font-semibold w-full">
            Generate QR
          </button>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 text-center">
          <Hash size={26} className="text-accent mx-auto mb-2" />
          <p className="text-xs font-semibold mb-2">{dailyPin ? `PIN: ${dailyPin}` : 'Daily PIN'}</p>
          <div className="flex gap-1.5">
            <button onClick={generateDailyPin} className="flex-1 text-[10px] bg-accent/10 text-accent px-2 py-1.5 rounded-lg font-semibold">
              {dailyPin ? 'Regenerate' : 'Generate'}
            </button>
            {dailyPin && (
              <button onClick={copyPin} className="text-[10px] bg-accent text-accent-foreground px-2 py-1.5 rounded-lg font-semibold">
                {pinCopied ? <Check size={10} /> : <Copy size={10} />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Today's Log */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="font-semibold text-sm">Today's Log</p>
          <span className="text-xs text-muted-foreground">{todayLogs.length} entries</span>
        </div>
        {todayLogs.length === 0 ? (
          <div className="bg-muted/30 border border-border rounded-2xl p-8 text-center">
            <CalendarCheck size={28} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-semibold">No attendance yet today</p>
            <p className="text-xs text-muted-foreground mt-1">Members will appear here after check-in</p>
          </div>
        ) : (
          <div className="space-y-2">
            {todayLogs.map(a => (
              <div key={a.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-black text-accent">M</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Member #{a.user_id?.slice(-6)}</p>
                  <p className="text-xs text-muted-foreground">
                    In: {a.check_in_time}
                    {a.check_out_time ? ` • Out: ${a.check_out_time}` : ' • Inside'}
                    {a.duration_minutes ? ` • ${a.duration_minutes}min` : ''}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${a.status === 'checked_out' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                    {a.status === 'checked_out' ? 'Left' : 'Inside'}
                  </span>
                  {a.status === 'checked_in' && (
                    <button onClick={() => manualCheckout(a.id)}
                      className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-lg font-medium hover:bg-muted/60">
                      Check Out
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Export Placeholder */}
      <button onClick={() => showToast('Attendance report export — coming soon!', 'info')}
        className="w-full h-10 rounded-xl border border-border text-sm text-muted-foreground font-medium hover:bg-muted transition-all">
        Export Attendance Report
      </button>
    </div>
  );
}