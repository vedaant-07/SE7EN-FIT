import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Bot, Sparkles, RefreshCw, ThumbsUp, Bookmark, Crown, Zap, Lock, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { GOALS_LABELS } from '@/lib/fitnessUtils';
import { useToast } from '@/components/ui/use-toast';

const SUGGESTED_PROMPTS = [
  { icon: '💪', label: 'Create workout plan', prompt: 'Create a personalized gym-based workout plan for me based on my profile and available equipment' },
  { icon: '🥗', label: 'What to eat today', prompt: 'What should I eat today based on my diet preference and fitness goal? Give me Indian meal options.' },
  { icon: '📊', label: 'Review my progress', prompt: 'Review my progress and give me advice to improve this week' },
  { icon: '🔥', label: 'Fat loss plan', prompt: 'Give me a complete fat loss plan for this week with workout and diet tips' },
  { icon: '🍗', label: 'High-protein meals', prompt: 'Give me 5 high-protein Indian meal ideas that are easy to make' },
  { icon: '🏃', label: 'Missed gym?', prompt: 'I missed gym today, what home workout can I do instead?' },
  { icon: '🏋️', label: 'Gym machine workout', prompt: 'Suggest a workout using my gym machines' },
  { icon: '🧘', label: 'Injury-safe workout', prompt: 'I have knee pain, how should I adjust my workout to stay safe?' },
];

