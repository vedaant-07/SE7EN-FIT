import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Heart, MessageCircle, Plus, X, Send } from 'lucide-react';

const POST_TYPES = ['general', 'transformation', 'workout', 'meal', 'achievement'];
const TYPE_COLORS = { general: 'bg-blue-500/10 text-blue-400', transformation: 'bg-purple-500/10 text-purple-400', workout: 'bg-green-500/10 text-green-400', meal: 'bg-orange-500/10 text-orange-400', achievement: 'bg-yellow-500/10 text-yellow-400' };

export default function Community() {
  const [posts, setPosts] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: 'general', content: '' });
  const [posting, setPosting] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const u = await base44.auth.me();
    setUser(u);
    const allPosts = await base44.entities.CommunityPost.list('-created_date', 30);
    setPosts(allPosts);
    setLoading(false);
  };

  const handlePost = async () => {
    if (!form.content.trim()) return;
    setPosting(true);
    await base44.entities.CommunityPost.create({
      user_id: user.id,
      user_name: user.full_name || 'Anonymous',
      type: form.type,
      content: form.content,
      likes_count: 0,
      comments_count: 0,
    });
    setForm({ type: 'general', content: '' });
    setShowForm(false);
    loadData();
    setPosting(false);
  };

  const handleLike = async (post) => {
    await base44.entities.CommunityPost.update(post.id, { likes_count: (post.likes_count || 0) + 1 });
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes_count: (p.likes_count || 0) + 1 } : p));
  };

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" /></div>;

  return (
    <>
      <TopBar title="Community" showBack />
      <div className="px-4 py-4 space-y-4 pb-24">
        <Button onClick={() => setShowForm(!showForm)} className="w-full h-11 rounded-xl bg-accent text-accent-foreground">
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Share Update'}
        </Button>

        {showForm && (
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <div className="flex gap-2 flex-wrap">
              {POST_TYPES.map(t => (
                <button key={t} onClick={() => setForm(p => ({ ...p, type: t }))} className={`text-xs px-3 py-1 rounded-full border transition-all ${form.type === t ? 'bg-accent text-accent-foreground border-accent' : 'border-border text-muted-foreground'}`}>
                  {t}
                </button>
              ))}
            </div>
            <textarea
              placeholder="Share your fitness journey..."
              value={form.content}
              onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
              className="w-full bg-background border border-border rounded-xl p-3 text-sm resize-none h-24 focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <Button onClick={handlePost} disabled={posting || !form.content.trim()} className="w-full h-10 rounded-xl bg-accent text-accent-foreground">
              <Send size={14} className="mr-1" /> Post
            </Button>
          </div>
        )}

        {posts.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-4xl mb-2">💪</p>
            <p className="text-sm">Be the first to share!</p>
          </div>
        )}

        <div className="space-y-4">
          {posts.map(post => (
            <div key={post.id} className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center text-sm font-bold text-accent">
                  {(post.user_name || 'A')[0].toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{post.user_name || 'Anonymous'}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(post.created_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${TYPE_COLORS[post.type] || 'bg-muted text-muted-foreground'}`}>{post.type}</span>
              </div>

              <p className="text-sm leading-relaxed">{post.content}</p>
              {post.image_url && <img src={post.image_url} alt="post" className="w-full rounded-xl object-cover max-h-60" />}

              <div className="flex items-center gap-4 pt-1 border-t border-border">
                <button onClick={() => handleLike(post)} className="flex items-center gap-1.5 text-muted-foreground hover:text-red-500 transition-colors">
                  <Heart size={15} />
                  <span className="text-xs">{post.likes_count || 0}</span>
                </button>
                <button className="flex items-center gap-1.5 text-muted-foreground">
                  <MessageCircle size={15} />
                  <span className="text-xs">{post.comments_count || 0}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}