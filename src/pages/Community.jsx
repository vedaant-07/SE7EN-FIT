import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import EmptyState from '@/components/se7enfit/EmptyState';
import MediaUploadCropper from '@/components/se7enfit/MediaUploadCropper';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Plus, X, Send, Users, Edit2, Trash2, Check } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const POST_TYPES = [
  { key: 'general', label: 'General', icon: '💬', color: 'bg-muted text-muted-foreground' },
  { key: 'workout', label: 'Workout', icon: '💪', color: 'bg-muted text-muted-foreground' },
  { key: 'meal', label: 'Meal', icon: '🥗', color: 'bg-muted text-muted-foreground' },
  { key: 'transformation', label: 'Transform', icon: '🔥', color: 'bg-muted text-muted-foreground' },
  { key: 'achievement', label: 'Achievement', icon: '🏆', color: 'bg-muted text-muted-foreground' },
];

const emptyPost = { content: '', type: 'general', media_url: '', image_url: '', video_url: '', media_type: 'image', media_crop: 'center center' };

function canManagePost(post, user, profile) {
  if (!post || !user) return false;
  const isOwner = String(post.user_id) === String(user.id);
  const isAdmin = ['admin', 'super_admin'].includes(user.role) || ['admin', 'super_admin'].includes(profile?.role);
  return isOwner || isAdmin;
}

function isVideoPost(post) {
  const type = String(post.media_type || '').toLowerCase();
  const url = String(post.media_url || post.video_url || '').toLowerCase();
  return type === 'video' || /\.(mp4|webm|mov)(\?|$)/.test(url);
}

