import React from 'react';
import { CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react';

const STATUS = {
  done: { icon: CheckCircle, color: 'text-green-400', label: 'Done' },
  missing: { icon: XCircle, color: 'text-red-400', label: 'Missing' },
  partial: { icon: AlertCircle, color: 'text-amber-400', label: 'Partial' },
  soon: { icon: Clock, color: 'text-blue-400', label: 'Coming Soon' },
};

const REPORT = [
  {
    section: '✅ Auth & Security',
    items: [
      { label: 'User login / register flow', status: 'done' },
      { label: 'Gym owner login / signup flow', status: 'done' },
      { label: 'Protected routes (ProtectedRoute)', status: 'done' },
      { label: 'Role-based access (user vs gym_owner vs admin)', status: 'done' },
      { label: 'Logout flow (user & owner)', status: 'done' },
      { label: 'Razorpay test key removed from frontend', status: 'done', note: 'Move to VITE_RAZORPAY_KEY_ID env var' },
      { label: 'No hardcoded credentials in UI', status: 'done' },
      { label: 'No API secrets in frontend code', status: 'partial', note: 'Gemini key is server-side in backend function ✓' },
    ],
  },
  {
    section: '📱 Customer App Features',
    items: [
      { label: 'Home dashboard with metrics', status: 'done' },
      { label: 'AI Trainer chat', status: 'done' },
      { label: 'Workout plans & guide', status: 'done' },
      { label: 'Exercise library', status: 'done' },
      { label: 'Food / calorie / protein tracking', status: 'done' },
      { label: 'AI Food Scan (photo → AI estimate)', status: 'done' },
      { label: 'Water, steps, sleep, weight tracking', status: 'done' },
      { label: 'Progress tracker & photos', status: 'done' },
      { label: 'Challenges & reward coins', status: 'done' },
      { label: 'Community posts', status: 'done' },
      { label: 'Subscription plans screen', status: 'done' },
      { label: 'Profile & settings', status: 'done' },
      { label: 'Gym membership (My Gym)', status: 'done' },
      { label: 'Notifications page', status: 'done' },
    ],
  },
  {
    section: '🏢 Gym Owner Dashboard',
    items: [
      { label: 'Owner login / signup', status: 'done' },
      { label: 'Owner onboarding flow', status: 'done' },
      { label: 'Revenue overview', status: 'done' },
      { label: 'Member management & approval', status: 'done' },
      { label: 'Lead management (CRM)', status: 'done' },
      { label: 'Attendance tracking & PIN system', status: 'done' },
      { label: 'Challenges & rewards management', status: 'done' },
      { label: 'Gym profile editor', status: 'done' },
      { label: 'Equipment manager', status: 'done' },
      { label: 'Announcements broadcast', status: 'done' },
      { label: 'Reviews management', status: 'done' },
      { label: 'Referrals tracking', status: 'done' },
      { label: 'Earnings dashboard', status: 'done' },
    ],
  },
  {
    section: '💳 Payments',
    items: [
      { label: 'Razorpay integration (web)', status: 'partial', note: 'Integration code ready — needs live key + server-side order creation for production' },
      { label: 'Server-side order verification', status: 'missing', note: 'Critical: Razorpay payments must be verified server-side before activating subscription' },
      { label: 'Play Store / App Store IAP', status: 'soon', note: 'Required for mobile app digital subscriptions' },
      { label: 'Subscription plans (₹299/₹499/₹2999/₹5999)', status: 'done' },
      { label: 'Free trial (7 days)', status: 'done' },
      { label: 'GST/tax placeholder', status: 'done' },
      { label: 'Non-refund policy displayed', status: 'done' },
    ],
  },
  {
    section: '📄 Legal & Policy Pages',
    items: [
      { label: 'Privacy Policy', status: 'done' },
      { label: 'Terms & Conditions', status: 'done' },
      { label: 'Refund Policy (No Refund)', status: 'done' },
      { label: 'Health Disclaimer', status: 'done' },
      { label: 'Subscription Policy', status: 'done' },
      { label: 'Contact / Support page', status: 'done' },
      { label: 'About SE7ENFIT', status: 'done' },
      { label: 'Delete Account flow', status: 'done', note: 'Via email support — no self-serve delete yet' },
    ],
  },
  {
    section: '📡 Health Data',
    items: [
      { label: 'Manual tracking (steps, sleep, water, weight)', status: 'done' },
      { label: 'Health Connect disclaimer shown', status: 'done' },
      { label: 'No fake real health data claimed', status: 'done' },
      { label: 'Android Health Connect (native)', status: 'soon' },
      { label: 'Apple HealthKit (native)', status: 'soon' },
    ],
  },
  {
    section: '🇮🇳 India Market',
    items: [
      { label: 'All prices in ₹ INR', status: 'done' },
      { label: 'Razorpay payment gateway', status: 'done' },
      { label: 'GST note on subscription page', status: 'done' },
      { label: 'India phone number field', status: 'partial', note: 'Profile has no phone field yet' },
      { label: 'Hindi language support', status: 'soon' },
    ],
  },
  {
    section: '🚀 Launch Readiness',
    items: [
      { label: 'UI consistent dark premium theme', status: 'done' },
      { label: 'Mobile responsive design', status: 'done' },
      { label: 'Loading states on all pages', status: 'done' },
      { label: 'Empty states on all lists', status: 'done' },
      { label: 'Server-side Razorpay verification', status: 'missing', note: '🔴 BLOCKER for real payments' },
      { label: 'Live Razorpay key configured', status: 'missing', note: '🔴 Set VITE_RAZORPAY_KEY_ID in env' },
      { label: 'Custom domain / SSL', status: 'soon' },
      { label: 'Email notifications', status: 'soon' },
      { label: 'Push notifications', status: 'soon' },
      { label: 'Native mobile app (Android)', status: 'soon' },
      { label: 'Native mobile app (iOS)', status: 'soon' },
    ],
  },
];

function getScore() {
  let done = 0; let total = 0;
  REPORT.forEach(s => s.items.forEach(i => { total++; if (i.status === 'done') done++; }));
  return Math.round((done / total) * 100);
}

export default function ProductionReport() {
  const score = getScore();
  const scoreColor = score >= 80 ? 'text-green-400' : score >= 60 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="space-y-5">
      {/* Score Hero */}
      <div className="bg-gradient-to-br from-accent/15 to-accent/5 border border-accent/25 rounded-3xl p-5">
        <div className="flex items-center gap-4">
          <div className={`font-heading font-black text-5xl ${scoreColor}`}>{score}%</div>
          <div>
            <p className="font-heading font-bold text-lg">Launch Readiness</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {score >= 80 ? '🚀 Close to launch-ready!' : score >= 60 ? '⚠️ Good progress — a few blockers remain' : '🔴 Significant work needed before launch'}
            </p>
          </div>
        </div>
        <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${score}%` }} />
        </div>
        <div className="flex gap-4 mt-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><CheckCircle size={10} className="text-green-400" /> Done</span>
          <span className="flex items-center gap-1"><AlertCircle size={10} className="text-amber-400" /> Partial</span>
          <span className="flex items-center gap-1"><XCircle size={10} className="text-red-400" /> Missing</span>
          <span className="flex items-center gap-1"><Clock size={10} className="text-blue-400" /> Coming Soon</span>
        </div>
      </div>

      {/* Critical Blockers */}
      <div className="bg-red-500/10 border border-red-500/25 rounded-2xl p-4">
        <p className="font-semibold text-sm text-red-400 mb-2">🔴 Critical Before Launch</p>
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">• <strong>Razorpay server-side verification</strong> — payments must be verified via backend function before activating subscriptions</p>
          <p className="text-xs text-muted-foreground">• <strong>Live Razorpay key</strong> — set <code className="bg-muted px-1 rounded text-accent">VITE_RAZORPAY_KEY_ID</code> in environment variables</p>
          <p className="text-xs text-muted-foreground">• <strong>Play Store/App Store IAP</strong> — required if distributing mobile app with paid subscriptions</p>
        </div>
      </div>

      {/* Full Report */}
      {REPORT.map((section, si) => (
        <div key={si} className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border/50 bg-muted/20">
            <p className="font-heading font-semibold text-sm">{section.section}</p>
          </div>
          <div className="divide-y divide-border/40">
            {section.items.map((item, ii) => {
              const s = STATUS[item.status];
              const Icon = s.icon;
              return (
                <div key={ii} className="px-4 py-3 flex items-start gap-3">
                  <Icon size={13} className={`${s.color} flex-shrink-0 mt-0.5`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{item.label}</p>
                    {item.note && <p className="text-[10px] text-muted-foreground mt-0.5">{item.note}</p>}
                  </div>
                  <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                    item.status === 'done' ? 'bg-green-400/10 text-green-400' :
                    item.status === 'partial' ? 'bg-amber-400/10 text-amber-400' :
                    item.status === 'missing' ? 'bg-red-400/10 text-red-400' :
                    'bg-blue-400/10 text-blue-400'
                  }`}>{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <p className="text-center text-[10px] text-muted-foreground">Report generated: {new Date().toLocaleDateString('en-IN')} • Admin only</p>
    </div>
  );
}