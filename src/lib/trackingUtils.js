// Tracking utilities — chart data builders, streak calculators, AI insight generators

import { base44 } from '@/api/base44Client';

/** Build last-7-days chart data from a logs array */
export function buildWeekData(logs, dateKey = 'date', valueKey, aggregator = 'sum') {
  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayLogs = logs.filter(l => l[dateKey] === dateStr);
    let val = 0;
    if (dayLogs.length) {
      if (aggregator === 'sum') val = dayLogs.reduce((s, l) => s + (l[valueKey] || 0), 0);
      else if (aggregator === 'first') val = dayLogs[0][valueKey] || 0;
      else if (aggregator === 'count') val = dayLogs.length;
      else if (aggregator === 'complete_count') val = dayLogs.filter(l => l.completed).length;
    }
    week.push({ day: DAY_LABELS[d.getDay()], [valueKey]: val, date: dateStr });
  }
  return week;
}

/** Build last-30-days chart data */
export function buildMonthData(logs, dateKey = 'date', valueKey, aggregator = 'sum') {
  const month = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayLogs = logs.filter(l => l[dateKey] === dateStr);
    let val = 0;
    if (dayLogs.length) {
      if (aggregator === 'sum') val = dayLogs.reduce((s, l) => s + (l[valueKey] || 0), 0);
      else if (aggregator === 'first') val = dayLogs[0][valueKey] || 0;
      else if (aggregator === 'count') val = dayLogs.length;
      else if (aggregator === 'complete_count') val = dayLogs.filter(l => l.completed).length;
    }
    const label = i % 7 === 0 ? `${d.getDate()}/${d.getMonth() + 1}` : '';
    month.push({ label, [valueKey]: val, date: dateStr });
  }
  return month;
}

/** Calculate streak from sorted logs array (expects {date:string} objects, newest first) */
export function calcStreak(logs, dateKey = 'date') {
  if (!logs.length) return 0;
  const today = new Date().toISOString().split('T')[0];
  const dates = [...new Set(logs.map(l => l[dateKey]))].sort().reverse();
  let streak = 0;
  let check = today;
  for (const d of dates) {
    if (d === check) {
      streak++;
      const prev = new Date(check);
      prev.setDate(prev.getDate() - 1);
      check = prev.toISOString().split('T')[0];
    } else if (d < check) break;
  }
  return streak;
}

/** Generic AI insight for a tracking metric */
export async function getTrackingInsight(metricName, todayValue, goal, unit, recentAvg, profileGoal) {
  const prompt = `You are a fitness AI coach. Give a SHORT (1-2 sentence) personalized insight for:
Metric: ${metricName}
Today: ${todayValue} ${unit}
Goal: ${goal} ${unit}
7-day average: ${recentAvg} ${unit}
User's fitness goal: ${profileGoal || 'general fitness'}
Be encouraging, specific, and actionable. No markdown formatting.`;

  const res = await base44.integrations.Core.InvokeLLM({ prompt });
  return res;
}

/** Build fitness score contribution from all tracking data */
export function calcDailyFitnessScore({ workoutDone, stepsPercent, waterPercent, caloriesOnTrack, sleepHours, proteinOnTrack, moodScore, cardioMinutes, habitsCompleted, habitsTotal }) {
  let score = 0;
  if (workoutDone) score += 20;
  score += Math.min(20, Math.round((stepsPercent || 0) * 0.2));
  score += Math.min(15, Math.round((waterPercent || 0) * 0.15));
  if (caloriesOnTrack) score += 15;
  if ((sleepHours || 0) >= 7) score += 10;
  if (proteinOnTrack) score += 10;
  if ((moodScore || 0) >= 4) score += 5;
  if ((cardioMinutes || 0) >= 20) score += 5;
  if (habitsTotal > 0) score += Math.round((habitsCompleted / habitsTotal) * 5);
  return Math.min(score, 100);
}