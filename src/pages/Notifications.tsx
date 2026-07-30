import { useNotifications } from '@/hooks/useData';
import { PageHeader } from '@/components/AppShell';
import { getCategoryIcon } from '@/lib/category-utils';
import { Bell, Clock, AlertTriangle, CheckCircle2, Check, Trash2, Loader2 } from 'lucide-react';

interface NotificationsProps {
  onOpenDocument: (id: string) => void;
}

export function Notifications({ onOpenDocument }: NotificationsProps) {
  const { notifications, loading, unreadCount, markAsRead, markAllAsRead, remove } = useNotifications();
  const handleRead = async (id: string, documentId: string | null) => {
    if (documentId) sessionStorage.setItem('documind-last-shared-alert', documentId);
    await markAsRead(id);
  };

  const handleDelete = async (id: string) => {
    await remove(id);
  };

  const getIcon = (severity: string) => {
    if (severity === 'danger') return AlertTriangle;
    if (severity === 'warning') return Clock;
    return Bell;
  };

  const getColor = (severity: string) => {
    if (severity === 'danger') return { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-600', iconBg: 'bg-rose-100' };
    if (severity === 'warning') return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', iconBg: 'bg-amber-100' };
    return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', iconBg: 'bg-blue-100' };
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <PageHeader
          title="Notifications"
          subtitle={`${unreadCount} unread alert${unreadCount !== 1 ? 's' : ''}`}
        />
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all-smooth"
          >
            <Check className="w-4 h-4" />
            Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-20">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-300 mb-3" />
          <p className="text-slate-400">Loading notifications...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
            <Bell className="w-8 h-8 text-slate-300" />
          </div>
          <p className="text-slate-500 font-medium">No notifications</p>
          <p className="text-sm text-slate-400 mt-1">You're all caught up! Alerts about expiring documents will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notif, i) => {
            const Icon = getIcon(notif.severity);
            const colors = notif.read
              ? { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-500', iconBg: 'bg-slate-100' }
              : getColor(notif.severity);
            return (
              <div
                key={notif.id}
                onClick={() => !notif.read && handleRead(notif.id, notif.document_id)}
                className={`rounded-2xl border ${colors.border} ${colors.bg} p-4 flex items-start gap-4 animate-fade-in-up transition-all-smooth hover:shadow-md ${
                  !notif.read ? 'ring-2 ring-offset-2 ring-blue-200 cursor-pointer' : ''
                }`}
                style={{ animationDelay: `${i * 0.05}s`, opacity: 0 }}
              >
                <div className={`w-10 h-10 rounded-xl ${colors.iconBg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-5 h-5 ${colors.text}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{notif.title}</p>
                      <p className="text-sm text-slate-600 mt-0.5">{notif.message}</p>
                    </div>
                    {!notif.read && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-3">
                    <span className="text-xs text-slate-400">
                      {new Date(notif.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    {notif.due_date && (
                      <span className={`text-xs font-medium ${colors.text} flex items-center gap-1`}>
                        <Clock className="w-3 h-3" />
                        Due: {new Date(notif.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                    {notif.document_id && (
                      <button
                        onClick={() => onOpenDocument(notif.document_id!)}
                        className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        View document
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {!notif.read && (
                    <button
                      onClick={() => handleRead(notif.id, notif.document_id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-white/60 transition-all-smooth"
                      title="Mark as read"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(notif.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-white/60 transition-all-smooth"
                    title="Dismiss"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
