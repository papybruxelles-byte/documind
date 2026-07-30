import { useState, useCallback, useRef } from 'react';
import { Upload, X, File as FileIcon, Loader2, CheckCircle2, AlertCircle, Image, FileText, Cloud } from 'lucide-react';
import { processAndUploadDocument } from '@/lib/document-processor';
import { useAuth } from '@/context/AuthContext';

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: (documentId: string) => void;
}

interface UploadItem {
  file: File;
  stage: string;
  status: 'uploading' | 'processing' | 'done' | 'error';
  error?: string;
  documentId?: string;
}

export function UploadModal({ open, onClose, onComplete }: UploadModalProps) {
  const { user } = useAuth();
  const [dragActive, setDragActive] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList) => {
    if (!user) return;

    const items: UploadItem[] = Array.from(files).map((file) => ({
      file,
      stage: 'Starting...',
      status: 'uploading',
    }));

    setUploads(items);

    for (let i = 0; i < items.length; i++) {
      const file = items[i].file;
      setUploads((prev) => prev.map((u, idx) => idx === i ? { ...u, stage: 'Uploading...' } : u));

      const result = await processAndUploadDocument(file, user.uid, (stage) => {
        setUploads((prev) => prev.map((u, idx) => idx === i ? { ...u, stage, status: 'processing' } : u));
      });

      setUploads((prev) => prev.map((u, idx) =>
        idx === i
          ? result.error
            ? { ...u, status: 'error', error: result.error, stage: 'Failed' }
            : { ...u, status: 'done', stage: 'Complete', documentId: result.documentId }
          : u
      ));
    }
  }, [user]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleClose = () => {
    const allDone = uploads.every((u) => u.status === 'done' || u.status === 'error');
    if (allDone) {
      const firstDoc = uploads.find((u) => u.documentId);
      setUploads([]);
      onClose();
      if (firstDoc?.documentId) {
        onComplete(firstDoc.documentId);
      }
    } else {
      onClose();
    }
  };

  if (!open) return null;

  const allComplete = uploads.length > 0 && uploads.every((u) => u.status === 'done' || u.status === 'error');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-fade-in" onClick={handleClose} />

      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl animate-scale-in max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold font-display text-slate-900">Upload Documents</h2>
            <p className="text-sm text-slate-500 mt-0.5">AI will process, summarize, and categorize your documents</p>
          </div>
          <button onClick={handleClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all-smooth">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto scrollbar-thin">
          {uploads.length === 0 ? (
            <>
              <div
                onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all-smooth ${
                  dragActive
                    ? 'border-blue-500 bg-blue-50 scale-[1.01]'
                    : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
                }`}
              >
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
                  <Upload className="w-8 h-8 text-white" />
                </div>
                <p className="text-lg font-semibold text-slate-900 mb-1">Drop files here or click to browse</p>
                <p className="text-sm text-slate-500">Supports PDF, Word, Excel, images, and text files</p>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.gif,.tiff,.txt"
                  className="hidden"
                  onChange={(e) => e.target.files && handleFiles(e.target.files)}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
                {[
                  { icon: FileText, label: 'PDF' },
                  { icon: Image, label: 'Images' },
                  { icon: FileIcon, label: 'Documents' },
                  { icon: Cloud, label: 'Cloud' },
                ].map((source) => (
                  <div key={source.label} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <source.icon className="w-6 h-6 text-slate-400" />
                    <span className="text-xs font-medium text-slate-500">{source.label}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-3">
              {uploads.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 bg-white animate-fade-in-up"
                >
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <FileIcon className="w-5 h-5 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{item.file.name}</p>
                    <p className="text-xs text-slate-400">{(item.file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {item.status === 'done' ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        <span className="text-sm font-medium text-emerald-600">Done</span>
                      </>
                    ) : item.status === 'error' ? (
                      <>
                        <AlertCircle className="w-5 h-5 text-rose-500" />
                        <span className="text-sm font-medium text-rose-600">Failed</span>
                      </>
                    ) : (
                      <>
                        <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                        <span className="text-sm text-slate-500">{item.stage}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {allComplete && (
                <button
                  onClick={handleClose}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold hover:scale-[1.01] transition-all-smooth mt-4"
                >
                  View Documents
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
