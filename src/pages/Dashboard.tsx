import { useEffect, useMemo, useState } from 'react';
import { useDocuments, useFolders, useNotifications } from '@/hooks/useData';
import { PageHeader, SparkleBadge } from '@/components/AppShell';
import { getCategoryIcon, getCategoryColors } from '@/lib/category-utils';
import { FileText, TrendingUp, Bell, Clock, ArrowRight, CheckCircle2, Loader2, AlertCircle, Upload, ScanLine, Printer, Folder, FolderPlus, Plus, ChevronRight, Sparkles, Search, CircleDollarSign, FileSignature, UserCheck, X } from 'lucide-react';
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
  folderCreateRequest?: number;
}

const PROCESSING_STALE_MS = 3 * 60 * 1000;

function isStaleProcessing(document: { ai_status: string; ocr_status: string; updated_at: string }) {
  const processing = document.ai_status === 'processing' || document.ocr_status === 'processing';
  const updatedAt = new Date(document.updated_at).getTime();
  return processing && Number.isFinite(updatedAt) && Date.now() - updatedAt >= PROCESSING_STALE_MS;
}

export function Dashboard({ onNavigate, onOpenDocument, onOpenCategory, onUpload, onScan, onPrintScan, folderCreateRequest = 0 }: DashboardProps) {
  const { user } = useAuth();
  const { documents, loading } = useDocuments();
  const { folders, createFolder } = useFolders();
  const { notifications, unreadCount } = useNotifications();
  const [sharedAlert, setSharedAlert] = useState<{ id: string; title: string } | null>(null);
  const [actionQuery, setActionQuery] = useState('');
  const [actionResultIds, setActionResultIds] = useState<string[] | null>(null);
  const [expandedActionCards, setExpandedActionCards] = useState<Record<string, boolean>>({});
  const [folderCreatorOpen, setFolderCreatorOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [dashboardTab, setDashboardTab] = useState<'main' | 'action'>('main');

  useEffect(() => {
    if (folderCreateRequest > 0) {
      setDashboardTab('action');
      setFolderCreatorOpen(true);
    }
  }, [folderCreateRequest]);

  const handleCreateFolder = async () => {
    if (!folderName.trim() || creatingFolder) return;
    setCreatingFolder(true);
    const folder = await createFolder(folderName);
    setCreatingFolder(false);
    if (folder) {
      setFolderName('');
      setFolderCreatorOpen(false);
      setSelectedFolderId(folder.id);
    }
  };

  useEffect(() => {
    if (!user) return;
    let initialSnapshot = true;
    return onSnapshot(collection(db, 'users', user.uid, 'documents'), (snapshot) => {
      if (initialSnapshot) { initialSnapshot = false; return; }
      const shared = snapshot.docChanges().find((change) => change.type === 'added' && Boolean(change.doc.data().shared_from));
      if (shared) setSharedAlert({ id: shared.doc.id, title: shared.doc.data().title || 'Document partagé' });
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
      if ((doc.ai_status === 'processing' || doc.ocr_status === 'processing') && !isStaleProcessing(doc)) processing++;
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

  const actionItems = useMemo(() => {
    const now = new Date();
    const inDays = (value?: string | null) => value ? Math.ceil((new Date(value).getTime() - now.getTime()) / 86_400_000) : null;
    const field = (document: typeof documents[number], ...names: string[]) => {
      const entries = Object.entries(document.document_metadata?.fields || {});
      return entries.find(([key]) => names.some((name) => key.toLowerCase().replace(/\s+/g, '_').includes(name)))?.[1];
    };
    const invoices = documents.filter((document) => document.category === 'Invoice' && document.status !== 'closed');
    const invoicesNeedingApproval = invoices.filter((document) => (document.workflow_stage || 'received') === 'received');
    const invoicesDueSoon = invoices.filter((document) => {
      const days = inDays(document.document_metadata?.expiration_date || field(document, 'due_date', 'payment_due'));
      return days !== null && days >= 0 && days <= 7;
    });
    const expiringContracts = documents.filter((document) => document.category === 'Employment Contract' && document.status !== 'closed' && (() => {
      const days = inDays(document.document_metadata?.expiration_date);
      return days !== null && days >= 0 && days <= 30;
    })());
    const waitingReview = documents.filter((document) => document.status === 'pending' && Boolean(document.assigned_to));
    return [
      { label: 'factures à approuver', count: invoicesNeedingApproval.length, icon: CircleDollarSign, tone: 'amber', docs: invoicesNeedingApproval },
      { label: 'factures à échéance cette semaine', count: invoicesDueSoon.length, icon: Clock, tone: 'rose', docs: invoicesDueSoon },
      { label: 'contrats expirant sous 30 jours', count: expiringContracts.length, icon: FileSignature, tone: 'violet', docs: expiringContracts },
      { label: 'documents assignés non examinés', count: waitingReview.length, icon: UserCheck, tone: 'blue', docs: waitingReview },
    ].filter((item) => item.count > 0);
  }, [documents]);

  const runActionQuery = () => {
    const query = actionQuery.toLowerCase();
    const amountThreshold = Number(query.match(/(?:over|above|greater than)\s*[€$£]?\s*([\d,.]+)/)?.[1]?.replace(/,/g, '') || 0);
    const thisMonth = new Date();
    const matches = documents.filter((document) => {
      const metadata = document.document_metadata;
      const fields = Object.fromEntries(Object.entries(metadata?.fields || {}).map(([key, value]) => [key.toLowerCase().replace(/[\s-]+/g, '_'), value.toLowerCase()]));
      const dueDate = metadata?.expiration_date || fields.due_date || fields.payment_due;
      if (query.includes('invoice') && document.category !== 'Invoice') return false;
      if (query.includes('contract') && document.category !== 'Employment Contract') return false;
      if ((query.includes('unpaid') || query.includes('payment')) && ['paid', 'archived'].includes(document.workflow_stage || 'received')) return false;
      if (amountThreshold && (metadata?.amount || 0) <= amountThreshold) return false;
      if (query.includes('this month')) {
        if (!dueDate) return false;
        const date = new Date(dueDate);
        if (date.getMonth() !== thisMonth.getMonth() || date.getFullYear() !== thisMonth.getFullYear()) return false;
      }
      if (query.includes('accounting') && !`${document.department || ''} ${document.assigned_to || ''}`.toLowerCase().includes('account')) return false;
      const fromMatch = query.match(/(?:from|received from)\s+(.+?)(?:\s+this year|$)/);
      if (fromMatch && !`${metadata?.issuer || ''} ${document.title}`.toLowerCase().includes(fromMatch[1].trim())) return false;
      return true;
    });
    setActionResultIds(matches.map((document) => document.id));
  };

  const actionResults = actionResultIds === null ? null : documents.filter((document) => actionResultIds.includes(document.id));

  const statCards = [
    { label: 'Total des documents', value: stats.total, icon: FileText, color: 'from-blue-500 to-cyan-500', bg: 'bg-blue-50' },
    { label: 'En traitement', value: stats.processing, icon: Loader2, color: 'from-amber-500 to-orange-500', bg: 'bg-amber-50' },
    { label: 'Catégories', value: Object.keys(stats.categoryCounts).length, icon: TrendingUp, color: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-50' },
    { label: 'Alertes', value: unreadCount, icon: Bell, color: 'from-rose-500 to-pink-500', bg: 'bg-rose-50' },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-1">
        <PageHeader
          title="Tableau de bord"
          subtitle="Vue d’ensemble de vos documents intelligents"
        />
      </div>
      <div className="mb-3">
        <SparkleBadge />
      </div>

      <div className="mb-6 flex w-full max-w-sm rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        <button onClick={() => setDashboardTab('main')} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${dashboardTab === 'main' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>Principal</button>
        <button onClick={() => setDashboardTab('action')} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${dashboardTab === 'action' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>Actions</button>
      </div>

      {dashboardTab === 'main' && <div className="space-y-6 animate-fade-in">
        <div className="grid gap-3 sm:grid-cols-3">
          <button onClick={() => setDashboardTab('action')} className="rounded-2xl border border-slate-100 bg-white p-5 text-left shadow-sm hover:border-blue-200"><Folder className="mb-3 h-6 w-6 text-amber-500" /><p className="text-3xl font-bold text-slate-900">{folders.length}</p><p className="text-sm text-slate-500">Classeurs</p></button>
          <button onClick={() => onNavigate('library')} className="rounded-2xl border border-slate-100 bg-white p-5 text-left shadow-sm hover:border-blue-200"><FileText className="mb-3 h-6 w-6 text-blue-500" /><p className="text-3xl font-bold text-slate-900">{documents.length}</p><p className="text-sm text-slate-500">Fichiers</p></button>
          <button onClick={() => setDashboardTab('action')} className="rounded-2xl border border-slate-100 bg-white p-5 text-left shadow-sm hover:border-blue-200"><TrendingUp className="mb-3 h-6 w-6 text-emerald-500" /><p className="text-3xl font-bold text-slate-900">{Object.keys(stats.categoryCounts).length}</p><p className="text-sm text-slate-500">Catégories</p></button>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold text-slate-900">Classeurs</h2><button onClick={() => { setDashboardTab('action'); setFolderCreatorOpen(true); }} className="text-xs font-semibold text-blue-600">Créer</button></div><div className="space-y-2">{folders.length === 0 ? <p className="text-sm text-slate-400">Aucun classeur créé.</p> : folders.slice(0, 6).map((folder) => <button key={folder.id} onClick={() => { setSelectedFolderId(folder.id); setDashboardTab('action'); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-slate-50"><Folder className="h-4 w-4 text-amber-500" /><span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{folder.name}</span><span className="text-xs text-slate-400">{documents.filter((document) => document.folder_id === folder.id).length}</span></button>)}</div></section>
          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold text-slate-900">Fichiers récents</h2><button onClick={() => onNavigate('library')} className="text-xs font-semibold text-blue-600">Tout voir</button></div><div className="space-y-2">{recentDocs.length === 0 ? <p className="text-sm text-slate-400">Aucun fichier.</p> : recentDocs.map((document) => <button key={document.id} onClick={() => onOpenDocument(document.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-slate-50"><FileText className="h-4 w-4 text-blue-500" /><span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{document.title}</span></button>)}</div></section>
          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><h2 className="mb-4 font-semibold text-slate-900">Catégories</h2><div className="space-y-2">{stats.topCategories.length === 0 ? <p className="text-sm text-slate-400">Aucune catégorie.</p> : stats.topCategories.map(([category, count]) => <button key={category} onClick={() => onOpenCategory(category as DocumentCategory)} className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left hover:bg-slate-50"><span className="truncate text-sm font-medium text-slate-700">{category}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{count}</span></button>)}</div></section>
        </div>
      </div>}

      <div className={dashboardTab === 'action' ? 'block animate-fade-in' : 'hidden'}>

      {sharedAlert && <button onClick={refreshSharedDocument} className="w-full mb-6 rounded-xl bg-rose-600 px-5 py-3 text-left text-white shadow-lg shadow-rose-500/20 hover:bg-rose-700 transition-colors"><span className="block font-semibold">Un nouveau document a été partagé avec vous.</span><span className="block text-sm text-rose-100 mt-1">Cliquez pour ouvrir « {sharedAlert.title} ».</span></button>}

      {/* Welcome hero with action buttons */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4 sm:p-5 mb-5 animate-fade-in-up h-[min(22vh,180px)]">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-0 left-1/3 w-48 h-48 bg-cyan-500/15 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
        <div className="relative z-10 h-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="max-w-lg">
            <h2 className="text-xl font-bold font-display text-white mb-1">
              {documents.length === 0 ? 'Bienvenue dans Signataire Intelligent' : 'Que souhaitez-vous faire ?'}
            </h2>
            <p className="text-sm text-blue-200/80 line-clamp-2">
              {documents.length === 0
                ? 'Importez ou numérisez votre premier document : l’IA le résumera, le classera et en extraira les informations clés.'
                : `${documents.length} document${documents.length !== 1 ? 's' : ''} dans votre bibliothèque. Importez ou numérisez un nouveau document.`}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
            <button
              onClick={onUpload}
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-semibold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.03] active:scale-[0.98] transition-all-smooth"
            >
              <Upload className="w-5 h-5" />
              Importer un document
            </button>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={onScan}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm font-semibold hover:bg-white/20 hover:scale-[1.03] active:scale-[0.98] transition-all-smooth"
              >
                <ScanLine className="w-5 h-5" />
                Scanner avec la caméra
              </button>
              <button
                onClick={onPrintScan}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm font-semibold hover:bg-white/20 hover:scale-[1.03] active:scale-[0.98] transition-all-smooth"
              >
                <Printer className="w-5 h-5" />
                Scanner papier
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
            <div className="flex items-start justify-between mb-2"><div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center`}><stat.icon className={`w-4 h-4 ${stat.icon === Loader2 && stat.value > 0 ? 'text-amber-500' : 'text-slate-700'}`} /></div></div>
            <p className="text-2xl font-bold font-display text-slate-900 leading-none">{stat.value}</p>
            <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <section className="mb-8 overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-indigo-950 via-blue-950 to-slate-900 p-5 sm:p-6 text-white">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-cyan-300"><Sparkles className="h-4 w-4" /> Centre d’actions IA</div>
              <h2 className="text-xl font-bold">Que devez-vous traiter aujourd’hui ?</h2>
              <p className="mt-1 text-sm text-blue-200/80">Signataire transforme les échéances, affectations et cycles de vie en liste de priorités.</p>
            </div>
            <div className="flex w-full max-w-xl gap-2 rounded-xl border border-white/10 bg-white/10 p-1.5 backdrop-blur-sm">
              <Search className="ml-2 mt-2 h-4 w-4 flex-shrink-0 text-blue-200" />
              <input value={actionQuery} onChange={(event) => setActionQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && runActionQuery()} placeholder="Interrogez Signataire sur vos documents…" className="min-w-0 flex-1 bg-transparent px-1 text-sm text-white outline-none placeholder:text-blue-200/60" />
              <button onClick={runActionQuery} className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-blue-950">Interroger l’IA</button>
            </div>
          </div>
        </div>
        {actionResults !== null && (
          <div className="border-b border-slate-100 bg-indigo-50/60 px-5 py-4">
            <div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold text-slate-800">{actionResults.length} document{actionResults.length === 1 ? '' : 's'} trouvé{actionResults.length === 1 ? '' : 's'}</p><button onClick={() => setActionResultIds(null)} className="text-xs font-semibold text-indigo-700">Effacer</button></div>
            {actionResults.length > 0 ? <div className="flex flex-wrap gap-2">{actionResults.slice(0, 6).map((document) => <button key={document.id} onClick={() => onOpenDocument(document.id)} className="rounded-lg border border-indigo-100 bg-white px-3 py-2 text-left text-sm text-slate-700 shadow-sm hover:border-indigo-300"><span className="font-semibold">{document.title}</span><span className="ml-2 text-slate-400">{document.category}</span></button>)}</div> : <p className="text-sm text-slate-500">Try a broader question or remove an amount, date, or department filter.</p>}
          </div>
        )}
        <div className="grid grid-cols-1 gap-px bg-slate-100">
          {actionItems.length > 0 ? actionItems.map((item) => (
            <div key={item.label} className="grid min-h-[7vh] w-full bg-white sm:grid-cols-[minmax(180px,0.22fr)_minmax(0,1fr)]">
              <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 p-4 sm:border-b-0 sm:border-r">
                <div className={`inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-${item.tone}-50 text-${item.tone}-600`}><item.icon className="h-5 w-5" /></div>
                <div><p className="text-2xl font-bold leading-none text-slate-900">{item.count}</p><p className="mt-1 text-xs leading-snug text-slate-500">{item.label}</p></div>
              </div>
              <div className="divide-y divide-slate-100">
                {item.docs.slice(0, expandedActionCards[item.label] ? item.docs.length : 10).map((document) => {
                  const metadata = document.document_metadata;
                  const fields = Object.fromEntries(Object.entries(metadata?.fields || {}).map(([key, value]) => [key.toLowerCase().replace(/[\s-]+/g, '_'), value]));
                  const relevantDate = metadata?.expiration_date || fields.due_date || fields.payment_due || document.created_at;
                  return (
                    <button key={document.id} onClick={() => onOpenDocument(document.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50">
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{document.title}</p><p className="mt-0.5 text-xs text-slate-400">{relevantDate ? new Date(relevantDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Aucune date détectée'}</p></div>
                      <span className="whitespace-nowrap text-sm font-bold text-slate-900">{metadata?.amount != null ? new Intl.NumberFormat('en', { style: 'currency', currency: metadata.currency || 'EUR' }).format(metadata.amount) : '—'}</span>
                      <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300" />
                    </button>
                  );
                })}
                {item.count > 10 && <button onClick={() => setExpandedActionCards((current) => ({ ...current, [item.label]: !current[item.label] }))} className="w-full px-3 py-2.5 text-center text-xs font-semibold text-blue-600 hover:bg-blue-50">{expandedActionCards[item.label] ? 'Afficher moins' : `Voir plus (${item.count - 10})`}</button>}
              </div>
            </div>
          )) : (
            <div className="col-span-full flex items-center gap-3 bg-white p-5"><CheckCircle2 className="h-6 w-6 text-emerald-500" /><div><p className="font-semibold text-slate-800">You're all caught up</p><p className="text-sm text-slate-500">No urgent document actions were detected.</p></div></div>
          )}
        </div>
      </section>

      <section className="mb-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold font-display text-slate-900">Mes classeurs</h2><p className="mt-0.5 text-sm text-slate-500">Créez des classeurs pour organiser vos documents selon vos besoins.</p></div>
          <button onClick={() => setFolderCreatorOpen(true)} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"><FolderPlus className="h-4 w-4" />Nouveau classeur</button>
        </div>
        {folders.length === 0 ? (
          <button onClick={() => setFolderCreatorOpen(true)} className="flex w-full items-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-left hover:border-blue-300 hover:bg-blue-50/30"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Plus className="h-5 w-5" /></div><div><p className="font-semibold text-slate-700">Créer votre premier classeur</p><p className="text-sm text-slate-400">Par exemple : Factures 2026, Contrats ou Courriers reçus.</p></div></button>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {folders.map((folder) => {
              const folderDocuments = documents.filter((document) => document.folder_id === folder.id);
              const selected = selectedFolderId === folder.id;
              return <div key={folder.id} className={`overflow-hidden rounded-xl border bg-white ${selected ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-100'}`}><button onClick={() => setSelectedFolderId(selected ? null : folder.id)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-slate-50"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><Folder className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="truncate font-semibold text-slate-800">{folder.name}</p><p className="text-xs text-slate-400">{folderDocuments.length} document{folderDocuments.length === 1 ? '' : 's'}</p></div><ChevronRight className={`h-4 w-4 text-slate-300 transition-transform ${selected ? 'rotate-90' : ''}`} /></button>{selected && <div className="border-t border-slate-100">{folderDocuments.length === 0 ? <p className="p-4 text-sm text-slate-400">Ce classeur est vide.</p> : folderDocuments.slice(0, 10).map((document) => <button key={document.id} onClick={() => onOpenDocument(document.id)} className="flex w-full items-center justify-between gap-3 border-b border-slate-50 px-4 py-2.5 text-left last:border-0 hover:bg-blue-50/40"><span className="truncate text-sm font-medium text-slate-700">{document.title}</span><ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300" /></button>)}</div>}</div>;
            })}
          </div>
        )}
      </section>

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

      {folderCreatorOpen && <div className="fixed inset-0 z-[120] flex items-center justify-center p-4"><div className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm" onClick={() => setFolderCreatorOpen(false)} /><div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><button onClick={() => setFolderCreatorOpen(false)} className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button><div className="mb-5 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><FolderPlus className="h-5 w-5" /></div><div><h3 className="text-lg font-bold text-slate-900">Créer un classeur</h3><p className="text-sm text-slate-500">Donnez-lui un nom simple et reconnaissable.</p></div></div><label className="mb-2 block text-sm font-medium text-slate-700">Nom du classeur</label><input autoFocus value={folderName} onChange={(event) => setFolderName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void handleCreateFolder()} placeholder="Ex. Factures 2026" className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /><div className="mt-5 flex gap-3"><button onClick={() => setFolderCreatorOpen(false)} className="flex-1 rounded-xl border border-slate-200 py-2.5 font-medium text-slate-700">Annuler</button><button onClick={() => void handleCreateFolder()} disabled={!folderName.trim() || creatingFolder} className="flex-1 rounded-xl bg-blue-600 py-2.5 font-semibold text-white disabled:opacity-50">{creatingFolder ? 'Création…' : 'Créer'}</button></div></div></div>}

      {sharedDocs.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div><h2 className="font-semibold font-display text-slate-900">Documents partagés</h2><p className="text-sm text-slate-500 mt-0.5">Documents reçus de votre administrateur</p></div>
            <span className="text-xs font-semibold text-violet-700 bg-violet-100 px-2.5 py-1 rounded-full">{sharedDocs.length}</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sharedDocs.slice(0, 6).map((document) => {
              const Icon = getCategoryIcon(document.category);
              const colors = getCategoryColors(document.category);
              return <button key={document.id} onClick={() => onOpenDocument(document.id)} className="flex items-center gap-3 rounded-xl border border-violet-100 bg-violet-50/70 p-3 text-left hover:bg-violet-100 transition-all-smooth"><div className={`w-9 h-9 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0`}><Icon className={`w-4 h-4 ${colors.text}`} /></div><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-800 truncate">{document.title}</p><p className="text-xs text-violet-600 mt-0.5">Partagé par l’administrateur</p></div></button>;
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
                const staleProcessing = isStaleProcessing(doc);
                const isProcessing = (doc.ai_status === 'processing' || doc.ocr_status === 'processing') && !staleProcessing;
                const hasFailed = doc.ai_status === 'failed' || doc.ocr_status === 'failed' || staleProcessing;
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
                      <p className="text-xs text-slate-500 mt-1">{isShared ? 'Partagé par l’administrateur' : 'Importé'} · {new Date(doc.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      {isShared && <span className="inline-flex mt-1 text-[11px] font-semibold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full">Partagé avec vous</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isProcessing ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                          <Clock className="w-3 h-3" /> Traitement
                        </span>
                      ) : hasFailed ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full">
                          <AlertCircle className="w-3 h-3" /> Failed
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> Prêt
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
    </div>
  );
}
