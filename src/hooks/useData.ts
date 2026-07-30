import { useEffect, useState, useCallback } from 'react';
import { collection, deleteDoc, doc, getDocs, orderBy, query, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import type { DocumentWithRelations, Notification, Tag } from '@/types/database';

export function useDocuments() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DocumentWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchDocuments = useCallback(async () => {
    if (!user) { setDocuments([]); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const ownDocuments = await getDocs(query(collection(db, 'users', user.uid, 'documents'), orderBy('created_at', 'desc')));
      setDocuments(ownDocuments.docs.map((item) => ({ id: item.id, ...item.data() }) as DocumentWithRelations));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load documents';
      setError(message.includes('index') ? 'The shared-document index is being created in Firebase. Refresh once it is ready.' : message);
    }
    setLoading(false);
  }, [user]);
  useEffect(() => { void fetchDocuments(); }, [fetchDocuments]);
  return { documents, loading, error, refetch: fetchDocuments };
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchNotifications = useCallback(async () => {
    if (!user) { setNotifications([]); setLoading(false); return; }
    setLoading(true);
    const snapshot = await getDocs(query(collection(db, 'users', user.uid, 'notifications'), orderBy('created_at', 'desc')));
    setNotifications(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Notification));
    setLoading(false);
  }, [user]);
  useEffect(() => { void fetchNotifications(); }, [fetchNotifications]);
  const markAsRead = useCallback(async (id: string) => { if (user) { await updateDoc(doc(db, 'users', user.uid, 'notifications', id), { read: true }); await fetchNotifications(); } }, [user, fetchNotifications]);
  const markAllAsRead = useCallback(async () => { if (user) { await Promise.all(notifications.filter((n) => !n.read).map((n) => updateDoc(doc(db, 'users', user.uid, 'notifications', n.id), { read: true }))); await fetchNotifications(); } }, [user, notifications, fetchNotifications]);
  const remove = useCallback(async (id: string) => { if (user) { await deleteDoc(doc(db, 'users', user.uid, 'notifications', id)); await fetchNotifications(); } }, [user, fetchNotifications]);
  return { notifications, loading, unreadCount: notifications.filter((n) => !n.read).length, refetch: fetchNotifications, markAsRead, markAllAsRead, remove };
}

export function useTags() {
  const { documents } = useDocuments();
  const tags = new Map<string, Tag>();
  documents.forEach((document) => document.document_tags?.forEach(({ tags: tag }) => tags.set(tag.id, tag)));
  return { tags: [...tags.values()].sort((a, b) => a.name.localeCompare(b.name)), refetch: async () => undefined };
}
