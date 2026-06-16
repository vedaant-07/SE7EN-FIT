import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Bot, Sparkles, RefreshCw, ThumbsUp, ThumbsDown, Mic, Bookmark } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { getToday, GOALS_LABELS } from '@/lib/fitnessUtils';

const SUGGESTED_PROMPTS = [
  '💪 Create my workout plan',
  '🥗 What should I eat today?',
  '📊 Review my progress',
  '🔥 Make my fat loss plan',
  '🍗 High-protein meal plan',
  '🏃 I missed gym, what to do?',
  '💡 Give me motivation',
  '🧘 Adjust plan for knee pain',
  '📝 Explain bench press form',
  '🥚 Vegetarian protein sources',
];

export default function AITrainer() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const chatEnd = useRef(null);

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadProfile = async () => {
    const user = await base44.auth.me();
    const profiles = await base44.entities.UserProfile.filter({ user_id: user.id });
    if (profiles.length) setProfile(profiles[0]);
  };

  const buildContext = () => {
    if (!profile) return '';
    return `User Profile: Name: ${profile.full_name}, Age: ${profile.age}, Gender: ${profile.gender}, Height: ${profile.height_cm}cm, Weight: ${profile.weight_kg}kg, Target: ${profile.target_weight_kg}kg, Goal: ${GOALS_LABELS[profile.goal] || profile.goal}, Level: ${profile.fitness_level}, Gym: ${profile.gym_access ? 'Yes' : 'No'}, Diet: ${profile.diet_preference?.replace('_', ' ')}, Workout days: ${profile.workout_days_per_week}/week, Medical: ${profile.medical_notes || 'None'}.`;
  };

  const sendMessage = async (text) => {
    if (!text.trim()) return;
    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const systemPrompt = `You are SE7ENFIT AI Trainer - a friendly, knowledgeable Indian fitness coach. You help users with workouts, diet, nutrition, form tips, motivation, and fitness Q&A. 

CONTEXT: ${buildContext()}

RULES:
- Be practical, helpful, and motivational
- Give advice suitable for Indian gym users (Indian foods, budget-friendly options)
- Use metric units (kg, cm, calories)
- Prices in INR (₹)
- Add safety disclaimers for injuries, medical conditions
- Never recommend steroids or unsafe supplements
- Recommend consulting a doctor for medical concerns
- Keep responses concise but informative
- Use emojis sparingly for engagement
- Format with markdown for readability`;

    const fullPrompt = `${systemPrompt}\n\nConversation:\n${messages.map(m => `${m.role}: ${m.content}`).join('\n')}\nuser: ${text}\nassistant:`;

    const response = await base44.integrations.Core.InvokeLLM({ prompt: fullPrompt });
    setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    setLoading(false);
  };

  return (
    <>
      <TopBar title="AI Trainer" showBack />
      <div className="flex flex-col" style={{ height: 'calc(100vh - 130px)' }}>
        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
                <Bot size={32} className="text-accent" />
              </div>
              <h2 className="font-heading font-bold text-lg">AI Fitness Trainer</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
                Your personal AI coach. Ask me anything about workouts, diet, nutrition, or fitness!
              </p>

              {/* Suggested Prompts */}
              <div className="mt-6 flex flex-wrap gap-2 justify-center">
                {SUGGESTED_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(prompt.replace(/^[^\s]+\s/, ''))}
                    className="text-xs px-3 py-2 rounded-full border border-border bg-card hover:border-accent/30 transition-all active:scale-95"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-accent text-accent-foreground rounded-br-sm'
                  : 'bg-card border border-border rounded-bl-sm'
              }`}>
                {msg.role === 'assistant' ? (
                  <>
                    <ReactMarkdown className="text-sm prose prose-sm prose-invert max-w-none">{msg.content}</ReactMarkdown>
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                      <button className="p-1 hover:bg-accent/10 rounded"><ThumbsUp size={12} className="text-muted-foreground" /></button>
                      <button className="p-1 hover:bg-accent/10 rounded"><ThumbsDown size={12} className="text-muted-foreground" /></button>
                      <button className="p-1 hover:bg-accent/10 rounded"><Bookmark size={12} className="text-muted-foreground" /></button>
                      <button onClick={() => sendMessage(messages[i - 1]?.content || '')} className="p-1 hover:bg-accent/10 rounded"><RefreshCw size={12} className="text-muted-foreground" /></button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm">{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs text-muted-foreground">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEnd} />
        </div>

        {/* Input Area */}
        <div className="border-t border-border p-3 bg-background/95 backdrop-blur-xl">
          <div className="max-w-lg mx-auto flex gap-2">
            <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-card border border-border text-muted-foreground">
              <Mic size={18} />
            </button>
            <div className="flex-1 relative">
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !loading && sendMessage(input)}
                placeholder="Ask your AI trainer..."
                className="h-10 pr-10 rounded-xl bg-card border-border"
              />
            </div>
            <Button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              size="icon"
              className="h-10 w-10 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Send size={16} />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}