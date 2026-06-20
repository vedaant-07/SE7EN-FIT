/**
 * sendDailyReminders — Automated daily notification sender
 * Runs twice daily: 9am (workout reminder) and 7pm (nutrition/logging reminder)
 * Also used for weekly summary generation (triggered via separate automation)
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

async function callGeminiJson(prompt) {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY not configured');
  const url = `${GEMINI_API_BASE}/gemini-2.0-flash:generateContent?key=${key}`;
  const body = {
    contents: [{ parts: [{ text: prompt + '\n\nReturn ONLY valid JSON.' }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 2048, responseMimeType: 'application/json' },
  };
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Gemini error ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  try {
    return JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : {};
  }
}

function getDateRange(daysBack) {
  const dates = [];
  for (let i = 0; i < daysBack; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function getWeekBounds(weeksBack = 0) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7) - weeksBack * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

function getMonthBounds(monthsBack = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function avg(arr) {
  if (!arr.length) return 0;
  return Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow both authenticated and service-level calls
    let user = null;
    try { user = await base44.auth.me(); } catch {}

    const body = await req.json().catch(() => ({}));
    const { action, userId } = body;

    const db = base44.asServiceRole;
    const today = new Date().toISOString().slice(0, 10);
    const hour = new Date().getUTCHours() + 5; // IST approx

    // ── MORNING REMINDER (workout) ────────────────────────────────────────────
    if (action === 'morningReminder') {
      const profiles = await db.entities.UserProfile.list();
      let sent = 0;

      for (const profile of profiles) {
        try {
          // Check if already logged workout today
          const wlogs = await db.entities.WorkoutLog.filter({ user_id: profile.user_id, date: today });
          if (wlogs.some(w => w.completed)) continue; // Already done

          const msgs = [
            { title: '🏋️ Time to crush it!', message: 'Good morning! Your workout is waiting. Just 30 minutes can transform your body. Start strong today! 💪' },
            { title: '⚡ Rise & Train!', message: 'The best investment you can make is in your body. Hit that workout today — every rep counts!' },
            { title: '🎯 Workout Reminder', message: `You're ${profile.workout_days_per_week || 3} days/week strong! Don't break the streak. Log your workout now.` },
            { title: '🔥 Burn it today!', message: 'Your future self will thank you. Get that workout done and feel amazing all day!' },
          ];
          const pick = msgs[Math.floor(Math.random() * msgs.length)];

          await db.entities.Notification.create({
            user_id: profile.user_id,
            title: pick.title,
            message: pick.message,
            type: 'workout',
            is_read: false,
            action_url: '/workout',
          });
          sent++;
        } catch {}
      }
      return Response.json({ success: true, action: 'morningReminder', sent });
    }

    // ── EVENING REMINDER (nutrition logging) ─────────────────────────────────
    if (action === 'eveningReminder') {
      const profiles = await db.entities.UserProfile.list();
      let sent = 0;

      for (const profile of profiles) {
        try {
          // Check today's nutrition logs
          const nlogs = await db.entities.NutritionLog.filter({ user_id: profile.user_id, date: today });
          const totalCals = nlogs.reduce((s, l) => s + (l.calories || 0), 0);
          const hasLogged = nlogs.length > 0;

          if (!hasLogged) {
            await db.entities.Notification.create({
              user_id: profile.user_id,
              title: '🍽️ Log your meals!',
              message: "You haven't tracked your nutrition today. Log your meals now to stay on top of your goals. Every bite counts! 📊",
              type: 'meal',
              is_read: false,
              action_url: '/nutrition/log',
            });
          } else if (totalCals < 800) {
            await db.entities.Notification.create({
              user_id: profile.user_id,
              title: '⚠️ Low calorie intake',
              message: `You've only logged ${totalCals} kcal today. Make sure you're eating enough to fuel your fitness goals!`,
              type: 'meal',
              is_read: false,
              action_url: '/nutrition',
            });
          } else {
            // Logged well — send a water reminder instead
            const wlogs = await db.entities.WaterLog.filter({ user_id: profile.user_id, date: today });
            const totalWater = wlogs.reduce((s, l) => s + (l.amount_ml || 0), 0);
            const waterGoal = profile.daily_water_goal_ml || 2500;

            if (totalWater < waterGoal * 0.5) {
              await db.entities.Notification.create({
                user_id: profile.user_id,
                title: '💧 Drink more water!',
                message: `You've had ${Math.round(totalWater / 250)} glasses so far. Try to reach your ${Math.round(waterGoal / 250)}-glass goal today. Stay hydrated!`,
                type: 'water',
                is_read: false,
                action_url: '/tracking',
              });
            }
          }
          sent++;
        } catch {}
      }
      return Response.json({ success: true, action: 'eveningReminder', sent });
    }

    // ── WEEKLY SUMMARY REPORT GENERATION ────────────────────────────────────
    if (action === 'generateWeeklySummaries') {
      const profiles = await db.entities.UserProfile.list();
      const bounds = getWeekBounds(1); // Last full week
      const dates = getDateRange(7).map(d => d); // last 7 days
      let generated = 0;

      for (const profile of profiles) {
        try {
          // Skip if report already exists for this week
          const existing = await db.entities.WeeklySummaryReport.filter({
            user_id: profile.user_id,
            week_start: bounds.start,
            period: 'weekly',
          });
          if (existing.length > 0) continue;

          // Gather all data for the week
          const [wlogs, nlogs, slogs, stlogs, wklogs, watlogs] = await Promise.all([
            db.entities.WeightLog.filter({ user_id: profile.user_id }, '-date', 14),
            db.entities.NutritionLog.filter({ user_id: profile.user_id }, '-date', 7),
            db.entities.SleepLog.filter({ user_id: profile.user_id }, '-date', 7),
            db.entities.StepLog.filter({ user_id: profile.user_id }, '-date', 7),
            db.entities.WorkoutLog.filter({ user_id: profile.user_id }, '-date', 7),
            db.entities.WaterLog.filter({ user_id: profile.user_id }, '-date', 7),
          ]);

          // Filter to this week
          const inWeek = (log) => log.date >= bounds.start && log.date <= bounds.end;
          const weekWlogs = wlogs.filter(inWeek);
          const weekNlogs = nlogs.filter(inWeek);
          const weekSlogs = slogs.filter(inWeek);
          const weekStlogs = stlogs.filter(inWeek);
          const weekWklogs = wklogs.filter(inWeek);
          const weekWatlogs = watlogs.filter(inWeek);

          // Calculate aggregates
          const avgWeight = weekWlogs.length ? avg(weekWlogs.map(l => l.weight_kg)) : null;
          const firstWeight = wlogs.find(l => l.date < bounds.start)?.weight_kg;
          const lastWeight = weekWlogs[0]?.weight_kg;
          const weightChange = firstWeight && lastWeight ? Math.round((lastWeight - firstWeight) * 10) / 10 : null;

          const totalWorkouts = weekWklogs.filter(w => w.completed).length;
          const totalWorkoutCals = weekWklogs.reduce((s, w) => s + (w.calories_burned || 0), 0);

          // Group nutrition by day and average
          const calsByDay = {};
          const protByDay = {};
          weekNlogs.forEach(l => {
            calsByDay[l.date] = (calsByDay[l.date] || 0) + (l.calories || 0);
            protByDay[l.date] = (protByDay[l.date] || 0) + (l.protein_g || 0);
          });
          const avgCals = avg(Object.values(calsByDay));
          const avgProt = avg(Object.values(protByDay));

          const stepsByDay = {};
          weekStlogs.forEach(l => { stepsByDay[l.date] = (stepsByDay[l.date] || 0) + (l.steps || 0); });
          const avgSteps = avg(Object.values(stepsByDay));

          const avgSleep = weekSlogs.length ? avg(weekSlogs.map(l => l.hours || 0)) : 0;

          const waterByDay = {};
          weekWatlogs.forEach(l => { waterByDay[l.date] = (waterByDay[l.date] || 0) + (l.amount_ml || 0); });
          const avgWater = avg(Object.values(waterByDay));

          const daysLogged = new Set([
            ...Object.keys(calsByDay),
            ...Object.keys(stepsByDay),
            ...weekWklogs.map(l => l.date),
          ]).size;

          // Generate AI summary
          let aiReport = {};
          try {
            const prompt = `Generate a brief weekly fitness summary for an Indian fitness app user.
Week: ${bounds.start} to ${bounds.end}
Stats:
- Workouts completed: ${totalWorkouts}/7 days
- Avg daily calories: ${avgCals} kcal
- Avg daily protein: ${avgProt}g
- Avg daily steps: ${avgSteps.toLocaleString()}
- Avg sleep: ${avgSleep}h
- Weight change this week: ${weightChange !== null ? `${weightChange > 0 ? '+' : ''}${weightChange} kg` : 'not logged'}
- Days actively logged: ${daysLogged}
- User goal: ${profile.goal?.replace(/_/g, ' ') || 'general fitness'}

Return JSON:
{
  "summary": "2-3 sentence motivational summary of the week",
  "topWins": ["win 1", "win 2", "win 3"],
  "areasToImprove": ["area 1", "area 2"],
  "nextFocus": ["focus 1", "focus 2", "focus 3"]
}`;
            aiReport = await callGeminiJson(prompt);
          } catch {}

          // Save the report
          const report = await db.entities.WeeklySummaryReport.create({
            user_id: profile.user_id,
            period: 'weekly',
            week_start: bounds.start,
            week_end: bounds.end,
            avg_weight_kg: avgWeight,
            weight_change_kg: weightChange,
            total_workouts: totalWorkouts,
            total_workout_calories: totalWorkoutCals,
            avg_daily_calories: avgCals,
            avg_daily_protein_g: avgProt,
            avg_daily_steps: avgSteps,
            avg_sleep_hours: avgSleep,
            avg_water_ml: avgWater,
            days_logged: daysLogged,
            ai_summary: aiReport.summary || '',
            top_wins: aiReport.topWins || [],
            areas_to_improve: aiReport.areasToImprove || [],
            next_focus: aiReport.nextFocus || [],
          });

          // Send notification
          await db.entities.Notification.create({
            user_id: profile.user_id,
            title: '📊 Weekly Report Ready!',
            message: aiReport.summary || `Your week: ${totalWorkouts} workouts, avg ${avgCals} kcal/day, ${avgSteps.toLocaleString()} steps/day. View your full report!`,
            type: 'report',
            is_read: false,
            action_url: '/progress',
          });

          generated++;
        } catch {}
      }

      return Response.json({ success: true, action: 'generateWeeklySummaries', generated });
    }

    // ── GENERATE MONTHLY SUMMARY ─────────────────────────────────────────────
    if (action === 'generateMonthlySummaries') {
      const profiles = await db.entities.UserProfile.list();
      const bounds = getMonthBounds(1);
      let generated = 0;

      for (const profile of profiles) {
        try {
          const existing = await db.entities.WeeklySummaryReport.filter({
            user_id: profile.user_id,
            week_start: bounds.start,
            period: 'monthly',
          });
          if (existing.length > 0) continue;

          const [wlogs, nlogs, slogs, stlogs, wklogs, watlogs] = await Promise.all([
            db.entities.WeightLog.filter({ user_id: profile.user_id }, '-date', 60),
            db.entities.NutritionLog.filter({ user_id: profile.user_id }, '-date', 30),
            db.entities.SleepLog.filter({ user_id: profile.user_id }, '-date', 30),
            db.entities.StepLog.filter({ user_id: profile.user_id }, '-date', 30),
            db.entities.WorkoutLog.filter({ user_id: profile.user_id }, '-date', 30),
            db.entities.WaterLog.filter({ user_id: profile.user_id }, '-date', 30),
          ]);

          const inMonth = (log) => log.date >= bounds.start && log.date <= bounds.end;
          const mWlogs = wlogs.filter(inMonth);
          const mNlogs = nlogs.filter(inMonth);
          const mSlogs = slogs.filter(inMonth);
          const mStlogs = stlogs.filter(inMonth);
          const mWklogs = wklogs.filter(inMonth);
          const mWatlogs = watlogs.filter(inMonth);

          const avgWeight = mWlogs.length ? avg(mWlogs.map(l => l.weight_kg)) : null;
          const firstW = wlogs.find(l => l.date < bounds.start)?.weight_kg;
          const lastW = mWlogs[0]?.weight_kg;
          const weightChange = firstW && lastW ? Math.round((lastW - firstW) * 10) / 10 : null;

          const totalWorkouts = mWklogs.filter(w => w.completed).length;
          const calsByDay = {};
          mNlogs.forEach(l => { calsByDay[l.date] = (calsByDay[l.date] || 0) + (l.calories || 0); });
          const avgCals = avg(Object.values(calsByDay));
          const stepsByDay = {};
          mStlogs.forEach(l => { stepsByDay[l.date] = (stepsByDay[l.date] || 0) + (l.steps || 0); });
          const avgSteps = avg(Object.values(stepsByDay));
          const avgSleep = mSlogs.length ? avg(mSlogs.map(l => l.hours || 0)) : 0;
          const waterByDay = {};
          mWatlogs.forEach(l => { waterByDay[l.date] = (waterByDay[l.date] || 0) + (l.amount_ml || 0); });
          const avgWater = avg(Object.values(waterByDay));
          const daysLogged = new Set([...Object.keys(calsByDay), ...Object.keys(stepsByDay), ...mWklogs.map(l => l.date)]).size;

          let aiReport = {};
          try {
            const monthName = new Date(bounds.start).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
            const prompt = `Generate a monthly fitness transformation summary for an Indian fitness app user.
Month: ${monthName}
Stats:
- Total workouts: ${totalWorkouts}
- Avg daily calories: ${avgCals} kcal
- Avg daily steps: ${avgSteps.toLocaleString()}
- Avg sleep: ${avgSleep}h
- Weight change: ${weightChange !== null ? `${weightChange > 0 ? '+' : ''}${weightChange} kg` : 'not tracked'}
- Days logged: ${daysLogged}/30
- User goal: ${profile.goal?.replace(/_/g, ' ') || 'general fitness'}

Return JSON:
{
  "summary": "3-4 sentence transformation summary with motivation",
  "topWins": ["win 1", "win 2", "win 3"],
  "areasToImprove": ["area 1", "area 2"],
  "nextFocus": ["next month focus 1", "focus 2", "focus 3"]
}`;
            aiReport = await callGeminiJson(prompt);
          } catch {}

          await db.entities.WeeklySummaryReport.create({
            user_id: profile.user_id,
            period: 'monthly',
            week_start: bounds.start,
            week_end: bounds.end,
            avg_weight_kg: avgWeight,
            weight_change_kg: weightChange,
            total_workouts: totalWorkouts,
            avg_daily_calories: avgCals,
            avg_daily_steps: avgSteps,
            avg_sleep_hours: avgSleep,
            avg_water_ml: avgWater,
            days_logged: daysLogged,
            ai_summary: aiReport.summary || '',
            top_wins: aiReport.topWins || [],
            areas_to_improve: aiReport.areasToImprove || [],
            next_focus: aiReport.nextFocus || [],
          });

          await db.entities.Notification.create({
            user_id: profile.user_id,
            title: '🗓️ Monthly Summary Ready!',
            message: aiReport.summary || `This month: ${totalWorkouts} workouts completed. ${weightChange !== null ? `Weight change: ${weightChange > 0 ? '+' : ''}${weightChange}kg.` : ''} View your transformation report!`,
            type: 'report',
            is_read: false,
            action_url: '/progress',
          });

          generated++;
        } catch {}
      }

      return Response.json({ success: true, action: 'generateMonthlySummaries', generated });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});