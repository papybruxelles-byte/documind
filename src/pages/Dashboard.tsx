import { useEffect, useMemo, useState } from 'react';
import { useDocuments, useNotifications } from '@/hooks/useData';
import { PageHeader, SparkleBadge } from '@/components/AppShell';
import { getCategoryIcon, getCategoryColors } from '@/lib/category-utils';
import { FileText, TrendingUp, Bell, Clock, ArrowRight, CheckCircle2, Loader2, Upload, ScanLine, Printer, Folder, ChevronRight } from 'lucide-react';
import type { Page } from '@/components/AppShell';
import type { DocumentCategory } from '@/types/database';
import { useAuth } from '@/context/AuthContext';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface DashboardProps {
  onNavigate: (page: Page) => void;
  onOpenDocument: (id: string) => void;
  onOpenCategory: (category: DocumentCategory) => void;
  onUpload: () => void;
  onScan: () => void;
  onPrintScan: () => void;
}

export function Dashboard({ onNavigate, onOpenDocument, onOpenCategory, onUpload, onScan, onPrintScan }: DashboardProps) {
  const { user } = useAuth();
  const { documents, loading } = useDocuments();
  const { notifications, unreadCount } = useNotifications();
  const [sharedAlert, setSharedAlert] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    let initialSnapshot = true;
    return onSnapshot(collection(db, 'users', user.uid, 'documents'), (snapshot) => {
      if (initialSnapshot) { initialSnapshot = false; return; }
      const shared = snapshot.docChanges().find((change) => change.type === 'added' && Boolean(change.doc.data().shared_from));
      if (shared) setSharedAlert({ id: shared.doc.id, title: shared.doc.data().title || 'Shared document' });
    });
  }, [user]);

  const refreshSharedDocument = async () => {
    const documentId = sharedAlert?.id;
    if (documentId) {
      sessionStorage.setItem('documind-last-shared-alert', documentId);
      setSharedAlert(null);
    }
    if (documentId) onOpenDocument(documentId);
  };

  const stats = useMemo(() => {
    const categoryCounts: Record<string, number> = {};
    let processing = 0;

    for (const doc of documents) {
      categoryCounts[doc.category] = (categoryCounts[doc.category] || 0) + 1;
      if (doc.ai_status === 'processing' || doc.ocr_status === 'processing') processing++;
    }

    const topCategories = Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6);

    return {
      total: documents.length,
      processing,
      topCategories,
      categoryCounts,
    };
  }, [documents]);

  const sharedDocs = documents.filter((document) => Boolean(document.shared_from));
  const recentDocs = documents.filter((document) => !document.shared_from).slice(0, 5);
  const upcomingNotifications = notifications.filter((n) => !n.read).slice(0, 4);

  const statCards = [
    { label: 'Total Documents', value: stats.total, icon: FileText, color: 'from-blue-500 to-cyan-500', bg: 'bg-blue-50' },
    { label: 'Processing', value: stats.processing, icon: Loader2, color: 'from-amber-500 to-orange-500', bg: 'bg-amber-50' },
    { label: 'Categories', value: Object.keys(stats.categoryCounts).length, icon: TrendingUp, color: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-50' },
    { label: 'Alerts', value: unreadCount, icon: Bell, color: 'from-rose-500 to-pink-500', bg: 'bg-rose-50' },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-1">
        <PageHeader
          title="Dashboard"
          subtitle="Your document intelligence overview"
        />
      </div>
      <div className="mb-3">
        <SparkleBadge />
      </div>

      {sharedAlert && <button onClick={refreshSharedDocument} className="w-full mb-6 rounded-xl bg-rose-600 px-5 py-3 text-left text-white shadow-lg shadow-rose-500/20 hover:bg-rose-700 transition-colors"><span className="block font-semibold">You have a new document shared with you.</span><span className="block text-sm text-rose-100 mt-1">Click to open “{sharedAlert.title}”.</span></button>}

      {/* Welcome hero with action buttons */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4 sm:p-5 mb-5 animate-fade-in-up h-[min(22vh,180px)]">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-0 left-1/3 w-48 h-48 bg-cyan-500/15 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
        <div className="relative z-10 h-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="max-w-lg">
            <h2 className="text-xl font-bold font-display text-white mb-1">
              {documents.length === 0 ? 'Welcome to DocuMind' : 'What would you like to do?'}
            </h2>
            <p className="text-sm text-blue-200/80 line-clamp-2">
              {documents.length === 0
                ? 'Upload or scan your first document and let AI instantly summarize, categorize, and extract key details.'
                : `${documents.length} document${documents.length !== 1 ? 's' : ''} in your library. Upload more or scan a new document to keep building your knowledge base.`}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
            <button
              onClick={onUpload}
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-semibold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.03] active:scale-[0.98] transition-all-smooth"
            >
              <Upload className="w-5 h-5" />
              Upload Document
            </button>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={onScan}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm font-semibold hover:bg-white/20 hover:scale-[1.03] active:scale-[0.98] transition-all-smooth"
              >
                <ScanLine className="w-5 h-5" />
                Camera Scan
              </button>
              <button
                onClick={onPrintScan}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm font-semibold hover:bg-white/20 hover:scale-[1.03] active:scale-[0.98] transition-all-smooth"
              >
                <Printer className="w-5 h-5" />
                Printer Scan
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {statCards.map((stat, i) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm hover:shadow-md transition-all-smooth animate-fade-in-up"
            style={{ animationDelay: `${i * 0.1}s`, opacity: 0 }}
          >
            <div className="flex items-start justify-between mb-2"><div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center`}><stat.icon className={`w-4 h-4 ${stat.icon === Loader2 && stat.value > 0 ? 'animate-spin text-amber-500' : 'text-slate-700'}`} /></div></div>
            <p className="text-2xl font-bold font-display text-slate-900 leading-none">{stat.value}</p>
            <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Category spaces */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold font-display text-slate-900">Category Spaces</h2>
            <p className="text-sm text-slate-500 mt-0.5">Folders automatically organized by AI document category</p>
          </div>
          {stats.topCategories.length > 0 && (
            <button
              onClick={() => onNavigate('library')}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
            >
              View library <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {stats.topCategories.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center">
              <Folder className="w-6 h-6 text-slate-400" />
            </div>
            <div>
              <p className="font-medium text-slate-700">Your category spaces will appear here</p>
              <p className="text-sm text-slate-400">Upload a document and its AI category will create a space automatically.</p>
            </div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {stats.topCategories.map(([category, count], index) => {
              const typedCategory = category as DocumentCategory;
              const Icon = getCategoryIcon(typedCategory);
              const colors = getCategoryColors(typedCategory);
              return (
                <button
                  key={category}
                  onClick={() => onOpenCategory(typedCategory)}
                  className="group relative overflow-hidden bg-white rounded-xl border border-slate-100 p-3 text-left shadow-sm hover:shadow-lg hover:border-blue-200 transition-all-smooth animate-fade-in-up"
                  style={{ animationDelay: `${index * 0.06}s`, opacity: 0 }}
                >
                  <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${colors.gradient}`} />
                  <div className="flex items-start justify-between gap-3">
                    <div className={`w-8 h-8 rounded-lg ${colors.bg} ${colors.border} border flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 ${colors.text}`} />
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <p className="font-semibold text-sm text-slate-900 mt-2 group-hover:text-blue-600 transition-colors">{category}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{count} file{count !== 1 ? 's' : ''}</p>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {sharedDocs.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div><h2 className="font-semibold font-display text-slate-900">Shared Documents</h2><p className="text-sm text-slate-500 mt-0.5">Documents received from your administrator</p></div>
            <span className="text-xs font-semibold text-violet-700 bg-violet-100 px-2.5 py-1 rounded-full">{sharedDocs.length}</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sharedDocs.slice(0, 6).map((document) => {
              const Icon = getCategoryIcon(document.category);
              const colors = getCategoryColors(document.category);
              return <button key={document.id} onClick={() => onOpenDocument(document.id)} className="flex items-center gap-3 rounded-xl border border-violet-100 bg-violet-50/70 p-3 text-left hover:bg-violet-100 transition-all-smooth"><div className={`w-9 h-9 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0`}><Icon className={`w-4 h-4 ${colors.text}`} /></div><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-800 truncate">{document.title}</p><p className="text-xs text-violet-600 mt-0.5">Shared by administrator</p></div></button>;
            })}
          </div>
        </section>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent documents */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <h2 className="font-semibold font-display text-slate-900">Recent Documents</h2>
            <button
              onClick={() => onNavigate('library')}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
            >
              View all <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              Loading documents...
            </div>
          ) : recentDocs.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-500 font-medium">No documents yet</p>
              <p className="text-sm text-slate-400 mt-1">Upload your first document to get started</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {recentDocs.map((doc) => {
                const Icon = getCategoryIcon(doc.category);
                const colors = getCategoryColors(doc.category);
                const isProcessing = doc.ai_status === 'processing' || doc.ocr_status === 'processing';
                const isShared = Boolean(doc.shared_from);
                return (
                  <button
                    key={doc.id}
                    onClick={() => onOpenDocument(doc.id)}
                    className={`w-full flex items-center gap-3 p-3 transition-all-smooth text-left group ${isShared ? 'bg-violet-50/70 hover:bg-violet-100/70 border-l-4 border-violet-400' : 'hover:bg-slate-50'}`}
                  >
                    <div className={`w-11 h-11 rounded-xl ${colors.bg} ${colors.border} border flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-5 h-5 ${colors.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate group-hover:text-blue-600 transition-colors">{doc.title}</p>
                      <p className="text-sm text-slate-400 truncate">{doc.summary || 'No summary available'}</p>
                      <p className="text-xs text-slate-500 mt-1">{isShared ? 'Shared from administrator' : 'Uploaded'} · {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      {isShared && <span className="inline-flex mt-1 text-[11px] font-semibold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full">Shared with you</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isProcessing ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                          <Loader2 className="w-3 h-3 animate-spin" /> Processing
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> Ready
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Category breakdown + notifications */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="font-semibold font-display text-slate-900 mb-4">Categories</h2>
            {stats.topCategories.length === 0 ? (
              <p className="text-sm text-slate-400">No categories yet</p>
            ) : (
              <div className="space-y-3">
                {stats.topCategories.map(([category, count]) => {
                  const Icon = getCategoryIcon(category);
                  const colors = getCategoryColors(category);
                  const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                  return (
                    <div key={category}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${colors.text}`} />
                          <span className="text-sm font-medium text-slate-700">{category}</span>
                        </div>
                        <span className="text-sm font-semibold text-slate-900">{count}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${colors.gradient} rounded-full transition-all-smooth`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {upcomingNotifications.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold font-display text-slate-900">Alerts</h2>
                <button
                  onClick={() => onNavigate('notifications')}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  View all
                </button>
              </div>
              <div className="space-y-3">
                {upcomingNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-3 rounded-xl border ${
                      notif.severity === 'danger'
                        ? 'bg-rose-50 border-rose-200'
                        : notif.severity === 'warning'
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <Clock className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                        notif.severity === 'danger' ? 'text-rose-600' : notif.severity === 'warning' ? 'text-amber-600' : 'text-blue-600'
                      }`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{notif.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notif.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
