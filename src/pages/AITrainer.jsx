import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import PremiumGate from '@/components/se7enfit/PremiumGate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Bot, Sparkles, RefreshCw, ThumbsUp, Bookmark, Mic, Crown, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { GOALS_LABELS } from '@/lib/fitnessUtils';

const SUGGESTED_PROMPTS = [
  { icon: '💪', label: 'Create workout plan', prompt: 'Create a personalized workout plan for me based on my profile' },
  { icon: '🥗', label: 'Meal plan', prompt: 'What should I eat today based on my diet preference and fitness goal?' },
  { icon: '📊', label: 'Review progress', prompt: 'Review my progress and give advice to improve' },
  { icon: '🔥', label: 'Fat loss plan', prompt: 'Give me a complete fat loss plan for this week' },
  { icon: '🍗', label: 'High-protein meals', prompt: 'Give me 5 high-protein Indian meal ideas' },
  { icon: '🏃', label: 'Missed gym?', prompt: 'I missed gym today, what home workout can I do?' },
  { icon: '💡', label: 'Motivate me', prompt: 'Motivate me with tips to stay consistent with my fitness journey' },
  { icon: '🧘', label: 'Injury advice', prompt: 'I have knee pain, how should I adjust my workout?' },
];

export default function AITrainer() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [messageCount, setMessageCount] = useState(0);
  const chatEnd = useRef(null);

  useEffect(() => { loadData(); }, []);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const loadData = async () => {
    const user = await base44.auth.me();
    const [profiles, subs] = await Promise.all([
      base44.entities.UserProfile.filter({ user_id: user.id }),
      base44.entities.Subscription.filter({ user_id: user.id, status: 'active' }),
    ]);
    if (profiles.length) setProfile(profiles[0]);
    setSubscription(subs[0] || null);
  };

  const isPremium = subscription && subscription.plan !== 'free';
  const FREE_LIMIT = 3;
  const canSend = isPremium || messageCount < FREE_LIMIT;

  const buildContext = () => {
    if (!profile) return '';
    return `User: ${profile.full_name}, Age: ${profile.age}, Gender: ${profile.gender}, Height: ${profile.height_cm}cm, Weight: ${profile.weight_kg}kg, Target: ${profile.target_weight_kg}kg, Goal: ${GOALS_LABELS[profile.goal] || profile.goal}, Level: ${profile.fitness_level}, Gym Access: ${profile.gym_access ? 'Yes' : 'No'}, Diet: ${profile.diet_preference?.replace(/_/g, ' ')}, Workout Days: ${profile.workout_days_per_week}/week, Medical Notes: ${profile.medical_notes || 'None'}.`;
  };

  const sendMessage = async (text) => {
    if (!text.trim() || loading) return;
    if (!canSend) return;

    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setMessageCount(c => c + 1);

    const systemPrompt = `You are SE7ENFIT AI Trainer — a friendly, expert Indian fitness coach. You help users with workouts, diet, nutrition, form, motivation, and fitness Q&A.

CONTEXT: ${buildContext()}

RULES:
- Be practical, helpful, and motivational. Use Indian context (Indian foods, local gyms, INR prices).
- Metric units (kg, cm, kcal). Prices in INR (₹).
- Add safety disclaimers for injuries/medical. Never recommend steroids or dangerous supplements.
- Keep responses concise but actionable. Format with markdown. Use emojis sparingly.`;

    const fullPrompt = `${systemPrompt}\n\nConversation:\n${messages.map(m => `${m.role}: ${m.content}`).join('\n')}\nuser: ${text}\nassistant:`;
    const response = await base44.integrations.Core.InvokeLLM({ prompt: fullPrompt });
    setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    setLoading(false);
  };

  return (
    <>
      <TopBar title="AI Trainer" showBack />
      <div className="flex flex-col" style={{ height: 'calc(100dvh - 120px)' }}>
        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

          {/* Premium Banner if free */}
          {!isPremium && (
            <div className="bg-gradient-to-r from-yellow-500/10 to-amber-400/5 border border-yellow-500/20 rounded-2xl p-3 flex items-center gap-3">
              <Crown size={16} className="text-yellow-400 flex-shrink-0" />
              <p className="text-xs text-muted-foreground flex-1">
                {FREE_LIMIT - messageCount > 0
                  ? <><span className="text-foreground font-medium">{FREE_LIMIT - messageCount} free messages</span> left. Upgrade for unlimited AI coaching.</>
                  : <><span className="text-yellow-400 font-medium">Free limit reached.</span> Upgrade for unlimited coaching.</>}
              </p>
            </div>
          )}

          {messages.length === 0 && (
            <div className="py-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto rounded-3xl bg-accent/15 flex items-center justify-center mb-3 border border-accent/20">
                  <Bot size={30} className="text-accent" />
                </div>
                <h2 className="font-heading font-bold text-lg">SE7ENFIT AI Coach</h2>
                <p className="text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto leading-relaxed">
                  Your personal AI trainer, powered by your profile. Ask anything about fitness, diet, or wellness!
                </p>
                {profile && (
                  <div className="mt-3 inline-flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full px-3 py-1.5">
                    <Sparkles size={11} className="text-accent" />
                    <span className="text-[11px] text-accent font-medium">
                      Tuned for {GOALS_LABELS[profile.goal] || 'your goal'} • {profile.diet_preference?.replace(/_/g, ' ')}
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
                  <span className="text-xs text-muted-foreground ml-2">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEnd} />
        </div>

        {/* Input Area */}
        <div className="border-t border-border px-4 py-3 bg-background/95 backdrop-blur-xl">
          {!canSend ? (
            <div className="text-center py-2">
              <p className="text-xs text-muted-foreground mb-2">Free limit reached</p>
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