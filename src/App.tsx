import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AuthPage } from '@/pages/AuthPage';
import { AppShell, type Page } from '@/components/AppShell';
import { Dashboard } from '@/pages/Dashboard';
import { Library } from '@/pages/Library';
import { DocumentDetail } from '@/pages/DocumentDetail';
import { Notifications } from '@/pages/Notifications';
import { Settings } from '@/pages/Settings';
import { UploadModal } from '@/components/UploadModal';
import { ScanModal } from '@/components/ScanModal';
import { PrintScannerModal } from '@/components/PrintScannerModal';
import { useNotifications } from '@/hooks/useData';
import { Loader2 } from 'lucide-react';
import type { DocumentCategory } from '@/types/database';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [libraryCategory, setLibraryCategory] = useState<DocumentCategory | 'all'>('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [printScanOpen, setPrintScanOpen] = useState(false);
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const { unreadCount, refetch: refetchNotifications } = useNotifications();

  useEffect(() => {
    if (user) {
      refetchNotifications();
    }
  }, [user, refetchNotifications]);

  useEffect(() => {
    if (!user) { setAccountStatus(null); return; }
    setAccountStatus(null);
    return onSnapshot(doc(db, 'profiles', user.uid), (snapshot) => setAccountStatus(snapshot.data()?.status || null));
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Loading DocuMind...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  if (accountStatus === null) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;

  if (accountStatus === 'pending') return <AppShell currentPage="dashboard" onNavigate={() => undefined} onUpload={() => undefined} unreadNotifications={0}><div className="relative min-h-full"><div className="pointer-events-none select-none grayscale opacity-50"><Dashboard onNavigate={() => undefined} onOpenDocument={() => undefined} onOpenCategory={() => undefined} onUpload={() => undefined} onScan={() => undefined} onPrintScan={() => undefined} /></div><div className="absolute inset-0 z-20 flex items-start justify-center bg-slate-200/60 backdrop-blur-[2px] p-6 pt-10"><div className="max-w-2xl text-center bg-rose-600 rounded-2xl border border-rose-700 px-6 py-4 shadow-xl"><p className="text-sm font-medium text-white whitespace-nowrap">Waiting for company admin approval — contact your administrator to unlock dashboard access.</p></div></div></div></AppShell>;

  const handleNavigate = (page: Page) => {
    setSelectedDocId(null);
    if (page === 'library') setLibraryCategory('all');
    setCurrentPage(page);
  };

  const handleOpenCategory = (category: DocumentCategory) => {
    setSelectedDocId(null);
    setLibraryCategory(category);
    setCurrentPage('library');
  };

  const handleOpenDocument = (id: string) => {
    setSelectedDocId(id);
    setCurrentPage('library');
  };

  const handleUploadComplete = (documentId: string) => {
    setSelectedDocId(documentId);
    setCurrentPage('library');
  };

  const showDetail = selectedDocId !== null;

  return (
    <>
      <AppShell
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onUpload={() => setUploadOpen(true)}
        unreadNotifications={unreadCount}
      >
        {showDetail ? (
          <DocumentDetail
            documentId={selectedDocId!}
            onBack={() => setSelectedDocId(null)}
          />
        ) : currentPage === 'dashboard' ? (
          <Dashboard
            onNavigate={handleNavigate}
            onOpenDocument={handleOpenDocument}
            onOpenCategory={handleOpenCategory}
            onUpload={() => setUploadOpen(true)}
            onScan={() => setScanOpen(true)}
            onPrintScan={() => setPrintScanOpen(true)}
          />
        ) : currentPage === 'library' ? (
          <Library onOpenDocument={handleOpenDocument} initialCategory={libraryCategory} />
        ) : currentPage === 'notifications' ? (
          <Notifications onOpenDocument={handleOpenDocument} />
        ) : (
          <Settings />
        )}
      </AppShell>

      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onComplete={handleUploadComplete}
      />

      <ScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onComplete={handleUploadComplete}
      />

      <PrintScannerModal
        open={printScanOpen}
        onClose={() => setPrintScanOpen(false)}
        onComplete={handleUploadComplete}
      />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
