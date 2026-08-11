import { useState, useEffect, useCallback, useRef } from 'react';
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

interface AppHistoryState {
  signataireView: true;
  page: Page;
  documentId: string | null;
  libraryCategory: DocumentCategory | 'all';
}

interface AppBoundaryState {
  signataireBoundary: true;
}

function isAppHistoryState(value: unknown): value is AppHistoryState {
  return Boolean(value && typeof value === 'object' && 'signataireView' in value);
}

function isAppBoundaryState(value: unknown): value is AppBoundaryState {
  return Boolean(value && typeof value === 'object' && 'signataireBoundary' in value);
}

function AppContent() {
  const { user, loading, signOut } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [libraryCategory, setLibraryCategory] = useState<DocumentCategory | 'all'>('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [printScanOpen, setPrintScanOpen] = useState(false);
  const [folderCreateRequest, setFolderCreateRequest] = useState(0);
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const [leavePromptOpen, setLeavePromptOpen] = useState(false);
  const [sessionWarningOpen, setSessionWarningOpen] = useState(false);
  const [sessionSecondsRemaining, setSessionSecondsRemaining] = useState(60);
  const inactivityTimerRef = useRef<number | null>(null);
  const sessionEndTimerRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const sessionWarningActiveRef = useRef(false);
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

  const clearSessionTimers = useCallback(() => {
    if (inactivityTimerRef.current !== null) window.clearTimeout(inactivityTimerRef.current);
    if (sessionEndTimerRef.current !== null) window.clearTimeout(sessionEndTimerRef.current);
    if (countdownTimerRef.current !== null) window.clearInterval(countdownTimerRef.current);
    inactivityTimerRef.current = null;
    sessionEndTimerRef.current = null;
    countdownTimerRef.current = null;
  }, []);

  const startInactivityTimer = useCallback(() => {
    clearSessionTimers();
    sessionWarningActiveRef.current = false;
    setSessionWarningOpen(false);
    setSessionSecondsRemaining(60);
    if (!user) return;

    inactivityTimerRef.current = window.setTimeout(() => {
      sessionWarningActiveRef.current = true;
      setSessionWarningOpen(true);
      const deadline = Date.now() + 60_000;
      countdownTimerRef.current = window.setInterval(() => {
        setSessionSecondsRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
      }, 250);
      sessionEndTimerRef.current = window.setTimeout(() => {
        clearSessionTimers();
        void signOut();
      }, 60_000);
    }, 5 * 60_000);
  }, [user, signOut, clearSessionTimers]);

  useEffect(() => {
    if (!user) {
      clearSessionTimers();
      sessionWarningActiveRef.current = false;
      setSessionWarningOpen(false);
      return;
    }

    const handleActivity = () => {
      if (!sessionWarningActiveRef.current) startInactivityTimer();
    };
    const activityEvents: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, handleActivity, { passive: true }));
    startInactivityTimer();

    return () => {
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, handleActivity));
      clearSessionTimers();
    };
  }, [user, startInactivityTimer, clearSessionTimers]);

  const applyHistoryState = useCallback((state: AppHistoryState) => {
    setCurrentPage(state.page);
    setSelectedDocId(state.documentId);
    setLibraryCategory(state.libraryCategory);
  }, []);

  const pushHistoryState = useCallback((state: Omit<AppHistoryState, 'signataireView'>) => {
    const nextState: AppHistoryState = { signataireView: true, ...state };
    window.history.pushState(nextState, '', window.location.href);
    applyHistoryState(nextState);
  }, [applyHistoryState]);

  useEffect(() => {
    if (!user) return;

    if (isAppHistoryState(window.history.state)) {
      applyHistoryState(window.history.state);
    } else {
      window.history.replaceState({ signataireBoundary: true } satisfies AppBoundaryState, '', window.location.href);
      const initialState: AppHistoryState = {
        signataireView: true,
        page: 'dashboard',
        documentId: null,
        libraryCategory: 'all',
      };
      window.history.pushState(initialState, '', window.location.href);
      applyHistoryState(initialState);
    }

    const handlePopState = (event: PopStateEvent) => {
      if (isAppHistoryState(event.state)) {
        setLeavePromptOpen(false);
        applyHistoryState(event.state);
      } else if (isAppBoundaryState(event.state)) {
        setLeavePromptOpen(true);
      }
    };
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const handlePageHide = () => {
      void signOut();
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [user, signOut, applyHistoryState]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Chargement de Signataire Intelligent…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  if (accountStatus === null) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;

  if (accountStatus === 'pending') return <AppShell currentPage="dashboard" onNavigate={() => undefined} onUpload={() => undefined} unreadNotifications={0}><div className="relative min-h-full"><div className="pointer-events-none select-none grayscale opacity-50"><Dashboard onNavigate={() => undefined} onOpenDocument={() => undefined} onOpenCategory={() => undefined} onUpload={() => undefined} onScan={() => undefined} onPrintScan={() => undefined} /></div><div className="absolute inset-0 z-20 flex items-start justify-center bg-slate-200/60 backdrop-blur-[2px] p-6 pt-10"><div className="max-w-2xl text-center bg-rose-600 rounded-2xl border border-rose-700 px-6 py-4 shadow-xl"><p className="text-sm font-medium text-white whitespace-nowrap">En attente de l’approbation de l’administrateur — contactez-le pour accéder au tableau de bord.</p></div></div></div></AppShell>;

  const handleNavigate = (page: Page) => {
    pushHistoryState({ page, documentId: null, libraryCategory: page === 'library' ? 'all' : libraryCategory });
  };

  const handleOpenCategory = (category: DocumentCategory) => {
    pushHistoryState({ page: 'library', documentId: null, libraryCategory: category });
  };

  const handleOpenDocument = (id: string) => {
    pushHistoryState({ page: 'library', documentId: id, libraryCategory });
  };

  const handleUploadComplete = (documentId: string) => {
    pushHistoryState({ page: 'library', documentId, libraryCategory });
  };

  const handleStayInApp = () => {
    setLeavePromptOpen(false);
    window.history.forward();
  };

  const handleLeaveApp = async () => {
    setLeavePromptOpen(false);
    await signOut();
    // Stay inside the SPA so the authentication screen renders without requesting
    // a previous server-managed history entry (which may return an OpenResty 403).
    window.history.replaceState(null, '', window.location.href);
  };

  const handleKeepWorking = () => {
    startInactivityTimer();
  };

  const showDetail = selectedDocId !== null;

  return (
    <>
      <AppShell
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onUpload={() => setUploadOpen(true)}
        onCreateFolder={() => {
          pushHistoryState({ page: 'dashboard', documentId: null, libraryCategory });
          setFolderCreateRequest((value) => value + 1);
        }}
        unreadNotifications={unreadCount}
      >
        {showDetail ? (
          <DocumentDetail
            documentId={selectedDocId!}
            onBack={() => window.history.back()}
          />
        ) : currentPage === 'dashboard' ? (
          <Dashboard
            onNavigate={handleNavigate}
            onOpenDocument={handleOpenDocument}
            onOpenCategory={handleOpenCategory}
            onUpload={() => setUploadOpen(true)}
            onScan={() => setScanOpen(true)}
            onPrintScan={() => setPrintScanOpen(true)}
            folderCreateRequest={folderCreateRequest}
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

      {leavePromptOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm">
          <div role="alertdialog" aria-modal="true" aria-labelledby="leave-app-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 id="leave-app-title" className="text-xl font-bold text-slate-900">Vous allez quitter l’application</h2>
            <p className="mt-2 text-sm text-slate-600">Voulez-vous continuer ? Vous serez déconnecté.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={handleStayInApp} className="rounded-xl border border-slate-300 px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50">Non, rester</button>
              <button onClick={handleLeaveApp} className="rounded-xl bg-rose-600 px-4 py-2.5 font-semibold text-white hover:bg-rose-700">Oui, quitter</button>
            </div>
          </div>
        </div>
      )}

      {sessionWarningOpen && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div role="alertdialog" aria-modal="true" aria-labelledby="session-warning-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 id="session-warning-title" className="text-xl font-bold text-slate-900">Your session is about to end</h2>
            <p className="mt-2 text-sm text-slate-600">For your document security, you will be signed out in {sessionSecondsRemaining} second{sessionSecondsRemaining === 1 ? '' : 's'} due to inactivity.</p>
            <p className="mt-2 text-sm font-medium text-slate-800">Do you want to keep working?</p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => void signOut()} className="rounded-xl border border-slate-300 px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50">Sign out now</button>
              <button autoFocus onClick={handleKeepWorking} className="rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700">Keep working</button>
            </div>
          </div>
        </div>
      )}
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
