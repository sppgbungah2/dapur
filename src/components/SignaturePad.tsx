import React, { useRef, useState, useEffect } from 'react';
import { PenTool, Trash2, CheckCircle, Type, Loader2, CloudLightning, Database } from 'lucide-react';
import { uploadToCloudinary, isCloudinaryConfigured } from '../lib/cloudinary';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
  title: string;
  suggestedName: string;
}

export default function SignaturePad({ onSave, onCancel, title, suggestedName }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [useTyped, setUseTyped] = useState(false);
  const [typedName, setTypedName] = useState(suggestedName);
  const [selectedStyle, setSelectedStyle] = useState('font-signature-1');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const hasCloudinary = isCloudinaryConfigured();


  // Prevent scrolling when drawing on touch screens
  useEffect(() => {
    const preventDefault = (e: TouchEvent) => {
      if (e.target === canvasRef.current) {
        e.preventDefault();
      }
    };
    document.body.addEventListener('touchmove', preventDefault, { passive: false });
    return () => {
      document.body.removeEventListener('touchmove', preventDefault);
    };
  }, []);

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    
    if ('touches' in e || 'changedTouches' in e) {
      const touchEvt = e as unknown as TouchEvent;
      const touch = (touchEvt.touches && touchEvt.touches.length > 0) 
        ? touchEvt.touches[0] 
        : (touchEvt.changedTouches && touchEvt.changedTouches.length > 0) 
        ? touchEvt.changedTouches[0] 
        : null;

      if (!touch) return { x: 0, y: 0 };
      return {
        x: (touch.clientX - rect.left) * (canvas.width / rect.width),
        y: (touch.clientY - rect.top) * (canvas.height / rect.height)
      };
    } else {
      const mouseEvt = e as React.MouseEvent<HTMLCanvasElement>;
      return {
        x: (mouseEvt.clientX - rect.left) * (canvas.width / rect.width),
        y: (mouseEvt.clientY - rect.top) * (canvas.height / rect.height)
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    
    // Configure stroke settings
    ctx.strokeStyle = '#0f172a'; // slate-900
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoordinates(e);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const compressCanvasToDataURL = (srcCanvas: HTMLCanvasElement): string => {
    try {
      const targetWidth = 320;
      const targetHeight = 150;
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = targetWidth;
      tempCanvas.height = targetHeight;
      const ctx = tempCanvas.getContext('2d');
      if (!ctx) return srcCanvas.toDataURL('image/png');

      ctx.clearRect(0, 0, targetWidth, targetHeight);
      ctx.drawImage(srcCanvas, 0, 0, srcCanvas.width, srcCanvas.height, 0, 0, targetWidth, targetHeight);
      return tempCanvas.toDataURL('image/png');
    } catch (e) {
      console.warn('Canvas compression fallback to standard dataURL:', e);
      return srcCanvas.toDataURL('image/png');
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSave = async () => {
    let base64Url = '';
    
    if (useTyped) {
      // Create signature from text using canvas
      const canvas = document.createElement('canvas');
      canvas.width = 450;
      canvas.height = 150;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Clear background with transparency
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw typed name in a recursive style font
        ctx.fillStyle = '#0f172a'; // Deep Navy
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        if (selectedStyle === 'font-signature-1') {
          ctx.font = 'italic 500 38px "Playfair Display", Georgia, serif';
        } else if (selectedStyle === 'font-signature-2') {
          ctx.font = 'italic 600 42px "Times New Roman", serif';
        } else {
          ctx.font = 'normal 400 36px "Brush Script MT", cursive, sans-serif';
        }
        
        ctx.fillText(typedName, canvas.width / 2, canvas.height / 2);
        
        // Add decorative line underneath
        ctx.beginPath();
        ctx.moveTo(70, 110);
        ctx.bezierCurveTo(150, 100, 300, 120, 380, 105);
        ctx.strokeStyle = '#22c55e'; // green-500 line
        ctx.lineWidth = 2;
        ctx.stroke();
        
        base64Url = compressCanvasToDataURL(canvas);
      }
    } else {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      // Check if canvas is empty
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const buffer = new Uint32Array(ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
        const isEmpty = !buffer.some(color => color !== 0);
        if (isEmpty) {
          alert('Tanda tangan masih kosong. Silakan gambar atau pilih opsi "Ketik Nama"');
          return;
        }
      }
      
      base64Url = compressCanvasToDataURL(canvas);
    }

    if (!base64Url) return;

    try {
      setIsUploading(true);
      setUploadError(null);
      
      // Upload signature to Cloudinary (will return base64 back as fallback if not configured)
      const finalUrl = await uploadToCloudinary(base64Url, 'image');
      onSave(finalUrl);
    } catch (err: any) {
      console.error('Failed to upload signature:', err);
      setUploadError(err.message || 'Gagal mengunggah tanda tangan ke Cloudinary');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999]">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-neutral-100 overflow-hidden relative" id="signature-pad-modal">
        {/* Upload Loading Overlay */}
        {isUploading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center z-[10000] animate-fade-in">
            <Loader2 className="h-10 w-10 text-emerald-700 animate-spin" />
            <p className="mt-3 text-sm font-bold text-neutral-800">Mengunggah ke Cloudinary...</p>
            <p className="text-xs text-neutral-400">Menyimpan tanda tangan online beresolusi tinggi</p>
          </div>
        )}

        {/* Header */}
        <div className="bg-emerald-800 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PenTool className="h-5 w-5 text-emerald-300" />
            <div>
              <h3 className="font-semibold text-lg">{title}</h3>
              <p className="text-xs text-emerald-100">Bubuhkan tanda tangan persetujuan SOP secara digital</p>
            </div>
          </div>
          
          {/* Cloudinary connection status badge */}
          <div className="shrink-0">
            {hasCloudinary ? (
              <span className="inline-flex items-center gap-1 text-[9px] bg-emerald-900/50 text-emerald-200 border border-emerald-500/30 px-2 py-1 rounded-full font-bold">
                <CloudLightning className="h-3 w-3 text-emerald-300 animate-pulse" />
                CLOUDINARY ACTIVE
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[9px] bg-neutral-900/30 text-neutral-300 border border-neutral-500/30 px-2 py-1 rounded-full font-bold">
                <Database className="h-3 w-3 text-neutral-400" />
                LOCAL SANDBOX
              </span>
            )}
          </div>
        </div>

        {/* Action Toggle Tab */}
        <div className="flex border-b border-neutral-100 bg-neutral-50 p-2">
          <button
            type="button"
            disabled={isUploading}
            className={`flex-1 py-2 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-all ${
              !useTyped
                ? 'bg-white text-emerald-800 shadow-xs border border-neutral-200/50'
                : 'text-neutral-500 hover:text-neutral-800'
            } disabled:opacity-50`}
            onClick={() => setUseTyped(false)}
          >
            <PenTool className="h-4 w-4" />
            Gambar Manual
          </button>
          <button
            type="button"
            disabled={isUploading}
            className={`flex-1 py-2 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-all ${
              useTyped
                ? 'bg-white text-emerald-800 shadow-xs border border-neutral-200/50'
                : 'text-neutral-500 hover:text-neutral-800'
            } disabled:opacity-50`}
            onClick={() => setUseTyped(true)}
          >
            <Type className="h-4 w-4" />
            Ketik Nama
          </button>
        </div>

        {/* Upload Error Banner */}
        {uploadError && (
          <div className="bg-red-50 border-b border-red-100 text-red-700 text-xs px-5 py-2.5 font-medium flex items-center justify-between gap-2">
            <span>⚠ Error: {uploadError}</span>
            <button
              type="button"
              onClick={handleSave}
              className="bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded-md font-bold text-[10px] uppercase transition-all shrink-0 cursor-pointer"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {/* Draw Body */}
        <div className="p-6">
          {!useTyped ? (
            <div>
              <div className="relative border border-dashed border-neutral-300 rounded-xl bg-neutral-50 aspect-video overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={450}
                  height={220}
                  className="w-full h-full cursor-crosshair touch-none"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
                <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-neutral-400 font-mono tracking-wider pointer-events-none">
                  AREA TANDA TANGAN (SENTUH / SERET MOUSE)
                </span>
                
                <button
                  type="button"
                  onClick={clearCanvas}
                  disabled={isUploading}
                  className="absolute top-2 right-2 bg-white/90 hover:bg-red-50 hover:text-red-600 transition-colors h-8 px-2.5 rounded-lg border border-neutral-200 text-xs font-semibold flex items-center gap-1.5 text-neutral-600 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Hapus Coretan
                </button>
              </div>
              <p className="text-[11px] text-neutral-500 mt-2 text-center">
                *Tanda tangan ini akan diunggah ke cloud storage aman dan disematkan langsung ke lembar rekapitulasi.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1.5 uppercase tracking-wide">
                  Nama yang Tercantum:
                </label>
                <input
                  type="text"
                  value={typedName}
                  disabled={isUploading}
                  onChange={(e) => setTypedName(e.target.value)}
                  className="w-full text-base font-medium text-neutral-800 border border-neutral-200 rounded-lg px-3.5 py-2 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-hidden transition-all bg-neutral-50/50 disabled:opacity-55"
                  placeholder="Ketik Nama Anda..."
                  maxLength={40}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-2 uppercase tracking-wide">
                  Pilih Gaya Tanda Tangan:
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => setSelectedStyle('font-signature-1')}
                    className={`p-3 border rounded-xl flex items-center justify-center text-lg aspect-square text-neutral-800 transition-all ${
                      selectedStyle === 'font-signature-1'
                        ? 'border-emerald-600 bg-emerald-50/30 ring-2 ring-emerald-500/10 font-serif'
                        : 'border-neutral-200 hover:bg-neutral-50 font-serif'
                    } disabled:opacity-50`}
                  >
                    <div className="text-center">
                      <span className="italic block font-bold text-slate-800">Classic</span>
                      <span className="text-[10px] text-neutral-400">Playfair</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => setSelectedStyle('font-signature-2')}
                    className={`p-3 border rounded-xl flex items-center justify-center text-lg aspect-square text-neutral-800 transition-all ${
                      selectedStyle === 'font-signature-2'
                        ? 'border-emerald-600 bg-emerald-50/30 ring-2 ring-emerald-500/10 font-serif'
                        : 'border-neutral-200 hover:bg-neutral-50 font-serif'
                    } disabled:opacity-50`}
                  >
                    <div className="text-center">
                      <span className="italic block font-bold text-slate-800">Formal</span>
                      <span className="text-[10px] text-neutral-400">Garamond</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => setSelectedStyle('font-signature-3')}
                    className={`p-3 border rounded-xl flex items-center justify-center text-lg aspect-square text-neutral-800 transition-all ${
                      selectedStyle === 'font-signature-3'
                        ? 'border-emerald-600 bg-emerald-50/30 ring-2 ring-emerald-500/10'
                        : 'border-neutral-200 hover:bg-neutral-50'
                    } disabled:opacity-50`}
                    style={{ fontFamily: 'Brush Script MT, cursive, sans-serif' }}
                  >
                    <div className="text-center">
                      <span className="italic block font-bold text-emerald-800 text-xl">Casual</span>
                      <span className="text-[10px] text-neutral-400">Script</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Live Preview Card */}
              <div className="border border-neutral-100 rounded-xl bg-neutral-50 p-4 min-h-[90px] flex items-center justify-center relative overflow-hidden">
                <span className="absolute top-1 left-2 text-[8px] text-neutral-400 uppercase tracking-widest font-mono">
                  Pratinjau Hasil Tanda Tangan
                </span>
                <div className="text-center">
                  <p 
                    className="text-3xl text-neutral-800 font-semibold"
                    style={{ 
                      fontFamily: selectedStyle === 'font-signature-1' 
                        ? '"Playfair Display", Georgia, serif'
                        : selectedStyle === 'font-signature-2'
                        ? '"Times New Roman", serif'
                        : '"Brush Script MT", cursive, sans-serif'
                    }}
                  >
                    {typedName || 'Ketik Nama'}
                  </p>
                  <div className="h-0.5 bg-emerald-500 w-32 mx-auto mt-2 opacity-50 relative">
                    <span className="absolute -top-1 right-2 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-neutral-100 p-4 bg-neutral-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isUploading}
            className="flex-1 border border-neutral-300 hover:bg-neutral-100 focus:ring-2 focus:ring-neutral-200 text-neutral-700 py-2.5 rounded-xl text-sm font-semibold transition-colors uppercase tracking-wide disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isUploading}
            className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white focus:ring-4 focus:ring-emerald-500/20 active:scale-98 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5 uppercase tracking-wide disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                MENGUNGGAH...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                Terapkan &amp; Simpan
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
