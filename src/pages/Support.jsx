import React, { useEffect, useState } from 'react';
import TopBar from '@/components/se7enfit/TopBar';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { MessageSquare, Mail, FileText, Shield, Heart, CreditCard, ChevronRight, Info, AlertCircle, Smartphone } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const SUPPORT_EMAIL = 'se7enfits.07@gmail.com';

const FAQ = [
  { q: 'How do I reset my password?', a: 'Go to Profile → tap "Forgot Password" or use the login page forgot password link.' },
  { q: 'How does the AI Trainer work?', a: 'The AI Trainer uses your fitness profile (goals, weight, height, diet) to give personalized coaching. Premium users get unlimited messages.' },
  { q: 'Can I cancel my subscription?', a: 'Yes. Cancelling stops future renewal but your access continues until the current period ends. No partial refunds.' },
  { q: 'How do Food Scans work?', a: 'Take a photo of your meal and our AI estimates the calories and macros. Results are approximate — always verify with labels.' },
  { q: 'Will Health Connect / Apple Health sync work?', a: 'Health sync requires the SE7ENFIT native mobile app. The web app supports full manual tracking. Mobile app is coming soon.' },
  { q: 'How do I join a gym on the app?', a: 'Go to My Gym, enter the referral code your gym owner shared, and submit a join request. The owner approves it.' },
  { q: 'I was charged but my plan did not activate.', a: 'Send a support request from this page with your payment ID. Admin will review it and reply manually by email.' },
  { q: 'How do I delete my account?', a: `Email ${SUPPORT_EMAIL} with subject "Delete Account". We will process within 7 business days and remove all your data.` },
];

