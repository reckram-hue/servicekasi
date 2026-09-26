import React, { useState } from 'react';
import { Camera, Image as ImageIcon, Trash2, Plus, Sparkles } from 'lucide-react';
import { WorkPhoto } from '../types';

interface PhotoUploaderProps {
  photos: WorkPhoto[];
  onAddPhoto: (photo: WorkPhoto) => void;
  onDeletePhoto: (photoId: string) => void;
  jobCategory?: string;
}

const SAMPLE_FIELD_PHOTOS: Record<string, { url: string; caption: string; type: WorkPhoto['type'] }[]> = {
  'Solar & Inverters': [
    {
      url: 'https://images.unsplash.com/photo-1509391365360-2e959784a276?w=600&auto=format&fit=crop&q=80',
      caption: 'Main DB Board with dual changeover switch installed',
      type: 'BEFORE',
    },
    {
      url: 'https://images.unsplash.com/photo-1508873696983-2df5703bc27d?w=600&auto=format&fit=crop&q=80',
      caption: '8kW Sunsynk Inverter & 10.2kWh Hubble Lithium Battery in garage',
      type: 'AFTER',
    },
  ],
  'Plumbing & Geysers': [
    {
      url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=600&auto=format&fit=crop&q=80',
      caption: 'Ruptured geyser cylinder in ceiling with corrosion',
      type: 'BEFORE',
    },
    {
      url: 'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?w=600&auto=format&fit=crop&q=80',
      caption: 'New Kwikot 150L installed with drip tray & copper pressure relief pipe',
      type: 'AFTER',
    },
  ],
  'HVAC & Refrigeration': [
    {
      url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80',
      caption: 'Cold room compressor motor & manifold gauge readout',
      type: 'AFTER',
    },
  ],
};

export const PhotoUploader: React.FC<PhotoUploaderProps> = ({
  photos,
  onAddPhoto,
  onDeletePhoto,
  jobCategory = 'Solar & Inverters',
}) => {
  const [photoType, setPhotoType] = useState<WorkPhoto['type']>('BEFORE');
  const [caption, setCaption] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [isAddingCustom, setIsAddingCustom] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setPreviewUrl(reader.result);
        setIsAddingCustom(true);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCommitPhoto = () => {
    if (!previewUrl) return;
    const newPhoto: WorkPhoto = {
      id: `photo-${Date.now()}`,
      url: previewUrl,
      caption: caption.trim() || `${photoType} job site evidence`,
      type: photoType,
      uploadedAt: new Date().toISOString(),
    };
    onAddPhoto(newPhoto);
    setPreviewUrl('');
    setCaption('');
    setIsAddingCustom(false);
  };

  const handleQuickAddSample = (sample: { url: string; caption: string; type: WorkPhoto['type'] }) => {
    const newPhoto: WorkPhoto = {
      id: `photo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      url: sample.url,
      caption: sample.caption,
      type: sample.type,
      uploadedAt: new Date().toISOString(),
    };
    onAddPhoto(newPhoto);
  };

  const relevantSamples = SAMPLE_FIELD_PHOTOS[jobCategory] || SAMPLE_FIELD_PHOTOS['Solar & Inverters'];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
          <Camera className="w-4 h-4 text-amber-600" />
          <span>Job Site Photos & Evidence</span>
        </div>
        <span className="text-xs text-slate-500 font-medium">
          {photos.length} photo{photos.length === 1 ? '' : 's'} recorded
        </span>
      </div>

      {/* Grid of uploaded photos */}
      {photos.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="group relative rounded-lg overflow-hidden border border-slate-200 bg-slate-100 aspect-4/3 flex flex-col"
            >
              <img
                src={photo.url}
                alt={photo.caption}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-200"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/25 flex flex-col justify-between p-2">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wider uppercase ${
                      photo.type === 'BEFORE'
                        ? 'bg-amber-500/90 text-white'
                        : photo.type === 'AFTER'
                        ? 'bg-emerald-600/90 text-white'
                        : 'bg-slate-800/90 text-white'
                    }`}
                  >
                    {photo.type}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDeletePhoto(photo.id)}
                    className="p-1 rounded-md bg-red-600/90 hover:bg-red-700 text-white transition-colors"
                    title="Delete photo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-[11px] text-white font-medium line-clamp-2 leading-tight">
                  {photo.caption}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
          <ImageIcon className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
          <p className="text-xs text-slate-600 font-medium">No site photos uploaded yet</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Capture before/after proof to attach with the South African compliance report
          </p>
        </div>
      )}

      {/* Interactive custom photo modal / drawer */}
      {isAddingCustom && previewUrl && (
        <div className="p-3 bg-slate-100 rounded-lg border border-slate-200 space-y-2.5">
          <div className="flex gap-3">
            <img
              src={previewUrl}
              alt="Preview"
              className="w-20 h-20 object-cover rounded-md border border-slate-300 shrink-0"
            />
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                {(['BEFORE', 'AFTER', 'PARTS'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setPhotoType(type)}
                    className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                      photoType === type
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Caption (e.g. Geyser pressure valve replacement)"
                className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setPreviewUrl('');
                setIsAddingCustom(false);
              }}
              className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCommitPhoto}
              className="px-3 py-1 bg-amber-600 text-white text-xs font-medium rounded hover:bg-amber-700"
            >
              Attach Photo
            </button>
          </div>
        </div>
      )}

      {/* Upload action triggers */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-xs">
          <Camera className="w-3.5 h-3.5 text-slate-500" />
          <span>Upload File / Camera</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>

        {/* Quick sample simulation buttons for easy testing on desktop */}
        <div className="inline-flex items-center gap-1 text-[11px] text-slate-500">
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span>Simulate Field Shot:</span>
          {relevantSamples.map((sample, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleQuickAddSample(sample)}
              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-medium text-[10px] transition-colors"
            >
              + {sample.type} ({sample.caption.split(' ')[0]})
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
