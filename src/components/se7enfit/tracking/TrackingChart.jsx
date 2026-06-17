import React from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';

export function WeekBarChart({ data, dataKey, color = 'hsl(var(--accent))', height = 110 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} barCategoryGap="30%">
        <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '10px', fontSize: 11 }}
          cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
        />
        <Bar dataKey={dataKey} fill={color} radius={[5, 5, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MonthLineChart({ data, dataKey, color = 'hsl(var(--accent))', goalValue, height = 120 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis domain={['auto', 'auto']} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={28} />
        <Tooltip
          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '10px', fontSize: 11 }}
        />
        {goalValue && <ReferenceLine y={goalValue} stroke={color} strokeDasharray="4 3" strokeOpacity={0.5} />}
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}