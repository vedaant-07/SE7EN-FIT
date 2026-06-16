import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import { Button } from '@/components/ui/button';
import { Calendar, CheckCircle, Flame } from 'lucide-react';
import { getToday } from '@/lib/fitnessUtils';
import { useToast } from '@/components/ui/use-toast';

export default function GymAttendance() {
  const { toast } = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkedIn, setCheckedIn] = useState(false);
  const today = getToday();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const user = await base44.auth.me();
    const attendance = await base44.entities.GymAttendance.filter({ user_id: user.id }, '-date', 30);
    setLogs(attendance);
    setCheckedIn(attendance.some(a => a.date === today));
    setLoading(false);
  };

  const checkIn = async () => {
    const user = await base44.auth.me();
    await base44.entities.GymAttendance.create({
      user_id: user.id, date: today,
      check_in: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    });
    toast({ title: 'Checked in! 💪' });
    loadData();
  };

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" /></div>;

  // Build streak
  let streak = 0;
  const sortedDates = [...new Set(logs.map(l => l.date))].sort().reverse();
  for (let i = 0; i < sortedDates.length; i++) {
    const expected = new Date(); expected.setDate(expected.getDate() - i);
    if (sortedDates[i] === expected.toISOString().split('T')[0]) streak++;
    else break;
  }

  // Build this month calendar
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  const attended = new Set(logs.filter(l => l.date.startsWith(today.slice(0, 7))).map(l => l.date));

  return (
    <>
      <TopBar title="Gym Attendance" showBack backTo="/tracking" />
      <div className="px-4 py-4 space-y-5 pb-24">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <Flame size={20} className="text-orange-500 mx-auto mb-2" />
            <p className="text-2xl font-bold font-heading">{streak}</p>
            <p className="text-xs text-muted-foreground">Day Streak</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <Calendar size={20} className="text-accent mx-auto mb-2" />
            <p className="text-2xl font-bold font-heading">{attended.size}</p>
            <p className="text-xs text-muted-foreground">This Month</p>
          </div>
        </div>

        {!checkedIn ? (
          <Button onClick={checkIn} className="w-full h-14 rounded-2xl bg-accent text-accent-foreground text-base font-heading font-bold">
            <CheckCircle size={20} className="mr-2" /> Check In to Gym
          </Button>
        ) : (
          <div className="bg-accent/10 border border-accent/30 rounded-2xl p-4 text-center">
            <CheckCircle size={24} className="text-accent mx-auto mb-2" />
            <p className="font-heading font-bold text-accent">Checked In Today!</p>
            <p className="text-xs text-muted-foreground mt-1">Keep up the great work 💪</p>
          </div>
        )}

        {/* Calendar grid */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="font-heading font-semibold text-sm mb-3">{now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h3>
          <div className="grid grid-cols-7 gap-1 text-center">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={i} className="text-[9px] text-muted-foreground py-1">{d}</div>
            ))}
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isToday = dateStr === today;
              const didAttend = attended.has(dateStr);
              return (
                <div key={day} className={`aspect-square flex items-center justify-center rounded-full text-xs font-medium ${isToday ? 'ring-1 ring-accent' : ''} ${didAttend ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}>
                  {day}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}