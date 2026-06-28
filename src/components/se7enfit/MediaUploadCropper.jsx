import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Image as ImageIcon, Video, Upload, Crop, X } from 'lucide-react';

const CROP_POSITIONS = [
  { label: 'Center', value: 'center center' },
  { label: 'Top', value: 'center top' },
  { label: 'Bottom', value: 'center bottom' },
  { label: 'Left', value: 'left center' },
  { label: 'Right', value: 'right center' },
];

const getImageMeta = (url) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight, duration: 0 });
  img.onerror = () => reject(new Error('Image could not be read. Try another file.'));
  img.src = url;
});

const getVideoMeta = (url) => new Promise((resolve, reject) => {
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.onloadedmetadata = () => resolve({ width: video.videoWidth, height: video.videoHeight, duration: video.duration || 0 });
  video.onerror = () => reject(new Error('Video could not be read. Try another file.'));
  video.src = url;
});

export default function MediaUploadCropper({
  value,
  onChange,
  label = 'Upload Media',
  helper = 'Use 1080p or higher for best quality. Videos must be 2 minutes or less.',
  minLongSide = 1080,
  maxVideoSeconds = 120,
  aspectClass = 'aspect-video',
}) {
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const media = value || {};
  const hasMedia = !!media.media_url;
  const isVideo = media.media_type === 'video';
  const qualityText = useMemo(() => {
    if (!media.media_width && !media.media_height) return '';
    const size = `${media.media_width || 0}×${media.media_height || 0}`;
    const duration = media.media_duration ? ` • ${Math.round(media.media_duration)}s` : '';
    return `${size}${duration}`;
  }, [media]);

  const handleFile = async (file) => {
    if (!file) return;
    setError('');
    setUploading(true);

    try {
      const type = file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : '';
      if (!type) throw new Error('Only image and video files are supported.');

      const previewUrl = URL.createObjectURL(file);
      const meta = type === 'video' ? await getVideoMeta(previewUrl) : await getImageMeta(previewUrl);
      const longSide = Math.max(meta.width || 0, meta.height || 0);

      if (longSide < minLongSide) {
        throw new Error(`Upload higher quality media. Minimum recommended size is 1080p. This file is ${meta.width}×${meta.height}.`);
      }

      if (type === 'video' && meta.duration > maxVideoSeconds) {
        throw new Error(`Video is too long. Maximum allowed duration is ${Math.floor(maxVideoSeconds / 60)} minutes.`);
      }

      const uploaded = await base44.integrations.Core.UploadFile({ file }).catch(() => null);
      const uploadedUrl = uploaded?.url || previewUrl;

      onChange({
        media_url: uploadedUrl,
        image_url: type === 'image' ? uploadedUrl : '',
        video_url: type === 'video' ? uploadedUrl : '',
        media_type: type,
        media_width: meta.width,
        media_height: meta.height,
        media_duration: Math.round(meta.duration || 0),
        media_crop: media.media_crop || 'center center',
        media_quality: longSide >= 1920 ? '1080p+' : '1080p',
      });
    } catch (err) {
      setError(err?.message || 'Media upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const updateCrop = (position) => {
    onChange({ ...media, media_crop: position });
  };

  const clearMedia = () => {
    setError('');
    onChange({ media_url: '', image_url: '', video_url: '', media_type: 'image', media_width: 0, media_height: 0, media_duration: 0, media_crop: 'center center', media_quality: '' });
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold">{label}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{helper}</p>
        </div>
        {hasMedia && (
          <button type="button" onClick={clearMedia} className="h-8 px-2 rounded-lg bg-muted text-[10px] text-muted-foreground flex items-center gap-1">
            <X size={11} /> Remove
          </button>
        )}
      </div>

      <label className="block cursor-pointer rounded-2xl border border-dashed border-border bg-background hover:border-accent/40 transition-all overflow-hidden">
        {hasMedia ? (
          <div className={`relative ${aspectClass} bg-black`}>
            {isVideo ? (
              <video src={media.media_url} className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: media.media_crop || 'center center' }} muted controls playsInline />
            ) : (
              <img src={media.media_url} alt="Uploaded media preview" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: media.media_crop || 'center center' }} />
            )}
            <div className="absolute top-2 left-2 rounded-full bg-black/55 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">
              {isVideo ? 'VIDEO' : 'IMAGE'} {qualityText ? `• ${qualityText}` : ''}
            </div>
          </div>
        ) : (
          <div className={`${aspectClass} flex flex-col items-center justify-center gap-2 text-center px-4`}>
            <Upload size={24} className="text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold">{uploading ? 'Checking quality...' : 'Choose 1080p image/video'}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Images + videos supported</p>
            </div>
          </div>
        )}
        <input
          type="file"
          accept="image/*,video/*"
          className="hidden"
          disabled={uploading}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </label>

      {hasMedia && (
        <div className="rounded-2xl bg-muted/40 border border-border p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-2">
            <Crop size={11} /> Crop position for banner/card preview
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {CROP_POSITIONS.map(pos => (
              <button
                type="button"
                key={pos.value}
                onClick={() => updateCrop(pos.value)}
                className={`h-8 rounded-lg text-[10px] font-semibold border transition-all ${media.media_crop === pos.value ? 'bg-white text-black border-white' : 'bg-card border-border text-muted-foreground'}`}
              >
                {pos.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-[11px] text-red-400 leading-relaxed">{error}</p>}
    </div>
  );
}
