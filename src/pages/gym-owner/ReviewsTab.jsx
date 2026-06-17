import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Star, Send, Trash2, Filter } from 'lucide-react';
import ConfirmModal from '@/components/gym-owner/ConfirmModal';

export default function ReviewsTab({ reviews, setReviews, showToast }) {
  const [replyTexts, setReplyTexts] = useState({});
  const [filterRating, setFilterRating] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1)
    : 0;

  const sendReply = async (reviewId) => {
    const reply = replyTexts[reviewId];
    if (!reply?.trim()) return;
    await base44.entities.GymReview.update(reviewId, { owner_reply: reply });
    setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, owner_reply: reply } : r));
    setReplyTexts(prev => ({ ...prev, [reviewId]: '' }));
    showToast('Reply sent!', 'success');
  };

  const deleteReply = async (reviewId) => {
    await base44.entities.GymReview.update(reviewId, { owner_reply: null });
    setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, owner_reply: null } : r));
    setDeleteConfirm(null);
    showToast('Reply deleted', 'success');
  };

  const filtered = filterRating > 0 ? reviews.filter(r => Math.round(r.rating) === filterRating) : reviews;

  return (
    <div className="space-y-3">
      <p className="font-heading font-bold text-lg">Reviews</p>

      {/* Rating Summary */}
      <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-5">
        <div className="text-center">
          <p className="font-black text-5xl text-accent leading-none">{reviews.length > 0 ? avgRating : '—'}</p>
          <div className="flex gap-0.5 justify-center mt-2">
            {[1,2,3,4,5].map(s => (
              <Star key={s} size={13} className={parseFloat(avgRating) >= s ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground'} />
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">{reviews.length} reviews</p>
        </div>
        <div className="flex-1 space-y-1.5">
          {[5,4,3,2,1].map(star => {
            const count = reviews.filter(r => Math.round(r.rating) === star).length;
            const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
            return (
              <button key={star} onClick={() => setFilterRating(filterRating === star ? 0 : star)}
                className={`w-full flex items-center gap-2 rounded-lg px-1 transition-all ${filterRating === star ? 'bg-accent/10' : ''}`}>
                <span className="text-[10px] text-muted-foreground w-3">{star}</span>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[10px] text-muted-foreground w-4 text-right">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter pills */}
      {filterRating > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Filtered by:</span>
          <button onClick={() => setFilterRating(0)} className="flex items-center gap-1 bg-accent/10 text-accent text-xs px-2.5 py-1 rounded-full font-semibold">
            {filterRating} stars <span className="text-[10px]">✕</span>
          </button>
        </div>
      )}

      {reviews.length === 0 ? (
        <div className="bg-muted/30 border border-border rounded-2xl p-10 text-center">
          <Star size={32} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-semibold">No reviews yet</p>
          <p className="text-xs text-muted-foreground mt-1">Member reviews will appear here once members rate your gym</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm">No reviews with {filterRating} stars</div>
      ) : (
        filtered.map(review => (
          <div key={review.id} className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-semibold text-sm">{review.user_name || 'Anonymous Member'}</p>
                <div className="flex gap-0.5 mt-0.5">
                  {[1,2,3,4,5].map(s => <Star key={s} size={11} className={review.rating >= s ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground'} />)}
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground">
                {review.created_date ? new Date(review.created_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
              </span>
            </div>
            {review.review_text && <p className="text-sm text-muted-foreground leading-relaxed mb-3">"{review.review_text}"</p>}
            {review.owner_reply ? (
              <div className="bg-accent/5 border border-accent/20 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] text-accent font-semibold mb-1">Your Reply</p>
                    <p className="text-xs text-muted-foreground">{review.owner_reply}</p>
                  </div>
                  <button onClick={() => setDeleteConfirm(review.id)} className="w-6 h-6 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                    <Trash2 size={10} className="text-red-400" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={replyTexts[review.id] || ''}
                  onChange={(e) => setReplyTexts(prev => ({ ...prev, [review.id]: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && sendReply(review.id)}
                  placeholder="Reply to this review..."
                  className="flex-1 h-9 px-3 rounded-xl border border-input bg-muted/40 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button onClick={() => sendReply(review.id)} className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
                  <Send size={13} className="text-accent-foreground" />
                </button>
              </div>
            )}
          </div>
        ))
      )}

      <ConfirmModal
        open={!!deleteConfirm}
        title="Delete Reply"
        message="Are you sure you want to delete your reply?"
        confirmLabel="Delete"
        onConfirm={() => deleteReply(deleteConfirm)}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}