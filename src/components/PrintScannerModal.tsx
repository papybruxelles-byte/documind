import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Printer, Loader2, Check, ScanLine, ArrowRight, Usb, RefreshCw, FileText } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { processAndUploadDocument } from '@/lib/document-processor';
import {
  isWebSerialSupported,
  requestScannerPort,
  openScannerPort,
  closeScannerPort,
  scanDocument,
  scannedDocumentToPdfFile,
  getVendorName,
  productIdToModel,
  type ScannerConnection,
} from '@/lib/scanner';

interface PrintScannerModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: (documentId: string) => void;
}

type Phase = 'idle' | 'connecting' | 'scanning' | 'processing' | 'done' | 'error';

const PROCESSING_STAGES: Record<string, number> = {
  'Building PDF from scan...': 5,
  'Uploading & analyzing with AI...': 10,
  'Uploading file...': 15,
  'Creating document record...': 25,
  'Extracting text (OCR)...': 40,
  'Saving extracted text...': 50,
  'AI analyzing document...': 65,
  'Saving AI analysis...': 80,
  'Generating tags...': 90,
  'Done!': 100,
};

export function PrintScannerModal({ open, onClose, onComplete }: PrintScannerModalProps) {
  const { user } = useAuth();
  const connectionRef = useRef<ScannerConnection | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [stage, setStage] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [resultDocId, setResultDocId] = useState<string | null>(null);

  const supported = isWebSerialSupported();

  const reset = useCallback(() => {
    setPhase('idle');
    setStage('');
    setProgress(0);
    setError(null);
    setDeviceName(null);
    setResultDocId(null);
  }, []);

  useEffect(() => {
    if (!open) {
      if (connectionRef.current) {
        closeScannerPort(connectionRef.current).catch(() => {});
        connectionRef.current = null;
      }
      reset();
    }
  }, [open, reset]);

  const handleConnect = useCallback(async () => {
    setPhase('connecting');
    setStage('Requesting scanner access...');
    setError(null);

    const conn = await requestScannerPort();
    if (!conn) {
      setError('No scanner selected or request cancelled. Make sure your printer/scanner is connected via USB and powered on.');
      setPhase('error');
      return;
    }

    connectionRef.current = conn;
    const vendor = getVendorName(conn.info.usbVendorId);
    const model = productIdToModel(conn.info.usbProductId);
    setDeviceName(`${vendor} ${model}`);
    setStage(`Opening connection to ${vendor} ${model}...`);

    try {
      await openScannerPort(conn);
      setPhase('idle');
      setStage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open scanner connection. The port may be in use by another application.');
      setPhase('error');
    }
  }, []);

  const handleScan = useCallback(async () => {
    if (!connectionRef.current || !user) return;

    setPhase('scanning');
    setProgress(0);

    try {
      const scanned = await scanDocument(connectionRef.current, (s, pct) => {
        setStage(s);
        setProgress(pct);
      });

      setPhase('processing');
      setStage('Building PDF from scan...');
      setProgress(PROCESSING_STAGES['Building PDF from scan...']);

      const filename = `Scan_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.pdf`;
      const pdfFile = await scannedDocumentToPdfFile(scanned, filename);

      setStage('Uploading & analyzing with AI...');
      setProgress(PROCESSING_STAGES['Uploading & analyzing with AI...']);

      // Simulated progress keeps the bar moving during long AI calls that
      // don't emit intermediate stage callbacks.
      let simPct = PROCESSING_STAGES['Uploading & analyzing with AI...'];
      const simTimer = setInterval(() => {
        simPct = Math.min(95, simPct + Math.random() * 3);
        setProgress(simPct);
      }, 400);

      const result = await processAndUploadDocument(pdfFile, user.uid, (s) => {
        setStage(s);
        const pct = PROCESSING_STAGES[s];
        if (pct !== undefined) {
          simPct = Math.max(simPct, pct);
          setProgress(simPct);
        }
      });

      clearInterval(simTimer);
      setProgress(100);

      if (result.error) {
        setError(result.error);
        setPhase('error');
      } else {
        setResultDocId(result.documentId);
        setPhase('done');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during scanning.');
      setPhase('error');
    }
  }, [user]);

  const handleClose = useCallback(() => {
    if (connectionRef.current) {
      closeScannerPort(connectionRef.current).catch(() => {});
      connectionRef.current = null;
    }
    if (phase === 'done' && resultDocId) {
      onComplete(resultDocId);
    }
    onClose();
  }, [phase, resultDocId, onComplete, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm animate-fade-in" onClick={phase === 'scanning' || phase === 'processing' ? undefined : handleClose} />

      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl animate-scale-in max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shadow-lg shadow-slate-500/20">
              <Printer className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-display text-slate-900">Print Scanner</h2>
              <p className="text-sm text-slate-500">Scan directly from your USB printer/scanner</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={phase === 'scanning' || phase === 'processing'}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all-smooth disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto scrollbar-thin">
          {!supported ? (
            <div className="text-center py-10">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
                <Usb className="w-8 h-8 text-amber-500" />
              </div>
              <h3 className="font-bold font-display text-slate-900 mb-2">Browser not supported</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                Direct printer scanning uses the Web Serial API, which is currently supported in Chrome, Edge, and Opera on desktop. Please try one of those browsers.
              </p>
            </div>
          ) : phase === 'done' ? (
            <div className="text-center py-10 animate-fade-in-up">
              <div className="w-20 h-20 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                <Check className="w-10 h-10 text-emerald-500" />
              </div>
              <h3 className="text-xl font-bold font-display text-slate-900 mb-2">Scan Complete!</h3>
              <p className="text-slate-500 mb-6">
                Your document was scanned from {deviceName} and analyzed by AI.
              </p>
              <button
                onClick={handleClose}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-slate-700 to-slate-900 text-white font-semibold hover:scale-[1.02] transition-all-smooth inline-flex items-center gap-2"
              >
                View Document <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          ) : phase === 'error' ? (
            <div className="text-center py-10 animate-fade-in">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-50 flex items-center justify-center mb-4">
                <X className="w-8 h-8 text-rose-500" />
              </div>
              <p className="font-medium text-rose-600 mb-2">Something went wrong</p>
              <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">{error}</p>
              <button
                onClick={() => {
                  if (connectionRef.current) {
                    closeScannerPort(connectionRef.current).catch(() => {});
                    connectionRef.current = null;
                  }
                  reset();
                }}
                className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition-all-smooth inline-flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
            </div>
          ) : phase === 'scanning' || phase === 'processing' ? (
            <div className="py-10 animate-fade-in">
              <div className="flex flex-col items-center mb-6">
                <div className="relative">
                  <Loader2 className="w-14 h-14 animate-spin text-slate-700" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold text-slate-700">{Math.round(progress)}%</span>
                  </div>
                </div>
                <p className="font-medium text-slate-900 mt-4">{stage}</p>
                <div className="w-full max-w-xs mt-4">
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <div
                      className="h-full bg-gradient-to-r from-slate-700 to-slate-900 rounded-full"
                      style={{ width: `${progress}%`, transition: 'width 0.4s ease-out' }}
                    />
                  </div>
                </div>
                <p className="text-sm text-slate-400 mt-2">
                  {deviceName ? `Connected to ${deviceName}` : 'Working...'}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Idle / connecting */}
              {deviceName && phase === 'idle' ? (
                <div className="animate-fade-in">
                  <div className="rounded-2xl bg-slate-50 border border-slate-200 p-6 text-center mb-6">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center mb-3 shadow-lg shadow-slate-500/20">
                      <Printer className="w-8 h-8 text-white" />
                    </div>
                    <p className="font-bold font-display text-slate-900">{deviceName}</p>
                    <p className="text-sm text-emerald-600 mt-1 flex items-center justify-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Connecté et prêt
                    </p>
                  </div>

                  <div className="space-y-3 mb-6">
                    {[
                      { icon: Usb, text: 'USB scanner connected' },
                      { icon: FileText, text: 'Scan will be saved as PDF' },
                      { icon: ScanLine, text: 'AI will analyze the content' },
                    ].map((item) => (
                      <div key={item.text} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-100">
                        <item.icon className="w-5 h-5 text-slate-400 flex-shrink-0" />
                        <span className="text-sm text-slate-600">{item.text}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleScan}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-slate-700 to-slate-900 text-white font-semibold shadow-lg shadow-slate-500/25 hover:shadow-slate-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all-smooth flex items-center justify-center gap-2"
                  >
                    <ScanLine className="w-5 h-5" />
                    Start Scan
                  </button>
                  <button
                    onClick={() => {
                      if (connectionRef.current) {
                        closeScannerPort(connectionRef.current).catch(() => {});
                        connectionRef.current = null;
                      }
                      reset();
                    }}
                    className="w-full py-2.5 mt-2 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    Choose different scanner
                  </button>
                </div>
              ) : (
                <div className="animate-fade-in">
                  <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 p-8 text-center mb-6">
                    <div className="w-20 h-20 mx-auto rounded-2xl bg-white shadow-sm flex items-center justify-center mb-4">
                      <Printer className="w-10 h-10 text-slate-400" />
                    </div>
                    <h3 className="font-bold font-display text-slate-900 mb-2">Connect your printer/scanner</h3>
                    <p className="text-sm text-slate-500 max-w-sm mx-auto">
                      Connect your USB printer or scanner to your computer, make sure it's powered on, then click below to connect.
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-6">
                    {['Epson', 'HP', 'Canon', 'Brother', 'Xerox', 'Fujitsu'].map((brand) => (
                      <div key={brand} className="flex items-center justify-center gap-1.5 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="text-xs font-medium text-slate-500">{brand}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleConnect}
                    disabled={phase === 'connecting'}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-slate-700 to-slate-900 text-white font-semibold shadow-lg shadow-slate-500/25 hover:shadow-slate-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all-smooth flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {phase === 'connecting' ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Usb className="w-5 h-5" />
                        Connect Scanner
                      </>
                    )}
                  </button>
                  {phase === 'connecting' && (
                    <p className="text-sm text-slate-400 text-center mt-3">{stage}</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