export default function AITrainer() {
  const { toast } = useToast();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [gymEquipment, setGymEquipment] = useState([]);
  const [gymOwner, setGymOwner] = useState(null);
  const [todayTracking, setTodayTracking] = useState({});
  const [usageCount, setUsageCount] = useState(0);
  const chatEnd = useRef(null);

  useEffect(() => { loadData(); }, []);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const loadData = async () => {
    const user = await base44.auth.me();
    const today = new Date().toISOString().slice(0, 10);
    const [profiles, subs, usageLogs] = await Promise.all([
      base44.entities.UserProfile.filter({ user_id: user.id }),
      base44.entities.Subscription.filter({ user_id: user.id, status: 'active' }),
      base44.entities.AIUsageLog.filter({ user_id: user.id, feature: 'ai_trainer', date: today }),
    ]);
    const p = profiles[0] || null;
    setProfile(p);
    setSubscription(subs[0] || null);
    setUsageCount(usageLogs.filter(l => l.success).length);

    if (p?.primary_gym_id) {
      const [eq, gym] = await Promise.all([
        base44.entities.GymEquipment.filter({ gym_id: p.primary_gym_id }),
        base44.entities.GymOwner.filter({ user_id: p.primary_gym_id }),
      ]);
      setGymEquipment(eq.filter(e => e.available));
      setGymOwner(eq.length > 0 ? { gym_id: p.primary_gym_id } : null);
    }

    // Load today's tracking
    const [waterLogs, stepLogs, nutritionLogs] = await Promise.all([
      base44.entities.WaterLog.filter({ user_id: user.id, date: today }),
      base44.entities.StepLog.filter({ user_id: user.id, date: today }),
      base44.entities.NutritionLog.filter({ user_id: user.id, date: today }),
    ]).catch(() => [[], [], []]);
    setTodayTracking({
      todayWaterMl: waterLogs.reduce((s, l) => s + (l.amount_ml || 0), 0),
      todaySteps: stepLogs[0]?.steps || 0,
      todayCalories: nutritionLogs.reduce((s, l) => s + (l.calories || 0), 0),
      todayProtein: nutritionLogs.reduce((s, l) => s + (l.protein_g || 0), 0),
    });
  };

  const plan = subscription?.plan || 'free';
  const isPremium = ['premium_monthly', 'premium_quarterly', 'premium_annual'].includes(plan);
  const FREE_LIMIT = plan === 'free_trial' ? 5 : plan === 'basic_monthly' ? 20 : 3;
  const canSend = isPremium || usageCount < FREE_LIMIT;

  const buildContext = () => ({
    profile: profile ? {
      name: profile.full_name,
      age: profile.age,
      gender: profile.gender,
      height_cm: profile.height_cm,
      weight_kg: profile.weight_kg,
      target_weight_kg: profile.target_weight_kg,
      goal: GOALS_LABELS[profile.goal] || profile.goal,
      fitnessLevel: profile.fitness_level,
      dietPreference: profile.diet_preference?.replace(/_/g, ' '),
      workoutDaysPerWeek: profile.workout_days_per_week,
      injuries: profile.medical_notes || profile.injuries,
    } : {},
    tracking: todayTracking,
    equipment: gymEquipment,
    gym: gymOwner ? { gym_id: gymOwner.gym_id, equipmentCount: gymEquipment.length } : null,
  });

  const sendMessage = async (text) => {
    if (!text.trim() || loading || !canSend) return;

    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setUsageCount(c => c + 1);

    try {
      const result = await base44.functions.invoke('geminiService', {
        action: 'askAiTrainer',
        message: text,
        context: buildContext(),
      });

      if (result.data?.locked) {
        setMessages(prev => [...prev, { role: 'assistant', content: `🔒 **Feature Locked**\n\n${result.data.message}\n\n[Upgrade your plan →](/subscription)` }]);
      } else if (result.data?.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${result.data.error}` }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: result.data.reply }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ AI Trainer is temporarily unavailable. Please try again.' }]);
    }
    setLoading(false);
  };

  return (
    <>
      <TopBar title="AI Trainer" showBack />
      <div className="flex flex-col" style={{ height: 'calc(100dvh - 120px)' }}>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

          {/* Usage / Premium Banner */}
          {!isPremium && (
            <div className="bg-gradient-to-r from-yellow-500/10 to-amber-400/5 border border-yellow-500/20 rounded-2xl p-3 flex items-center gap-3">
              <Crown size={16} className="text-yellow-400 flex-shrink-0" />
              <p className="text-xs text-muted-foreground flex-1">
                {canSend
                  ? <><span className="text-foreground font-medium">{FREE_LIMIT - usageCount} AI messages</span> left today. Upgrade for unlimited.</>
                  : <><span className="text-yellow-400 font-medium">Daily limit reached.</span> Upgrade for unlimited coaching.</>}
              </p>
              {!canSend && (
                <a href="/subscription" className="text-xs bg-yellow-500 text-black font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 flex-shrink-0">
                  <Crown size={11} /> Upgrade
                </a>
              )}
            </div>
          )}

          {/* Gym equipment context chip */}
          {gymEquipment.length > 0 && (
            <div className="bg-accent/5 border border-accent/20 rounded-xl px-3 py-2 flex items-center gap-2">
              <Sparkles size={12} className="text-accent flex-shrink-0" />
              <p className="text-xs text-accent">Using {gymEquipment.length} machines from your gym</p>
            </div>
          )}

          {/* Empty state with prompts */}
          {messages.length === 0 && (
            <div className="py-4">
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto rounded-3xl bg-accent/15 flex items-center justify-center mb-3 border border-accent/20">
                  <Bot size={30} className="text-accent" />
                </div>
                <h2 className="font-heading font-bold text-lg">SE7ENFIT AI Coach</h2>
                <p className="text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto leading-relaxed">
                  Powered by Google Gemini. Personalized for your profile, diet & gym.
                </p>
                {profile && (
                  <div className="mt-3 inline-flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full px-3 py-1.5">
                    <Zap size={11} className="text-accent" />
                    <span className="text-[11px] text-accent font-medium">
                      {GOALS_LABELS[profile.goal] || 'Your goal'} • {profile.diet_preference?.replace(/_/g, ' ')} • {profile.fitness_level}
                    </span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {SUGGESTED_PROMPTS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => canSend && sendMessage(p.prompt)}
                    disabled={!canSend}
                    className="text-left p-3 rounded-2xl border border-border bg-card hover:border-accent/30 active:scale-[0.97] transition-all disabled:opacity-40"
                  >
                    <span className="text-base">{p.icon}</span>
                    <p className="text-xs font-medium mt-1.5 leading-tight">{p.label}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot size={13} className="text-accent" />
                </div>
              )}
              <div className={`max-w-[82%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-accent text-accent-foreground rounded-br-sm'
                  : 'bg-card border border-border rounded-bl-sm'
              }`}>
                {msg.role === 'assistant' ? (
                  <>
                    <ReactMarkdown className="text-sm prose prose-sm prose-invert max-w-none [&_p]:mb-2 [&_ul]:my-1 [&_li]:my-0.5">
                      {msg.content}
                    </ReactMarkdown>
                    <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/50">
                      <button className="p-1.5 hover:bg-accent/10 rounded-lg transition-colors"><ThumbsUp size={12} className="text-muted-foreground" /></button>
                      <button className="p-1.5 hover:bg-accent/10 rounded-lg transition-colors"><Bookmark size={12} className="text-muted-foreground" /></button>
                      <button onClick={() => i > 0 && sendMessage(messages[i - 1]?.content)} className="p-1.5 hover:bg-accent/10 rounded-lg transition-colors"><RefreshCw size={12} className="text-muted-foreground" /></button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm">{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start gap-2">
              <div className="w-7 h-7 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0">
                <Bot size={13} className="text-accent" />
              </div>
              <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1 items-center">
                  {[0, 150, 300].map(d => (
                    <div key={d} className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                  <span className="text-xs text-muted-foreground ml-2">Gemini is thinking...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEnd} />
        </div>

        {/* Input */}
        <div className="border-t border-border px-4 py-3 bg-background/95 backdrop-blur-xl">
          {!canSend ? (
            <div className="text-center py-2">
              <p className="text-xs text-muted-foreground mb-2">Daily AI limit reached</p>
              <a href="/subscription" className="inline-flex items-center gap-1.5 bg-yellow-500 text-black text-xs font-semibold px-4 py-2 rounded-xl">
                <Crown size={12} /> Upgrade for Unlimited AI
              </a>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !loading && sendMessage(input)}
                placeholder="Ask your AI trainer..."
                className="flex-1 h-11 rounded-xl bg-card border-border text-sm"
              />
              <Button
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim()}
                size="icon"
                className="h-11 w-11 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 flex-shrink-0"
              >
                <Send size={16} />
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}