export default function Community() {
  const { toast } = useToast();
  const [posts, setPosts] = useState([]);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newPost, setNewPost] = useState(emptyPost);
  const [submitting, setSubmitting] = useState(false);
  const [likedIds, setLikedIds] = useState(new Set());
  const [editingPostId, setEditingPostId] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const u = await base44.auth.me();
    setUser(u);
    const [allPosts, profiles] = await Promise.all([
      base44.entities.CommunityPost.list('-created_date', 30),
      base44.entities.UserProfile.filter({ user_id: u.id }),
    ]);
    setPosts(allPosts.filter(p => !p.is_reported && !p.deleted && p.status !== 'deleted'));
    setProfile(profiles[0] || null);
    setLoading(false);
  };

  const handlePost = async () => {
    if (!newPost.content.trim() && !newPost.media_url) return;
    setSubmitting(true);
    await base44.entities.CommunityPost.create({
      user_id: user.id,
      user_name: profile?.full_name || user.full_name || 'User',
      content: newPost.content,
      type: newPost.type,
      media_url: newPost.media_url,
      image_url: newPost.media_type === 'image' ? newPost.media_url : '',
      video_url: newPost.media_type === 'video' ? newPost.media_url : '',
      media_type: newPost.media_type,
      media_crop: newPost.media_crop || 'center center',
      media_width: newPost.media_width,
      media_height: newPost.media_height,
      media_duration: newPost.media_duration,
      media_quality: newPost.media_quality,
      likes_count: 0,
      comments_count: 0,
    });
    toast({ title: 'Post shared', description: 'Your photo/video post is live in the community.' });
    setNewPost(emptyPost);
    setShowCreate(false);
    setSubmitting(false);
    loadData();
  };

  const startEdit = (post) => {
    setEditingPostId(post.id);
    setEditingContent(post.content || '');
  };

  const cancelEdit = () => {
    setEditingPostId(null);
    setEditingContent('');
  };

  const saveEdit = async (post) => {
    if (!editingContent.trim()) return;
    setSavingEdit(true);
    try {
      await base44.entities.CommunityPost.update(post.id, {
        content: editingContent.trim(),
        edited_at: new Date().toISOString(),
      });
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, content: editingContent.trim(), edited_at: new Date().toISOString() } : p));
      toast({ title: 'Post updated' });
      cancelEdit();
    } catch (error) {
      toast({ title: 'Could not update post', description: error.message, variant: 'destructive' });
    } finally {
      setSavingEdit(false);
    }
  };

  const deletePost = async (post) => {
    setDeletingId(post.id);
    try {
      if (typeof base44.entities.CommunityPost.delete === 'function') {
        await base44.entities.CommunityPost.delete(post.id);
      } else {
        await base44.entities.CommunityPost.update(post.id, {
          deleted: true,
          status: 'deleted',
          is_reported: true,
          deleted_at: new Date().toISOString(),
        });
      }
      setPosts(prev => prev.filter(p => p.id !== post.id));
      toast({ title: 'Post deleted' });
    } catch {
      try {
        await base44.entities.CommunityPost.update(post.id, {
          deleted: true,
          status: 'deleted',
          is_reported: true,
          deleted_at: new Date().toISOString(),
        });
        setPosts(prev => prev.filter(p => p.id !== post.id));
        toast({ title: 'Post deleted' });
      } catch (error) {
        toast({ title: 'Could not delete post', description: error.message, variant: 'destructive' });
      }
    } finally {
      setDeletingId(null);
    }
  };

  const handleLike = async (post) => {
    if (likedIds.has(post.id)) return;
    setLikedIds(prev => new Set([...prev, post.id]));
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes_count: (p.likes_count || 0) + 1 } : p));
    await base44.entities.CommunityPost.update(post.id, { likes_count: (post.likes_count || 0) + 1 });
  };

  if (loading) return <LoadingScreen />;

  return (
    <>
      <TopBar title="Community" showBack />
      <div className="px-4 py-3 pb-6 space-y-3 max-w-lg mx-auto">

        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading font-bold text-base">SE7EN FIT Community</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{posts.length} posts from fitness warriors</p>
          </div>
          <Button onClick={() => setShowCreate(v => !v)} size="sm" className="rounded-xl bg-white text-black hover:bg-white/90 h-9 gap-1.5 px-3 text-xs font-bold">
            {showCreate ? <X size={14} /> : <Plus size={14} />}
            {showCreate ? 'Cancel' : 'Post'}
          </Button>
        </div>

        {showCreate && (
          <div className="bg-card border border-border rounded-2xl p-3.5 space-y-3">
            <h3 className="font-heading font-semibold text-sm">Share with the community</h3>
            <div className="flex gap-2 flex-wrap">
              {POST_TYPES.map(t => (
                <button
                  key={t.key}
                  onClick={() => setNewPost(p => ({ ...p, type: t.key }))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    newPost.type === t.key ? 'border-white bg-white text-black' : 'border-border bg-muted/50 text-muted-foreground'
                  }`}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
            <textarea
              value={newPost.content}
              onChange={e => setNewPost(p => ({ ...p, content: e.target.value }))}
              placeholder="What's on your fitness mind? Share a workout, meal, photo, or video! 💪"
              rows={3}
              className="w-full bg-background border border-border rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-white"
            />
            <MediaUploadCropper
              label="Photo / Video"
              helper="Upload 1080p image/video. Video max 2 minutes. Crop preview before posting."
              value={newPost}
              onChange={(media) => setNewPost(p => ({ ...p, ...media }))}
            />
            <Button onClick={handlePost} disabled={submitting || (!newPost.content.trim() && !newPost.media_url)} className="w-full h-10 rounded-xl bg-white text-black hover:bg-white/90 text-sm font-bold">
              {submitting ? 'Sharing...' : <><Send size={14} className="mr-2" /> Share Post</>}
            </Button>
          </div>
        )}

        {posts.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No posts yet"
            description="Be the first to share your fitness journey with the community!"
            actionLabel="Create First Post"
            onAction={() => setShowCreate(true)}
          />
        ) : (
          <div className="space-y-3">
            {posts.map(post => {
              const typeInfo = POST_TYPES.find(t => t.key === post.type) || POST_TYPES[0];
              const isLiked = likedIds.has(post.id);
              const timeAgo = getTimeAgo(post.created_date);
              const canManage = canManagePost(post, user, profile);
              const isEditing = editingPostId === post.id;
              const mediaUrl = post.media_url || post.image_url || post.video_url;
              const isVideo = isVideoPost(post);
              return (
                <div key={post.id} className="bg-card border border-border rounded-2xl p-3.5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold">{post.user_name?.[0]?.toUpperCase() || '?'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-heading font-semibold text-sm">{post.user_name || 'Anonymous'}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${typeInfo.color}`}>
                          {typeInfo.icon} {typeInfo.label}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{timeAgo}{post.edited_at ? ' • edited' : ''}{post.media_quality ? ` • ${post.media_quality}` : ''}</p>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => isEditing ? cancelEdit() : startEdit(post)} className="h-8 px-2 rounded-lg bg-muted text-muted-foreground hover:text-white text-[10px] font-semibold flex items-center gap-1">
                          <Edit2 size={12} /> {isEditing ? 'Cancel' : 'Edit'}
                        </button>
                        <button onClick={() => deletePost(post)} disabled={deletingId === post.id} className="h-8 px-2 rounded-lg bg-muted text-red-400 text-[10px] font-semibold flex items-center gap-1 disabled:opacity-50">
                          <Trash2 size={12} /> {deletingId === post.id ? 'Deleting' : 'Delete'}
                        </button>
                      </div>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="space-y-2 mb-3">
                      <textarea
                        value={editingContent}
                        onChange={e => setEditingContent(e.target.value)}
                        rows={3}
                        className="w-full bg-background border border-border rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-white"
                      />
                      <button onClick={() => saveEdit(post)} disabled={savingEdit || !editingContent.trim()} className="w-full h-9 rounded-xl bg-white text-black text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
                        <Check size={13} /> {savingEdit ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  ) : (
                    post.content && <p className="text-sm leading-relaxed mb-3 whitespace-pre-wrap">{post.content}</p>
                  )}

                  {mediaUrl && (
                    <div className="mb-3 rounded-xl overflow-hidden bg-black border border-border">
                      {isVideo ? (
                        <video src={mediaUrl} className="w-full max-h-[360px] object-cover" style={{ objectPosition: post.media_crop || 'center center' }} controls playsInline preload="metadata" />
                      ) : (
                        <img src={mediaUrl} alt="Post" className="w-full max-h-[360px] object-cover" style={{ objectPosition: post.media_crop || 'center center' }} loading="lazy" decoding="async" />
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-4 pt-2 border-t border-border/50">
                    <button
                      onClick={() => handleLike(post)}
                      className={`flex items-center gap-1.5 text-xs transition-all active:scale-90 ${isLiked ? 'text-red-400' : 'text-muted-foreground hover:text-red-400'}`}
                    >
                      <Heart size={15} fill={isLiked ? 'currentColor' : 'none'} />
                      <span>{post.likes_count || 0}</span>
                    </button>
                    <button className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MessageCircle size={15} />
                      <span>{post.comments_count || 0}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function getTimeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
