import React, { useState, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import { X, Loader2, Crop as CropIcon } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Produce a cropped Blob from the source image + crop pixel rect   */
/* ------------------------------------------------------------------ */
async function getCroppedBlob(imageSrc, cropPixels, outputWidth, outputHeight) {
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    image,
    Math.round(cropPixels.x),
    Math.round(cropPixels.y),
    Math.round(cropPixels.width),
    Math.round(cropPixels.height),
    0,
    0,
    outputWidth,
    outputHeight
  );

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob),
      'image/webp',
      0.85
    );
  });
}

export default function ImageCropper({
  isOpen,
  imageSrc,
  aspect = 1,
  outputWidth = 1000,
  title = 'Crop Image',
  sequenceLabel = null,
  remaining = 0,
  onCancel,
  onApply,
  onSkip,
  onSkipAll,
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedPixels, setCroppedPixels] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Reset when a new image is loaded
  useEffect(() => {
    if (isOpen && imageSrc) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedPixels(null);
      setProcessing(false);
    }
  }, [isOpen, imageSrc]);

  const handleCropComplete = useCallback((_area, pixels) => {
    setCroppedPixels(pixels);
  }, []);

  const handleApply = async () => {
    if (!croppedPixels) return;
    setProcessing(true);
    try {
      const outputHeight = Math.round(outputWidth / aspect);
      const blob = await getCroppedBlob(imageSrc, croppedPixels, outputWidth, outputHeight);
      if (!blob) throw new Error('Crop failed');
      await onApply(blob);
    } catch (err) {
      console.error('Crop error:', err);
      alert('Failed to crop image. Try again.');
      setProcessing(false);
    }
  };

  if (!isOpen || !imageSrc) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Header */}
      <div className="shrink-0 bg-[#18181B] text-white px-4 py-3 flex items-center justify-between border-b border-stone-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <CropIcon className="w-4 h-4 text-[#25D366] shrink-0" />
          <div className="min-w-0">
            <div className="font-black text-sm truncate">{title}</div>
            {sequenceLabel && (
              <div className="text-[10px] text-stone-400 font-mono truncate">{sequenceLabel}</div>
            )}
          </div>
        </div>
        <button
          onClick={onCancel}
          disabled={processing}
          className="p-2 -m-2 text-stone-400 hover:text-white transition disabled:opacity-50 cursor-pointer"
          aria-label="Cancel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Crop area */}
      <div className="flex-1 relative bg-black">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={handleCropComplete}
          objectFit="contain"
          showGrid={true}
          restrictPosition={true}
        />
      </div>

      {/* Controls */}
      <div className="shrink-0 bg-[#18181B] text-white px-4 pt-4 pb-5 space-y-4 border-t border-stone-800">
        {/* Zoom slider */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 shrink-0 w-12">
            Zoom
          </span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-[#25D366] cursor-pointer"
          />
          <span className="text-[10px] font-mono text-stone-400 shrink-0 w-10 text-right">
            {Math.round(zoom * 100)}%
          </span>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onSkip}
            disabled={processing}
            className="py-3 bg-stone-800 hover:bg-stone-700 text-white rounded-xl text-xs font-bold transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            Use Original
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={processing || !croppedPixels}
            className="py-3 bg-[#25D366] hover:bg-[#1EBE5D] text-white rounded-xl text-xs font-bold transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {processing ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
            ) : (
              'Apply Crop'
            )}
          </button>
        </div>

        {/* Skip-all link (only if more files remain) */}
        {remaining > 0 && typeof onSkipAll === 'function' && (
          <div className="text-center">
            <button
              type="button"
              onClick={onSkipAll}
              disabled={processing}
              className="text-[11px] font-semibold text-stone-400 hover:text-white underline underline-offset-2 transition disabled:opacity-50 cursor-pointer"
            >
              Skip crop for remaining {remaining} photo{remaining === 1 ? '' : 's'}
            </button>
          </div>
        )}

        <p className="text-[10px] text-stone-500 text-center">
          Drag to reposition • Pinch or use the slider to zoom
        </p>
      </div>
    </div>
  );
}