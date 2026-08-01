import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, Check, Crown, Edit2, RefreshCw, Send, Sparkles, Square, Trash2, X } from 'lucide-react';
import TopBar from '@/components/se7enfit/TopBar';
import EmptyState from '@/components/se7enfit/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { memberProductClient } from '@/api/memberProductClient';

const CONVERSATION_ID = 'ai_trainer_default';
const CACHE_KEY = 'se7enfit_member_ai_history_v2';
const SUGGESTED_PROMPTS = [
  { icon: '💪', label: 'Create today’s workout', prompt: 'Create a safe workout for today based on my goal, fitness level and available gym equipment.' },
  { icon: '🥗', label: 'Plan today’s meals', prompt: 'Suggest practical Indian meals for today based on my calorie and protein targets.' },
  { icon: '📊', label: 'Review my progress', prompt: 'Review today’s activity and nutrition and give me three practical improvements.' },
  { icon: '🏃', label: 'Missed the gym', prompt: 'I missed the gym today. Give me a safe home workout alternative.' },
  { icon: '🧘', label: 'Low-impact session', prompt: 'Suggest a low-impact workout and explain how to keep it safe.' },
  { icon: '🍗', label: 'Protein ideas', prompt: 'Give me five practical high-protein Indian meal ideas.' },
];

function normalizeMessages(rows) {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => ['user', 'assistant'].includes(row.role) && String(row.content || '').trim())
    .map((row) => ({
      ...row,
      id: row.id || row.message_id,
      content: String(row.content || '').trim(),
    }));
}

function loadCache() {
  try {
    return normalizeMessages(JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'));
  } catch {
    return [];
  }
}

function saveCache(messages) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(normalizeMessages(messages).slice(-100)));
  } catch {
    // Storage can be unavailable in private browsing; server history remains canonical.
  }
}

