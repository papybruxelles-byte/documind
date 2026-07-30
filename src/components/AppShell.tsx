import { useState, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { FileSearch, LayoutDashboard, FolderOpen, Bell, Settings, LogOut, Menu, X, Upload, Sparkles } from 'lucide-react';

export type Page = 'dashboard' | 'library' | 'notifications' | 'settings';

interface AppShellProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onUpload: () => void;
  children: ReactNode;
  unreadNotifications: number;
}

const navItems: { page: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { page: 'library', label: 'Documents', icon: FolderOpen },
  { page: 'notifications', label: 'Notifications', icon: Bell },
  { page: 'settings', label: 'Settings', icon: Settings },
];

export function AppShell({ currentPage, onNavigate, onUpload, children, unreadNotifications }: AppShellProps) {
  const { user, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const userName = user?.displayName || user?.email?.split('@')[0] || 'User';
  const initials = userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  const handleNav = (page: Page) => {
    onNavigate(page);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar - desktop */}
      <aside className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-72 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <FileSearch className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold font-display text-slate-900">DocuMind</h1>
              <p className="text-xs text-slate-400">Document Intelligence</p>
            </div>
          </div>
        </div>

        <div className="p-4">
          <button
            onClick={onUpload}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all-smooth"
          >
            <Upload className="w-5 h-5" />
            Upload Document
          </button>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-1">
          {navItems.map((item) => {
            const active = currentPage === item.page;
            return (
              <button
                key={item.page}
                onClick={() => handleNav(item.page)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all-smooth relative group ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-blue-600" />}
                <item.icon className={`w-5 h-5 ${item.page === 'notifications' && unreadNotifications > 0 ? 'text-rose-600' : active ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                <span>{item.label}</span>
                {item.page === 'notifications' && unreadNotifications > 0 && (
                  <span className="ml-auto bg-rose-600 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center shadow-sm shadow-rose-200">
                    {unreadNotifications}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 p-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{userName}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
            <button
              onClick={signOut}
              className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all-smooth"
              title="Sign out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 glass border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
              <FileSearch className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold font-display text-slate-900">DocuMind</span>
          </div>
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
          >
            <Menu className="w-6 h-6" />
          </button>
        </header>

        {sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden fixed top-3 right-3 z-50 p-2 rounded-lg bg-white shadow-lg"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        )}

        <main className="flex-1 overflow-y-auto scrollbar-thin">
          {children}
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-slate-900">{title}</h1>
        {subtitle && <p className="text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function SparkleBadge() {
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-xs font-medium text-blue-600">
      <Sparkles className="w-3.5 h-3.5" />
      AI Powered
    </div>
  );
}
