import React from 'react';
import TopBar from '@/components/se7enfit/TopBar';
import { useSearchParams } from 'react-router-dom';
import { Shield, FileText, Heart, CreditCard, AlertCircle } from 'lucide-react';

const POLICIES = {
  terms: {
    title: 'Terms & Conditions',
    icon: FileText,
    content: [
      { heading: '1. Acceptance of Terms', text: 'By using SE7ENFIT, you agree to these Terms and Conditions. If you do not agree, please do not use our application.' },
      { heading: '2. User Eligibility', text: 'You must be at least 16 years old to use SE7ENFIT. Users under 18 should have parental consent.' },
      { heading: '3. Account Responsibility', text: 'You are responsible for maintaining the confidentiality of your account credentials and all activities under your account.' },
      { heading: '4. Prohibited Use', text: 'You may not use SE7ENFIT for illegal purposes, to harm others, to share inappropriate content, or to violate any applicable laws.' },
      { heading: '5. Content Ownership', text: 'SE7ENFIT and its licensors own all content, trademarks, and intellectual property within the app.' },
      { heading: '6. Termination', text: 'We reserve the right to terminate or suspend accounts that violate these terms at any time without notice.' },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    icon: Shield,
    content: [
      { heading: 'Data We Collect', text: 'We collect information you provide (name, email, fitness data) and usage data to provide personalized fitness experiences.' },
      { heading: 'How We Use Your Data', text: 'Your data is used to personalize workout plans, nutrition advice, and AI recommendations. We do not sell your personal data.' },
      { heading: 'Data Storage', text: 'Your data is stored securely on our servers. We use industry-standard encryption and security practices.' },
      { heading: 'Health Data', text: 'Fitness and health data you log is private by default and only visible to you unless you choose to share publicly.' },
      { heading: 'Third-Party Services', text: 'We use Stripe for payments and AI services for recommendations. These providers have their own privacy policies.' },
      { heading: 'Your Rights', text: 'You can request deletion of your account and data at any time by contacting support@se7enfit.app' },
    ],
  },
  health: {
    title: 'Health Disclaimer',
    icon: Heart,
    content: [
      { heading: 'Not Medical Advice', text: 'SE7ENFIT provides general fitness and nutrition information for educational purposes only. It is NOT medical advice.' },
      { heading: 'Consult a Professional', text: 'Always consult a qualified medical professional, doctor, or certified fitness trainer before starting any new exercise or diet program.' },
      { heading: 'Individual Results Vary', text: 'Fitness results vary based on individual factors including genetics, diet, consistency, and health conditions.' },
      { heading: 'Injury Risk', text: 'Exercise carries inherent risks. If you experience pain, dizziness, or discomfort during exercise, stop immediately and consult a doctor.' },
      { heading: 'AI Recommendations', text: 'AI-generated workout and nutrition plans are based on general fitness principles. They are not tailored to specific medical conditions.' },
      { heading: 'Calorie Estimates', text: 'Food scan calorie estimates are approximations and may vary from actual nutritional content.' },
    ],
  },
  subscription: {
    title: 'Subscription Policy',
    icon: CreditCard,
    content: [
      { heading: 'Non-Refundable Payments', text: 'All subscription payments are non-refundable once purchased. Please review plan features before subscribing.' },
      { heading: 'Access Duration', text: 'Paid access remains active until the end of the selected billing period, regardless of cancellation.' },
      { heading: 'Cancellation Policy', text: 'You can stop future renewal anytime through your account settings. Cancelling does not immediately terminate access — it remains active until the current period ends.' },
      { heading: 'Plan Expiry', text: 'When a subscription expires, access is automatically downgraded to the free tier. No data is deleted.' },
      { heading: 'Free Trial', text: '7-day free trial provides limited feature access. A valid payment method is NOT required for the free trial.' },
      { heading: 'Price Changes', text: 'We reserve the right to change subscription prices. Existing subscribers will be notified 30 days in advance.' },
    ],
  },
  refund: {
    title: 'Refund Policy',
    icon: AlertCircle,
    content: [
      { heading: 'No Refund Policy', text: 'SE7ENFIT does not provide refunds for subscription payments. All sales are final.' },
      { heading: 'Exceptions', text: 'In cases of duplicate payments or technical billing errors, please contact support@se7enfit.app within 7 days.' },
      { heading: 'Chargebacks', text: 'Initiating a chargeback without contacting support first may result in permanent account suspension.' },
      { heading: 'Access After Cancellation', text: 'If you cancel, your paid access continues until the end of the billing period. We do not provide partial refunds for unused time.' },
      { heading: 'Technical Issues', text: 'For technical issues affecting your paid access, contact support and we will extend your subscription accordingly.' },
    ],
  },
};

export default function PolicyPages() {
  const [searchParams] = useSearchParams();
  const type = searchParams.get('type') || 'terms';
  const policy = POLICIES[type] || POLICIES.terms;
  const Icon = policy.icon;

  return (
    <>
      <TopBar title={policy.title} showBack />
      <div className="px-4 py-4 pb-10 max-w-lg mx-auto space-y-4">
        
        <div className="flex items-center gap-3 py-2">
          <div className="w-12 h-12 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <Icon size={22} className="text-accent" />
          </div>
          <div>
            <h1 className="font-heading font-bold text-xl">{policy.title}</h1>
            <p className="text-xs text-muted-foreground">Last updated: June 2026</p>
          </div>
        </div>

        {type === 'subscription' || type === 'refund' ? (
          <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4">
            <p className="font-semibold text-sm text-destructive">⚠️ Important</p>
            <p className="text-xs text-muted-foreground mt-1">All subscription payments are non-refundable once purchased. Paid access remains active until the end of the billing period.</p>
          </div>
        ) : null}

        <div className="space-y-4">
          {policy.content.map((section, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-4">
              <h3 className="font-heading font-semibold text-sm mb-2">{section.heading}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{section.text}</p>
            </div>
          ))}
        </div>

        <div className="bg-muted/40 border border-border rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground">Questions? Contact us at<br />
            <a href="mailto:support@se7enfit.app" className="text-accent font-medium">support@se7enfit.app</a>
          </p>
        </div>
      </div>
    </>
  );
}