export default function Support() {
  const { toast } = useToast();
  const [openFaq, setOpenFaq] = useState(null);
  const [form, setForm] = useState({ email: '', subject: '', message: '' });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        if (!mounted) return;
        setUser(currentUser);
        setForm(prev => ({
          ...prev,
          email: prev.email || currentUser?.email || '',
        }));
      } catch {
        if (mounted) setUser(null);
      }
    };

    loadUser();
    return () => { mounted = false; };
  }, []);

  const handleSend = async () => {
    const email = form.email.trim().toLowerCase();
    const subject = form.subject.trim();
    const message = form.message.trim();

    if (!email || !subject || !message || sending) return;

    setSending(true);
    try {
      await base44.entities.SupportTicket.create({
        user_id: user?.id || null,
        user_name: user?.full_name || user?.name || user?.email?.split('@')?.[0] || 'SE7EN FIT User',
        user_email: user?.email || email,
        contact_email: email,
        subject,
        message,
        status: 'open',
        priority: 'normal',
        source: 'help_support_page',
      });

      setSent(true);
      setForm(prev => ({ ...prev, subject: '', message: '' }));
      toast({ title: 'Support request sent', description: 'Admin can now see this request in the admin panel.' });
    } catch (error) {
      toast({
        title: 'Could not send request',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <TopBar title="Help & Support" showBack />
      <div className="px-4 py-4 pb-10 max-w-lg mx-auto space-y-5">

        {/* Hero */}
        <div className="bg-gradient-to-br from-accent/15 to-accent/5 border border-accent/25 rounded-3xl p-5 text-center">
          <div className="w-14 h-14 rounded-2xl bg-accent/20 flex items-center justify-center mx-auto mb-3">
            <MessageSquare size={24} className="text-accent" />
          </div>
          <h2 className="font-heading font-bold text-xl">How can we help?</h2>
          <p className="text-xs text-muted-foreground mt-1.5">Send your request to the admin panel. Admin will reply manually by email.</p>
          <a href={`mailto:${SUPPORT_EMAIL}`}
            className="inline-flex items-center gap-1.5 mt-3 text-accent text-sm font-semibold hover:underline">
            <Mail size={14} /> {SUPPORT_EMAIL}
          </a>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { label: 'Privacy Policy', icon: Shield, path: '/privacy' },
            { label: 'Terms & Conditions', icon: FileText, path: '/terms' },
            { label: 'Refund Policy', icon: CreditCard, href: '/terms?type=refund' },
            { label: 'Health Disclaimer', icon: Heart, href: '/policy' },
          ].map(item => {
            const Icon = item.icon;
            return (
              <Link key={item.label} to={item.path || item.href || '/'}>
                <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3 hover:border-accent/30 active:scale-[0.98] transition-all">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <Icon size={14} className="text-accent" />
                  </div>
                  <span className="text-xs font-semibold">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* About SE7ENFIT */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <Info size={16} className="text-accent" />
            <h3 className="font-heading font-semibold text-sm">About SE7ENFIT</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
            SE7ENFIT is a premium AI fitness coaching platform built for the Indian market.
            We combine AI-powered workout plans, nutrition tracking, food scanning, and gym management
            into one powerful app — designed for serious fitness enthusiasts and gym businesses alike.
          </p>
          <div className="space-y-1.5">
            {[
              { label: 'Version', value: '1.0.0 (Beta)' },
              { label: 'Platform', value: 'Web + Mobile (coming soon)' },
              { label: 'Market', value: 'India' },
              { label: 'Payments', value: 'Razorpay (INR)' },
              { label: 'AI Engine', value: 'Google Gemini' },
            ].map(item => (
              <div key={item.label} className="flex justify-between py-1.5 border-b border-border/40 last:border-0">
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <span className="text-xs font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Health Data Notice */}
        <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <Smartphone size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-400">Health Data Notice</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Native Android Health Connect and Apple HealthKit sync will be available in the SE7ENFIT mobile app.
                The current web app supports full <strong>manual tracking</strong> for steps, water, sleep, weight, and workouts.
                No real health sensor data is read in this version.
              </p>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div>
          <h3 className="font-heading font-semibold text-sm mb-3">Frequently Asked Questions</h3>
          <div className="space-y-2">
            {FAQ.map((item, i) => (
              <div key={i} className="bg-card border border-border rounded-2xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-4 text-left"
                >
                  <span className="text-sm font-semibold pr-3">{item.q}</span>
                  <ChevronRight size={14} className={`text-muted-foreground flex-shrink-0 transition-transform ${openFaq === i ? 'rotate-90' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4">
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Contact Form */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-heading font-semibold text-sm mb-4">Send Us a Message</h3>
          {sent ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-2xl bg-accent/20 flex items-center justify-center mx-auto mb-3">
                <MessageSquare size={20} className="text-accent" />
              </div>
              <p className="font-semibold text-sm">Request sent to admin!</p>
              <p className="text-xs text-muted-foreground mt-1">Admin can see your request and email you at {form.email || user?.email || 'your email'}.</p>
              <button
                onClick={() => setSent(false)}
                className="mt-4 h-9 px-4 rounded-xl bg-muted text-xs font-semibold hover:bg-muted/80"
              >
                Send another message
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Your Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="your@email.com"
                  className="w-full h-10 px-3 rounded-xl border border-input bg-muted/30 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Subject</label>
                <input
                  value={form.subject}
                  onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                  placeholder="Describe your issue briefly"
                  className="w-full h-10 px-3 rounded-xl border border-input bg-muted/30 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Message</label>
                <textarea
                  value={form.message}
                  onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                  placeholder="Describe your issue in detail..."
                  rows={4}
                  className="w-full px-3 py-2.5 rounded-xl border border-input bg-muted/30 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
              </div>
              <button
                onClick={handleSend}
                disabled={!form.email.trim() || !form.subject.trim() || !form.message.trim() || sending}
                className="w-full h-11 rounded-xl bg-accent text-accent-foreground text-sm font-semibold disabled:opacity-40 transition-all active:scale-[0.98]"
              >
                {sending ? 'Sending...' : 'Send Message'}
              </button>
              <p className="text-[10px] text-muted-foreground text-center">
                Your request is saved in the admin panel. Direct email: <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent">{SUPPORT_EMAIL}</a>
              </p>
            </div>
          )}
        </div>

        {/* Delete Account */}
        <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={15} className="text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-destructive">Delete My Account</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                To permanently delete your account and all data, email us at{' '}
                <a href={`mailto:${SUPPORT_EMAIL}?subject=Delete Account Request`} className="text-accent underline">
                  {SUPPORT_EMAIL}
                </a>{' '}
                with subject "Delete Account Request". We process within 7 business days.
              </p>
            </div>
          </div>
        </div>

        <p className="text-center text-[10px] text-muted-foreground pb-2">
          SE7ENFIT © 2026 • Made in India
        </p>
      </div>
    </>
  );
}