function localId(prefix) {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

export default function AITrainer() {
  const { toast } = useToast();
  const [messages, setMessages] = useState(loadCache);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [offlineCache, setOfflineCache] = useState(false);
  const [locked, setLocked] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [remaining, setRemaining] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const activeRequest = useRef(null);
  const chatEnd = useRef(null);

  const loadHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await memberProductClient.getAiHistory(CONVERSATION_ID);
      const next = normalizeMessages(data.messages);
      setMessages(next);
      saveCache(next);
      setOfflineCache(false);
    } catch (requestError) {
      const cached = loadCache();
      setMessages(cached);
      setOfflineCache(cached.length > 0);
      setError(cached.length > 0
        ? 'Showing saved chat history. Reconnect to sync new messages.'
        : requestError.message || 'Could not load AI Coach.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadHistory(); }, []);
  useEffect(() => {
    saveCache(messages);
    chatEnd.current?.scrollIntoView({ behavior: loading ? 'auto' : 'smooth' });
  }, [messages, sending, loading]);

  const sendMessage = async (value) => {
    const text = String(value || '').trim();
    if (!text || sending || locked || limitReached) return;

    const requestId = memberProductClient.newRequestId('coach');
    activeRequest.current = requestId;
    const optimisticId = localId('user');
    setMessages((current) => [...current, { id: optimisticId, role: 'user', content: text }]);
    setInput('');
    setSending(true);
    setError('');

    try {
      const result = await memberProductClient.sendAiMessage({
        message: text,
        conversationId: CONVERSATION_ID,
        requestId,
      });
      if (activeRequest.current !== requestId) return;
      const history = await memberProductClient.getAiHistory(CONVERSATION_ID).catch(() => null);
      if (history?.messages) {
        setMessages(normalizeMessages(history.messages));
      } else {
        setMessages((current) => [
          ...current.map((row) => row.id === optimisticId ? { ...row, id: `${requestId}:user` } : row),
          { id: result.message?.id || `${requestId}:assistant`, role: 'assistant', content: result.reply },
        ]);
      }
      setRemaining(result.usage?.remaining ?? null);
      setOfflineCache(false);
    } catch (requestError) {
      if (activeRequest.current !== requestId) return;
      setMessages((current) => current.filter((row) => row.id !== optimisticId));
      if (requestError.code === 'feature_locked') setLocked(true);
      if (requestError.code === 'quota_exceeded') setLimitReached(true);
      setError(requestError.message || 'AI Coach is temporarily unavailable.');
      toast({ title: 'AI Coach request failed', description: requestError.message, variant: 'destructive' });
    } finally {
      if (activeRequest.current === requestId) activeRequest.current = null;
      setSending(false);
    }
  };

  const stopGeneration = () => {
    activeRequest.current = null;
    setSending(false);
    toast({ title: 'Response hidden', description: 'The current response will not be added to this screen.' });
  };

  const clearHistory = async () => {
    if (!window.confirm('Clear your complete AI Coach chat history?')) return;
    try {
      await memberProductClient.clearAiHistory(CONVERSATION_ID);
      setMessages([]);
      saveCache([]);
      setError('');
      toast({ title: 'Chat history cleared' });
    } catch (requestError) {
      toast({ title: 'Could not clear history', description: requestError.message, variant: 'destructive' });
    }
  };

  const startEdit = (message) => {
    if (message.role !== 'user') return;
    setEditingId(message.id);
    setEditingText(message.content);
  };

  const saveEdit = async () => {
    const text = editingText.trim();
    if (!text || !editingId || String(editingId).startsWith('local:')) return;
    try {
      const result = await memberProductClient.updateAiMessage(editingId, text);
      setMessages((current) => current.map((row) => row.id === editingId
        ? { ...row, content: result.message?.content || text }
        : row));
      setEditingId(null);
      setEditingText('');
    } catch (requestError) {
      toast({ title: 'Could not edit message', description: requestError.message, variant: 'destructive' });
    }
  };

  const deleteMessage = async (message) => {
    if (String(message.id).startsWith('local:')) {
      setMessages((current) => current.filter((row) => row.id !== message.id));
      return;
    }
    try {
      await memberProductClient.deleteAiMessage(message.id);
      setMessages((current) => current.filter((row) => row.id !== message.id));
    } catch (requestError) {
      toast({ title: 'Could not delete message', description: requestError.message, variant: 'destructive' });
    }
  };

  const disabled = sending || locked || limitReached;

  return (
    <>
      <TopBar title="AI Coach" showBack />
      <div className="flex flex-col" style={{ height: 'calc(100dvh - 120px)' }}>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div className="rounded-2xl border border-border bg-card p-3 flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
              <Sparkles size={16} className="text-accent" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold">Personalized from your verified SE7EN FIT data</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Fitness guidance is educational and does not replace medical care.</p>
              {remaining !== null && <p className="text-[10px] text-accent mt-1">{remaining} plan messages remaining in this period</p>}
            </div>
          </div>

          {(error || offlineCache) && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-center justify-between gap-3">
              <p className="text-xs text-amber-100/90">{error}</p>
              <button onClick={() => void loadHistory()} className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-200">
                <RefreshCw size={11} /> Retry
              </button>
            </div>
          )}

          {(locked || limitReached) && (
            <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-center">
              <Crown size={22} className="text-yellow-400 mx-auto mb-2" />
              <p className="text-sm font-semibold">{locked ? 'AI Coach is not included in this plan' : 'AI Coach limit reached'}</p>
              <p className="text-xs text-muted-foreground mt-1">Upgrade to continue with a higher limit or unlimited coaching.</p>
              <a href="/subscription" className="inline-flex mt-3 rounded-xl bg-white px-4 py-2 text-xs font-bold text-black">View plans</a>
            </div>
          )}

          {loading && messages.length === 0 && (
            <div className="min-h-[45vh] flex items-center justify-center">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs text-muted-foreground">Loading secure chat history…</p>
              </div>
            </div>
          )}

          {!loading && messages.length === 0 && !error && (
            <div className="py-3">
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto rounded-3xl bg-accent/15 border border-accent/20 flex items-center justify-center mb-3">
                  <Bot size={30} className="text-accent" />
                </div>
                <h2 className="font-heading font-bold text-lg">Your SE7EN FIT Coach</h2>
                <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto">Ask about workouts, recovery, meals and today’s progress.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {SUGGESTED_PROMPTS.map((item) => (
                  <button key={item.label} onClick={() => void sendMessage(item.prompt)} disabled={disabled}
                    className="text-left p-3 rounded-2xl border border-border bg-card hover:border-accent/30 active:scale-[0.98] transition-all disabled:opacity-40">
                    <span className="text-base">{item.icon}</span>
                    <p className="text-xs font-medium mt-1.5 leading-tight">{item.label}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.length > 0 && (
            <div className="flex items-center justify-center gap-2">
              <span className="text-[10px] text-muted-foreground bg-card border border-border rounded-full px-3 py-1">Server-synced history</span>
              <button onClick={() => void clearHistory()} className="text-[10px] bg-card border border-border rounded-full px-3 py-1 text-red-400 flex items-center gap-1">
                <Trash2 size={10} /> Clear all
              </button>
            </div>
          )}

          {messages.map((message) => {
            const editing = editingId === message.id;
            return (
              <div key={message.id} className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {message.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-xl bg-accent/15 flex items-center justify-center shrink-0 mt-1">
                    <Bot size={13} className="text-accent" />
                  </div>
                )}
                <div className={`max-w-[84%] rounded-2xl border border-border bg-card px-4 py-3 ${message.role === 'user' ? 'rounded-br-sm' : 'rounded-bl-sm'}`}>
                  {editing ? (
                    <div className="space-y-2">
                      <textarea value={editingText} onChange={(event) => setEditingText(event.target.value)} rows={4}
                        className="w-full min-w-[230px] resize-none rounded-xl border border-border bg-background p-2 text-sm outline-none focus:ring-1 focus:ring-accent" />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => { setEditingId(null); setEditingText(''); }} className="h-8 px-2 rounded-lg bg-muted text-[10px] flex items-center gap-1"><X size={12} /> Cancel</button>
                        <button onClick={() => void saveEdit()} className="h-8 px-2 rounded-lg bg-white text-black text-[10px] font-bold flex items-center gap-1"><Check size={12} /> Save</button>
                      </div>
                    </div>
                  ) : message.role === 'assistant' ? (
                    <ReactMarkdown className="text-sm prose prose-sm prose-invert max-w-none [&_p]:mb-2 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5">
                      {message.content}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  )}
                  {!editing && (
                    <div className={`flex gap-1 mt-2 pt-2 border-t border-border/50 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {message.role === 'user' && !String(message.id).startsWith('local:') && (
                        <button onClick={() => startEdit(message)} aria-label="Edit message" className="p-1.5 rounded-lg hover:bg-muted"><Edit2 size={12} className="text-muted-foreground" /></button>
                      )}
                      <button onClick={() => void deleteMessage(message)} aria-label="Delete message" className="p-1.5 rounded-lg hover:bg-muted"><Trash2 size={12} className="text-red-400" /></button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {sending && (
            <div className="flex justify-start gap-2">
              <div className="w-7 h-7 rounded-xl bg-accent/15 flex items-center justify-center shrink-0"><Bot size={13} className="text-accent" /></div>
              <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
                <div className="flex gap-1">{[0, 160, 320].map((delay) => <span key={delay} className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />)}</div>
                <span className="text-xs text-muted-foreground">Coach is thinking…</span>
                <button onClick={stopGeneration} className="ml-1 h-7 px-2 rounded-lg bg-white text-black text-[10px] font-bold flex items-center gap-1"><Square size={10} /> Stop</button>
              </div>
            </div>
          )}
          <div ref={chatEnd} />
        </div>

        <div className="border-t border-border px-4 py-3 bg-background/95 backdrop-blur-xl safe-area-bottom">
          {locked || limitReached ? (
            <a href="/subscription" className="flex h-11 items-center justify-center rounded-xl bg-white text-black text-sm font-bold">Upgrade plan</a>
          ) : (
            <div className="flex gap-2">
              <Input value={input} onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(input); } }}
                placeholder="Ask your AI Coach…" disabled={sending} className="flex-1 h-11 rounded-xl bg-card border-border text-sm" />
              {sending ? (
                <Button onClick={stopGeneration} size="icon" className="h-11 w-11 rounded-xl bg-white text-black"><Square size={15} /></Button>
              ) : (
                <Button onClick={() => void sendMessage(input)} disabled={!input.trim()} size="icon" className="h-11 w-11 rounded-xl bg-white text-black"><Send size={16} /></Button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
