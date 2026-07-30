import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Camera, Loader2, Check, RotateCcw, ScanLine, ImageIcon, Plus, Trash2, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { processAndUploadDocument } from '@/lib/document-processor';
import { captureFromCamera, imagesToPdfFile, type CapturedPage } from '@/lib/pdf-builder';

const SCAN_PROCESSING_STAGES: Record<string, number> = {
  'Building PDF from scanned pages...': 5,
  'Uploading scanned document...': 10,
  'Uploading file...': 15,
  'Creating document record...': 25,
  'Extracting text (OCR)...': 40,
  'Saving extracted text...': 50,
  'AI analyzing document...': 65,
  'Saving AI analysis...': 80,
  'Generating tags...': 90,
  'Done!': 100,
};

interface ScanModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: (documentId: string) => void;
}

export function ScanModal({ open, onClose, onComplete }: ScanModalProps) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [pages, setPages] = useState<CapturedPage[]>([]);
  const [stage, setStage] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [resultDocId, setResultDocId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to access camera';
      if (message.includes('Permission') || message.includes('NotAllowed')) {
        setCameraError('Camera access was denied. Please allow camera permissions and try again.');
      } else if (message.includes('NotFound') || message.includes('Devices')) {
        setCameraError('No camera found on this device. You can upload an image file instead.');
      } else {
        setCameraError(`Camera error: ${message}`);
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopCamera();
      setPages([]);
      setProcessing(false);
      setDone(false);
      setError(null);
      setResultDocId(null);
      setStage('');
      setProgress(0);
    }
    return () => stopCamera();
  }, [open]);

  const handleCapture = async () => {
    if (!videoRef.current) return;
    const page = await captureFromCamera(videoRef.current);
    if (page) {
      setPages((prev) => [...prev, page]);
    }
  };

  const handleRemovePage = (index: number) => {
    setPages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRetake = () => {
    setPages([]);
  };

  const handleProcess = async () => {
    if (pages.length === 0 || !user) return;
    setProcessing(true);
    setError(null);
    setStage('Building PDF from scanned pages...');
    setProgress(SCAN_PROCESSING_STAGES['Building PDF from scanned pages...']);

    try {
      const filename = `Scan_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.pdf`;
      const pdfFile = await imagesToPdfFile(pages, filename);

      setStage('Uploading scanned document...');
      setProgress(SCAN_PROCESSING_STAGES['Uploading scanned document...']);

      let simPct = SCAN_PROCESSING_STAGES['Uploading scanned document...'];
      const simTimer = setInterval(() => {
        simPct = Math.min(95, simPct + Math.random() * 3);
        setProgress(simPct);
      }, 400);

      const result = await processAndUploadDocument(pdfFile, user.uid, (s) => {
        setStage(s);
        const pct = SCAN_PROCESSING_STAGES[s];
        if (pct !== undefined) {
          simPct = Math.max(simPct, pct);
          setProgress(simPct);
        }
      });

      clearInterval(simTimer);
      setProgress(100);

      if (result.error) {
        setError(result.error);
      } else {
        setResultDocId(result.documentId);
        setDone(true);
        stopCamera();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process scanned document');
    }
    setProcessing(false);
  };

  const handleClose = () => {
    stopCamera();
    if (done && resultDocId) {
      onComplete(resultDocId);
    }
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm animate-fade-in" onClick={processing ? undefined : handleClose} />

      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl animate-scale-in max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <ScanLine className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-display text-slate-900">Scan Document</h2>
              <p className="text-sm text-slate-500">Capture pages with your camera — they'll be saved as a PDF and analyzed by AI</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={processing}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all-smooth disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto scrollbar-thin">
          {/* Done state */}
          {done ? (
            <div className="text-center py-12 animate-fade-in-up">
              <div className="w-20 h-20 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                <Check className="w-10 h-10 text-emerald-500" />
              </div>
              <h3 className="text-xl font-bold font-display text-slate-900 mb-2">Scan Complete!</h3>
              <p className="text-slate-500 mb-6">Your document has been scanned and AI analysis is complete.</p>
              <button
                onClick={handleClose}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold hover:scale-[1.02] transition-all-smooth inline-flex items-center gap-2"
              >
                View Document <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          ) : processing ? (
            <div className="text-center py-16 animate-fade-in">
              <div className="relative w-12 h-12 mx-auto mb-4">
                <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-blue-700">{Math.round(progress)}%</span>
                </div>
              </div>
              <p className="font-medium text-slate-900">{stage}</p>
              <div className="w-full max-w-xs mx-auto mt-4">
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full"
                    style={{ width: `${progress}%`, transition: 'width 0.4s ease-out' }}
                  />
                </div>
              </div>
              <p className="text-sm text-slate-400 mt-2">Please wait while AI processes your scan...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12 animate-fade-in">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-50 flex items-center justify-center mb-4">
                <X className="w-8 h-8 text-rose-500" />
              </div>
              <p className="font-medium text-rose-600 mb-2">Processing failed</p>
              <p className="text-sm text-slate-500 mb-6">{error}</p>
              <button
                onClick={() => { setError(null); startCamera(); }}
                className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition-all-smooth"
              >
                Try Again
              </button>
            </div>
          ) : (
            <>
              {/* Camera view */}
              <div className="relative rounded-2xl overflow-hidden bg-slate-900 mb-4 aspect-video flex items-center justify-center">
                {cameraError ? (
                  <div className="text-center p-8">
                    <Camera className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                    <p className="text-slate-300 font-medium mb-2">Camera unavailable</p>
                    <p className="text-sm text-slate-400 max-w-sm mx-auto mb-4">{cameraError}</p>
                    <button
                      onClick={startCamera}
                      className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-all-smooth"
                    >
                      Retry Camera
                    </button>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-contain"
                    />
                    {cameraActive && (
                      <>
                        <div className="absolute inset-0 pointer-events-none border-2 border-white/30 rounded-2xl" />
                        <div className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm">
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                          <span className="text-xs font-medium text-white">Camera Live</span>
                        </div>
                      </>
                    )}
                    {!cameraActive && !cameraError && (
                      <div className="text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-white/60 mx-auto mb-2" />
                        <p className="text-sm text-white/60">Starting camera...</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Capture button */}
              {cameraActive && (
                <div className="flex items-center justify-center mb-6">
                  <button
                    onClick={handleCapture}
                    className="group flex flex-col items-center gap-2"
                  >
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-110 group-active:scale-95 transition-all-smooth ring-4 ring-white">
                      <Camera className="w-7 h-7 text-white" />
                    </div>
                    <span className="text-sm font-medium text-slate-600">Capture Page</span>
                  </button>
                </div>
              )}

              {/* Captured pages */}
              {pages.length > 0 && (
                <div className="animate-fade-in-up">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-slate-400" />
                      {pages.length} page{pages.length !== 1 ? 's' : ''} captured
                    </h3>
                    <button
                      onClick={handleRetake}
                      className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-rose-600 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Clear all
                    </button>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-6">
                    {pages.map((page, i) => (
                      <div key={i} className="relative group rounded-xl overflow-hidden border-2 border-slate-200 aspect-[3/4]">
                        <img src={page.dataUrl} alt={`Page ${i + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                          {i + 1}
                        </div>
                        <button
                          onClick={() => handleRemovePage(i)}
                          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all-smooth"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {cameraActive && (
                      <button
                        onClick={handleCapture}
                        className="rounded-xl border-2 border-dashed border-slate-300 aspect-[3/4] flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-all-smooth"
                      >
                        <Plus className="w-6 h-6" />
                        <span className="text-xs font-medium">Add page</span>
                      </button>
                    )}
                  </div>

                  <button
                    onClick={handleProcess}
                    disabled={processing}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all-smooth flex items-center justify-center gap-2"
                  >
                    <ScanLine className="w-5 h-5" />
                    Scan & Analyze {pages.length} Page{pages.length !== 1 ? 's' : ''}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
