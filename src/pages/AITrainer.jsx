import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Bot, Sparkles, RefreshCw, ThumbsUp, Bookmark, Crown, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { GOALS_LABELS } from '@/lib/fitnessUtils';
import { useToast } from '@/components/ui/use-toast';

const CHAT_CONVERSATION_ID = 'ai_trainer_default';

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

function safeText(value) {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    return value.reply || value.text || value.response || value.message || value.error || '';
  }
  return '';
}

function normalizeChatRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter(row => ['user', 'assistant'].includes(row.role) && safeText(row.content).trim())
    .sort((a, b) => String(a.created_date || a.created_at || '').localeCompare(String(b.created_date || b.created_at || '')))
    .map(row => ({
      id: row.id,
      role: row.role,
      content: safeText(row.content),
    }));
}

function getLocalCoachReply(question, context) {
  const goal = context?.profile?.goal || 'fitness';
  const diet = context?.profile?.dietPreference || 'your diet preference';
  const level = context?.profile?.fitnessLevel || 'beginner';
  const steps = context?.tracking?.todaySteps || 0;
  const water = context?.tracking?.todayWaterMl || 0;
  const lower = String(question || '').toLowerCase();

  if (lower.includes('eat') || lower.includes('meal') || lower.includes('protein')) {
    return `Here is a simple SE7EN FIT meal direction for your ${goal} goal and ${diet} diet:\n\n**Today focus:** high protein, controlled calories, and enough water.\n\n**Meal ideas:**\n- Breakfast: eggs/paneer/tofu bhurji with roti or oats\n- Lunch: dal/chicken/paneer bowl with rice or roti and salad\n- Snack: curd, sprouts, fruit, or protein shake\n- Dinner: light protein + vegetables + small carb portion\n\nYou have logged **${water} ml water** today, so keep sipping water through the day.`;
  }

  if (lower.includes('fat loss') || lower.includes('weight loss')) {
    return `For fat loss this week, keep the plan simple:\n\n**Training:** 4 strength sessions + 2 light cardio walks.\n**Nutrition:** eat protein in every meal and avoid liquid calories.\n**Daily target:** 8,000–10,000 steps. You have logged **${steps} steps** today.\n**Rule:** do not crash diet. Stay consistent for 7 days.`;
  }

  if (lower.includes('workout') || lower.includes('gym') || lower.includes('machine')) {
    return `Here is a ${level} friendly workout plan:\n\n**Warm-up:** 5–8 min treadmill/cycle\n**Main workout:**\n1. Chest press — 3 sets x 10–12\n2. Lat pulldown — 3 sets x 10–12\n3. Leg press — 3 sets x 12\n4. Shoulder press — 3 sets x 10\n5. Cable row — 3 sets x 12\n6. Plank — 3 rounds\n\nKeep 60–90 sec rest and use a weight you can control safely.`;
  }

  return `Here is my SE7EN FIT coach advice:\n\nYour current goal is **${goal}**. Keep today focused on three basics: complete your workout, hit your protein, and stay active.\n\nBased on your tracking, you have **${steps} steps** and **${water} ml water** logged today. Improve one small thing today instead of trying to fix everything at once.`;
}

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
  const [currentUser, setCurrentUser] = useState(null);
  const chatEnd = useRef(null);

  useEffect(() => { loadData(); }, []);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const saveChatMessage = async (role, content, userOverride = null) => {
    const user = userOverride || currentUser || await base44.auth.me().catch(() => null);
    const text = safeText(content).trim();
    if (!user?.id || !text) return null;

    return base44.entities.AIChatMessage.create({
      user_id: user.id,
      conversation_id: CHAT_CONVERSATION_ID,
      role,
      content: text,
      source: 'ai_trainer',
    }).catch(error => {
      console.warn('[AITrainer] chat history save failed:', error);
      return null;
    });
  };

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      setCurrentUser(user);
      const today = new Date().toISOString().slice(0, 10);
      const [profiles, subs, usageLogs, chatRows] = await Promise.all([
        base44.entities.UserProfile.filter({ user_id: user.id }).catch(() => []),
        base44.entities.Subscription.filter({ user_id: user.id, status: 'active' }).catch(() => []),
        base44.entities.AIUsageLog.filter({ user_id: user.id, feature: 'ai_trainer', date: today }).catch(() => []),
        base44.entities.AIChatMessage.filter({ user_id: user.id, conversation_id: CHAT_CONVERSATION_ID }, 'created_date', 100).catch(() => []),
      ]);
      const p = Array.isArray(profiles) ? profiles[0] || null : null;
      setProfile(p);
      setSubscription(Array.isArray(subs) ? subs[0] || null : null);
      setUsageCount(Array.isArray(usageLogs) ? usageLogs.filter(l => l.success).length : 0);
      setMessages(normalizeChatRows(chatRows));

      if (p?.primary_gym_id) {
        const [eq] = await Promise.all([
          base44.entities.GymEquipment.filter({ gym_id: p.primary_gym_id }).catch(() => []),
        ]);
        const availableEquipment = Array.isArray(eq) ? eq.filter(e => e.available !== false) : [];
        setGymEquipment(availableEquipment);
        setGymOwner(availableEquipment.length > 0 ? { gym_id: p.primary_gym_id } : null);
      }

      const [waterLogs, stepLogs, nutritionLogs] = await Promise.all([
        base44.entities.WaterLog.filter({ user_id: user.id, date: today }).catch(() => []),
        base44.entities.StepLog.filter({ user_id: user.id, date: today }).catch(() => []),
        base44.entities.NutritionLog.filter({ user_id: user.id, date: today }).catch(() => []),
      ]);

      const water = Array.isArray(waterLogs) ? waterLogs : [];
      const steps = Array.isArray(stepLogs) ? stepLogs : [];
      const nutrition = Array.isArray(nutritionLogs) ? nutritionLogs : [];

      setTodayTracking({
        todayWaterMl: water.reduce((s, l) => s + Number(l.amount_ml || 0), 0),
        todaySteps: steps.reduce((s, l) => s + Number(l.steps || 0), 0),
        todayCalories: nutrition.reduce((s, l) => s + Number(l.calories || 0), 0),
        todayProtein: nutrition.reduce((s, l) => s + Number(l.protein_g || 0), 0),
      });
    } catch (error) {
      console.error('[AITrainer] load failed:', error);
      toast({ title: 'AI profile context could not load', description: 'You can still ask your AI trainer.', variant: 'destructive' });
    }
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

  const sendMessage = async (rawText) => {
    const text = safeText(rawText).trim();
    if (!text || loading || !canSend) return;

    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setUsageCount(c => c + 1);
    saveChatMessage('user', text);

    const context = buildContext();

    try {
      let reply = '';

      if (base44.functions?.invoke) {
        const result = await base44.functions.invoke('geminiService', {
          action: 'askAiTrainer',
          message: text,
          context,
        });

        if (result?.data?.locked) {
          reply = `🔒 **Feature Locked**\n\n${safeText(result.data.message)}\n\nUpgrade your plan from the Subscription page.`;
        } else if (result?.data?.error) {
          reply = `⚠️ ${safeText(result.data.error)}`;
        } else {
          reply = safeText(result?.data?.reply || result?.data || result?.reply || result?.text || result?.response);
        }
      }

      if (!reply) {
        const llm = await base44.integrations.Core.InvokeLLM({
          prompt: `${text}\n\nContext: ${JSON.stringify(context)}`,
        }).catch(() => null);
        reply = safeText(llm?.text || llm?.response || llm);
      }

      if (!reply || reply.includes('AI backend is not connected')) {
        reply = getLocalCoachReply(text, context);
      }

      const assistantContent = safeText(reply) || 'I could not generate a response. Please try again.';
      setMessages(prev => [...prev, { role: 'assistant', content: assistantContent }]);
      saveChatMessage('assistant', assistantContent);

      const user = currentUser || await base44.auth.me().catch(() => null);
      if (user?.id) {
        await base44.entities.AIUsageLog.create({
          user_id: user.id,
          feature: 'ai_trainer',
          date: new Date().toISOString().slice(0, 10),
          success: true,
        }).catch(() => null);
      }
    } catch (error) {
      console.error('[AITrainer] send failed:', error);
      const errorMessage = '⚠️ AI Trainer is temporarily unavailable. Please try again.';
      setMessages(prev => [...prev, { role: 'assistant', content: errorMessage }]);
      saveChatMessage('assistant', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <TopBar title="AI Trainer" showBack />
      <div className="flex flex-col" style={{ height: 'calc(100dvh - 120px)' }}>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
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

          {gymEquipment.length > 0 && (
            <div className="bg-card border border-border rounded-xl px-3 py-2 flex items-center gap-2">
              <Sparkles size={12} className="text-white flex-shrink-0" />
              <p className="text-xs text-muted-foreground">Using {gymEquipment.length} machines from your gym</p>
            </div>
          )}

          {messages.length === 0 && (
            <div className="py-4">
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto rounded-3xl bg-accent/15 flex items-center justify-center mb-3 border border-accent/20">
                  <Bot size={30} className="text-accent" />
                </div>
                <h2 className="font-heading font-bold text-lg">SE7EN FIT AI Coach</h2>
                <p className="text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto leading-relaxed">
                  Personalized coaching for your profile, diet and gym. Chat history is saved automatically.
                </p>
                {profile && (
                  <div className="mt-3 inline-flex items-center gap-2 bg-card border border-border rounded-full px-3 py-1.5">
                    <Zap size={11} className="text-white" />
                    <span className="text-[11px] text-muted-foreground font-medium">
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
                    disabled={!canSend || loading}
                    className="text-left p-3 rounded-2xl border border-border bg-card hover:border-white/30 active:scale-[0.97] transition-all disabled:opacity-40"
                  >
                    <span className="text-base">{p.icon}</span>
                    <p className="text-xs font-medium mt-1.5 leading-tight">{p.label}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.length > 0 && (
            <div className="flex justify-center">
              <span className="text-[10px] text-muted-foreground bg-card border border-border rounded-full px-3 py-1">Chat history saved</span>
            </div>
          )}

          {messages.map((msg, i) => {
            const content = safeText(msg.content) || 'Message unavailable.';
            return (
              <div key={`${msg.id || msg.role}-${i}`} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot size={13} className="text-accent" />
                  </div>
                )}
                <div className={`max-w-[82%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-card border border-border text-foreground rounded-br-sm'
                    : 'bg-card border border-border rounded-bl-sm'
                }`}>
                  {msg.role === 'assistant' ? (
                    <>
                      <ReactMarkdown className="text-sm prose prose-sm prose-invert max-w-none [&_p]:mb-2 [&_ul]:my-1 [&_li]:my-0.5">
                        {content}
                      </ReactMarkdown>
                      <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/50">
                        <button className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><ThumbsUp size={12} className="text-muted-foreground" /></button>
                        <button className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><Bookmark size={12} className="text-muted-foreground" /></button>
                        <button onClick={() => i > 0 && sendMessage(safeText(messages[i - 1]?.content))} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><RefreshCw size={12} className="text-muted-foreground" /></button>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-foreground">{content}</p>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex justify-start gap-2">
              <div className="w-7 h-7 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0">
                <Bot size={13} className="text-accent" />
              </div>
              <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1 items-center">
                  {[0, 150, 300].map(d => (
                    <div key={d} className="w-2 h-2 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                  <span className="text-xs text-muted-foreground ml-2">AI coach is thinking...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEnd} />
        </div>

        <div className="border-t border-border px-4 py-3 bg-background/95 backdrop-blur-xl">
          {!canSend ? (
            <div className="text-center py-2">
              <p className="text-xs text-muted-foreground mb-2">Daily AI limit reached</p>
              <a href="/subscription" className="inline-flex items-center gap-1.5 bg-white text-black text-xs font-semibold px-4 py-2 rounded-xl">
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
                className="h-11 w-11 rounded-xl bg-white text-black hover:bg-white/90 flex-shrink-0"
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
