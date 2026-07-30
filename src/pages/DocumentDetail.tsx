import { useState, useEffect, useRef } from 'react';
import { arrayUnion, collection, doc as firestoreDoc, getDoc, getDocs, query, setDoc as setFirestoreDoc, updateDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { firebaseApp } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { chatWithDocument, deleteDocument } from '@/lib/document-processor';
import { downloadCalendarEvent, draftResponse, inspectDocument, type ReplyTone } from '@/lib/document-actions';
import { getCategoryIcon, getCategoryColors } from '@/lib/category-utils';
import type { DocumentWithRelations, DocumentText, ChatMessage } from '@/types/database';
import {
  ArrowLeft, FileText, Sparkles, Tag as TagIcon, Calendar, Building2, DollarSign,
  Clock, Send, Loader2, Trash2, MessageSquare, FileSearch, Hash, AlertTriangle,
  CheckCircle2, Download, CalendarPlus, ReceiptText, Volume2, Share2,
} from 'lucide-react';

interface DocumentDetailProps {
  documentId: string;
  onBack: () => void;
}

export function DocumentDetail({ documentId, onBack }: DocumentDetailProps) {
  const { user } = useAuth();
  const [doc, setDoc] = useState<DocumentWithRelations | null>(null);
  const [docText, setDocText] = useState<DocumentText | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'chat' | 'text'>('overview');
  const [replyTone, setReplyTone] = useState<ReplyTone>('official');
  const [draft, setDraft] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [companyUsers, setCompanyUsers] = useState<{ uid: string; name: string; email: string }[]>([]);
  const [selectedShareUids, setSelectedShareUids] = useState<string[]>([]);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const [isReading, setIsReading] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderDate, setReminderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [scheduleType, setScheduleType] = useState<'reminder' | 'meeting' | 'payment'>('reminder');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      if (!user) return;
      const item = await getDoc(firestoreDoc(db, 'users', user.uid, 'documents', documentId));
      const data = item.data() as Record<string, unknown> | undefined;
      if (data && item.exists()) {
        setDoc({ id: item.id, ...data } as DocumentWithRelations);
        setDocText({ id: item.id, document_id: item.id, full_text: data.full_text || '', word_count: data.word_count || 0, created_at: data.created_at } as DocumentText);
        setChatMessages((data.chat_messages || []) as ChatMessage[]);
      }

      setLoading(false);
    }

    fetchData();
  }, [documentId, user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleChat = async () => {
    if (!chatInput.trim() || !doc || !docText || !user) return;

    const question = chatInput.trim();
    const temporaryId = `temp-${crypto.randomUUID()}`;
    setChatInput('');
    setChatLoading(true);
    setChatError(null);

    setChatMessages((prev) => [...prev, {
      id: temporaryId,
      document_id: documentId,
      user_id: user.uid,
      question,
      answer: null,
      created_at: new Date().toISOString(),
    }]);

    try {
      const answer = await chatWithDocument(documentId, question, docText.full_text, doc.summary || 'No summary available');
      setChatMessages((prev) => prev.map((message) => message.id === temporaryId ? { ...message, answer } : message));
    } catch (error) {
      setChatMessages((prev) => prev.filter((message) => message.id !== temporaryId));
      setChatError(error instanceof Error ? error.message : 'Unable to get an answer. Please try again.');
    } finally {
      setChatLoading(false);
    }
  };

  const handleDelete = async () => {
    const { error } = await deleteDocument(documentId);
    if (!error) onBack();
  };

  const handleDownload = async () => {
    if (!doc?.document_files?.[0]) return;
    const url = await getDownloadURL(ref(storage, doc.document_files[0].file_path));
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="text-center py-20">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-300 mb-3" />
          <p className="text-slate-400">Loading document...</p>
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="p-8 max-w-5xl mx-auto text-center py-20">
        <p className="text-slate-500">Document not found</p>
        <button onClick={onBack} className="mt-4 text-blue-600 font-medium">Go back</button>
      </div>
    );
  }

  const Icon = getCategoryIcon(doc.category);
  const colors = getCategoryColors(doc.category);
  const meta = doc.document_metadata;
  const isProcessing = doc.ai_status === 'processing' || doc.ocr_status === 'processing';

  const suggestedQuestions = [
    'Summarize this document',
    'What are the important dates?',
    'Who is the issuer?',
    'What is the total amount?',
  ];
  const insight = inspectDocument(docText?.full_text || '');
  const openSchedule = (type: 'reminder' | 'meeting' | 'payment') => {
    const parsed = insight.deadline ? new Date(insight.deadline) : null;
    setReminderDate(parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
    setScheduleType(type);
    setReminderOpen(true);
  };
  const createSchedule = async () => {
    if (!user) return;
    const action = { id: crypto.randomUUID(), type: scheduleType, date: reminderDate, created_at: new Date().toISOString() };
    await updateDoc(firestoreDoc(db, 'users', user.uid, 'documents', documentId), { scheduled_actions: arrayUnion(action) });
    setDoc((current) => current ? { ...current, scheduled_actions: [...(current.scheduled_actions || []), action] } : current);
    downloadCalendarEvent(doc.title, reminderDate, scheduleType);
    setReminderOpen(false);
  };
  const readAloud = () => {
    if (isReading) {
      window.speechSynthesis.cancel();
      setIsReading(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(docText?.full_text || doc.summary || 'No readable content is available.');
    utterance.lang = doc.language === 'fr' ? 'fr-FR' : 'en-US';
    utterance.onend = () => setIsReading(false);
    utterance.onerror = () => setIsReading(false);
    setIsReading(true);
    window.speechSynthesis.speak(utterance);
  };
  const openShare = async () => {
    if (!user) return;
    try {
      const profile = await getDoc(firestoreDoc(db, 'profiles', user.uid));
      const companyId = profile.data()?.company_id;
      if (!companyId) { setShareMessage('Upgrade to an Enterprise account to share documents.'); return; }
      const members = await getDocs(query(collection(db, 'profiles'), where('company_id', '==', companyId)));
      const approved = members.docs.map((item) => item.data()).filter((member) => member.status === 'approved' && member.uid !== user.uid) as { uid: string; name: string; email: string }[];
      setCompanyUsers(approved); setSelectedShareUids([]); setShareOpen(true); setShareMessage(null);
    } catch (error) { setShareMessage(error instanceof Error ? error.message : 'Unable to load company users.'); }
  };
  const shareWithSelectedUsers = async () => {
    if (!user || selectedShareUids.length === 0) return;
    try {
      const source = await getDoc(firestoreDoc(db, 'users', user.uid, 'documents', documentId));
      if (!source.exists()) throw new Error('Document not found.');
      const sharedDocument = { ...source.data(), id: documentId, user_id: user.uid, shared_from: user.uid, shared_at: new Date().toISOString(), access_uids: [user.uid, ...selectedShareUids] };
      await updateDoc(source.ref, { access_uids: arrayUnion(...selectedShareUids) });
      await Promise.all(selectedShareUids.map((uid) => setFirestoreDoc(firestoreDoc(db, 'users', uid, 'documents', documentId), sharedDocument)));
      await Promise.all(selectedShareUids.map((uid) => setFirestoreDoc(firestoreDoc(db, 'users', uid, 'notifications', crypto.randomUUID()), { user_id: uid, document_id: documentId, type: 'shared_document', title: 'New document shared', message: `A document was shared with you: ${source.data().title}`, severity: 'danger', read: false, due_date: null, created_at: new Date().toISOString() })));
      try {
        const { getDatabase, ref, set } = await import('firebase/database');
        const realtimeDb = getDatabase(firebaseApp);
        await Promise.all(selectedShareUids.map((uid) => set(ref(realtimeDb, `sharedAlerts/${uid}/${documentId}`), { title: source.data().title, shared_at: Date.now() })));
      } catch {
        // The Firestore copy is already available; dashboard also has a Firestore alert fallback.
      }
      setShareMessage(`Document shared with ${selectedShareUids.length} user${selectedShareUids.length === 1 ? '' : 's'}.`); setShareOpen(false);
    }
    catch (error) { setShareMessage(error instanceof Error ? error.message : 'Unable to share document.'); }
  };
  const updateStatus = async (status: 'pending' | 'in_progress' | 'closed') => {
    if (!user) return;
    await updateDoc(firestoreDoc(db, 'users', user.uid, 'documents', documentId), { status }); setDoc((current) => current ? { ...current, status } : current);
  };
  const addNote = async () => {
    if (!noteInput.trim() || !user) return;
    const note = { id: crypto.randomUUID(), user_id: user.uid, author: user.displayName || user.email || 'User', text: noteInput.trim(), created_at: new Date().toISOString() };
    await updateDoc(firestoreDoc(db, 'users', user.uid, 'documents', documentId), { notes: arrayUnion(note) });
    if (doc.user_id !== user.uid) await setFirestoreDoc(firestoreDoc(db, 'users', doc.user_id, 'notifications', crypto.randomUUID()), { user_id: doc.user_id, document_id: documentId, type: 'shared_note', title: 'New note on shared document', message: `${note.author} added a note to ${doc.title}`, severity: 'danger', read: false, due_date: null, created_at: new Date().toISOString() });
    setDoc((current) => current ? { ...current, notes: [...(current.notes || []), note] } : current); setNoteInput('');
  };

  const timeline = [
    { label: 'Document uploaded', date: doc.created_at, icon: FileText, done: true },
    { label: 'OCR text extraction', date: doc.ocr_status === 'completed' ? doc.created_at : null, icon: FileSearch, done: doc.ocr_status === 'completed' },
    { label: 'AI analysis complete', date: doc.ai_status === 'completed' ? doc.updated_at : null, icon: Sparkles, done: doc.ai_status === 'completed' },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all-smooth"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold font-display text-slate-900 truncate">{doc.title}</h1>
          <p className="text-sm text-slate-400">{doc.category}</p>
        </div>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="p-2.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-all-smooth"
          title="Delete"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {/* Status banner */}
      {isProcessing && (
        <div className="mb-6 rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-center gap-3 animate-fade-in">
          <Loader2 className="w-5 h-5 text-amber-600 animate-spin" />
          <div>
            <p className="text-sm font-medium text-amber-900">AI is processing this document</p>
            <p className="text-xs text-amber-700">Extracting text, analyzing content, and generating insights...</p>
          </div>
        </div>
      )}

      {/* Document card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-6">
        <div className={`h-32 bg-gradient-to-br ${colors.gradient} relative flex items-center justify-center`}>
          <Icon className="w-16 h-16 text-white/90" />
          <div className="absolute top-4 right-4 flex gap-2">
            <span className={`text-xs font-medium px-3 py-1 rounded-full ${colors.bg} ${colors.text}`}>
              {doc.category}
            </span>
            {doc.language && doc.language !== 'en' && (
              <span className="text-xs font-medium px-3 py-1 rounded-full bg-white/90 text-slate-700 uppercase">
                {doc.language}
              </span>
            )}
          </div>
        </div>

        <div className="p-6">
          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-slate-500">Added</span>
              <span className="font-medium text-slate-900">
                {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            {doc.document_files?.[0] && (
              <div className="flex items-center gap-2 text-sm">
                <FileText className="w-4 h-4 text-slate-400" />
                <span className="text-slate-500">Size</span>
                <span className="font-medium text-slate-900">
                  {(doc.document_files[0].size_bytes / 1024).toFixed(1)} KB
                </span>
              </div>
            )}
            {docText && (
              <div className="flex items-center gap-2 text-sm">
                <Hash className="w-4 h-4 text-slate-400" />
                <span className="text-slate-500">Words</span>
                <span className="font-medium text-slate-900">{docText.word_count}</span>
              </div>
            )}
          </div>

          {/* Tags */}
          {doc.document_tags && doc.document_tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <TagIcon className="w-4 h-4 text-slate-400" />
              {doc.document_tags.map((dt) => (
                <span
                  key={dt.tag_id}
                  className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700"
                >
                  {dt.tags.name}
                </span>
              ))}
            </div>
          )}

          {/* AI Summary */}
          {doc.summary && (
            <div className="rounded-xl bg-blue-50/50 border border-blue-100 p-5 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-semibold font-display text-slate-900">Document Summary</h3>
              </div>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm mb-4">
                <SummaryRow label="Document type" value={doc.category} />
                <SummaryRow label="Date" value={meta?.issue_date || new Date(doc.created_at).toLocaleDateString()} />
                <SummaryRow label="Pages" value={String(doc.document_files?.[0]?.pages || 1)} />
                <SummaryRow label="Language detected" value={doc.language === 'fr' ? 'French' : 'English'} />
                <SummaryRow label="Subject" value={doc.title} />
                <SummaryRow label="Sender" value={meta?.issuer || 'Not identified'} />
                <SummaryRow label="Deadline" value={meta?.expiration_date || insight.deadline || 'No deadline detected'} />
              </div>
              <div className="border-t border-blue-100 pt-3"><p className="text-xs font-semibold uppercase tracking-wide text-blue-700 mb-1">Summary</p><p className="text-slate-700 leading-relaxed"><span className="font-medium">This document contains:</span> {doc.summary}</p></div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-6">
            <button onClick={readAloud} className={`px-3 py-2 rounded-lg text-white text-sm font-medium flex items-center gap-1.5 ${isReading ? 'bg-rose-600' : 'bg-violet-600'}`}><Volume2 className="w-4 h-4" />{isReading ? 'Stop reading' : 'Read original document'}</button>
            {doc.document_files?.[0] && <button onClick={handleDownload} className="px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-sm font-medium text-blue-700 flex items-center gap-1.5"><Download className="w-4 h-4" />Download original document</button>}
            <button onClick={() => openSchedule('reminder')} className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm font-medium text-slate-700 flex items-center gap-1.5"><CalendarPlus className="w-4 h-4" />Add reminder</button>
            <button onClick={() => openSchedule('meeting')} className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm font-medium text-slate-700">Schedule meeting</button>
            <button onClick={() => openSchedule('payment')} className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm font-medium text-slate-700">Schedule payment</button>
          </div>

          <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-5 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center"><ReceiptText className="w-4 h-4 text-white" /></div>
              <h3 className="font-semibold font-display text-slate-900">Document Assistant</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 text-sm mb-4">
              <div className={`rounded-lg p-3 ${insight.requiresResponse ? 'bg-amber-50 text-amber-900' : 'bg-white text-slate-600'}`}>
                <span className="font-semibold">Response needed: </span>{insight.requiresResponse ? 'Likely yes' : 'Not detected'}
              </div>
              <div className={`rounded-lg p-3 ${insight.deadline ? 'bg-rose-50 text-rose-900' : 'bg-white text-slate-600'}`}>
                <span className="font-semibold">Deadline: </span>{insight.deadline || 'Not detected'}
              </div>
            </div>
            <p className="text-sm text-slate-700 mb-4"><span className="font-semibold">Recommendation: </span>{insight.recommendation}</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {(['official', 'friendly', 'amical'] as ReplyTone[]).map((tone) => (
                <button key={tone} onClick={() => { setReplyTone(tone); setDraft(draftResponse(tone, insight, doc.title)); }} className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${replyTone === tone ? 'bg-violet-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>{tone}</button>
              ))}
              <button onClick={() => setDraft(draftResponse(replyTone, insight, doc.title))} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-700">Propose answer</button>
            </div>
            {draft && <textarea value={draft} onChange={(event) => setDraft(event.target.value)} className="w-full min-h-28 rounded-lg border border-slate-200 p-3 text-sm text-slate-700 bg-white mb-3" aria-label="Proposed answer" />}
          </div>

          <div className="rounded-xl border border-slate-200 p-5 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4"><h3 className="font-semibold text-slate-900">Workflow status</h3><select value={doc.status || 'pending'} onChange={(event) => updateStatus(event.target.value as 'pending' | 'in_progress' | 'closed')} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="pending">Pending</option><option value="in_progress">In treatment</option><option value="closed">Closed</option></select></div>
            <h3 className="font-semibold text-slate-900 mb-3">Team notes</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto mb-3">{(doc.notes || []).length === 0 ? <p className="text-sm text-slate-400">No notes yet.</p> : doc.notes?.map((note) => <div key={note.id} className="rounded-lg bg-slate-50 p-3"><p className="text-sm text-slate-800">{note.text}</p><p className="text-xs text-slate-400 mt-1">{note.author} · {new Date(note.created_at).toLocaleString()}</p></div>)}</div>
            <div className="flex gap-2"><input value={noteInput} onChange={(event) => setNoteInput(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addNote()} placeholder="Add a shared note..." className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" /><button onClick={addNote} className="rounded-lg bg-slate-800 text-white px-3 py-2 text-sm">Add note</button></div>
          </div>

          {(doc.scheduled_actions || []).length > 0 && <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-5 mb-6"><h3 className="font-semibold text-slate-900 mb-3">Scheduled dates</h3><div className="space-y-2">{doc.scheduled_actions?.map((action) => <div key={action.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm"><span className="capitalize font-medium text-slate-700">{action.type}</span><span className="text-blue-700">{new Date(`${action.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span></div>)}</div></div>}

          {doc.user_id === user?.uid && <div className="rounded-xl border border-slate-200 p-4 mb-6"><div className="flex items-center justify-between gap-3"><div><div className="flex items-center gap-2"><Share2 className="w-4 h-4 text-blue-600" /><h3 className="font-semibold text-slate-900">Document sharing</h3></div><p className="text-sm text-slate-500 mt-1">Share this document, its details, and its notes with approved company users.</p></div><button onClick={openShare} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium">Share</button></div>{shareMessage && <p className="text-sm text-slate-500 mt-2">{shareMessage}</p>}</div>}

          {/* Keywords */}
          {doc.keywords && doc.keywords.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-slate-500 mb-2">Keywords</h3>
              <div className="flex flex-wrap gap-2">
                {doc.keywords.map((kw) => (
                  <span key={kw} className="text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white rounded-xl border border-slate-100 p-1 shadow-sm">
        {[
          { id: 'overview' as const, label: 'Overview', icon: FileText },
          { id: 'chat' as const, label: 'AI Chat', icon: MessageSquare },
          { id: 'text' as const, label: 'Extracted Text', icon: FileSearch },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium text-sm transition-all-smooth ${
              activeTab === tab.id
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="grid lg:grid-cols-2 gap-6 animate-fade-in">
          {/* Metadata */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h3 className="font-semibold font-display text-slate-900 mb-4">Important Fields</h3>

            {meta ? (
              <div className="space-y-3">
                {meta.issuer && (
                  <FieldRow icon={Building2} label="Issuer" value={meta.issuer} />
                )}
                {meta.issue_date && (
                  <FieldRow icon={Calendar} label="Issue Date" value={meta.issue_date} />
                )}
                {meta.expiration_date && (
                  <FieldRow icon={Clock} label="Expiration" value={meta.expiration_date} highlight />
                )}
                {meta.amount != null && (
                  <FieldRow icon={DollarSign} label="Amount" value={`${meta.currency} ${meta.amount.toLocaleString()}`} />
                )}
                {meta.confidence != null && (
                  <FieldRow icon={Sparkles} label="AI Confidence" value={`${Math.round(meta.confidence * 100)}%`} />
                )}

                {meta.fields && Object.keys(meta.fields).length > 0 && (
                  <div className="pt-3 mt-3 border-t border-slate-100">
                    {Object.entries(meta.fields).map(([key, value]) => (
                      <FieldRow key={key} label={key} value={value} />
                    ))}
                  </div>
                )}

                {(!meta.issuer && !meta.issue_date && !meta.expiration_date && meta.amount == null &&
                  (!meta.fields || Object.keys(meta.fields).length === 0)) && (
                  <p className="text-sm text-slate-400">No specific fields detected for this document type.</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-400">Metadata not yet available.</p>
            )}
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h3 className="font-semibold font-display text-slate-900 mb-4">Processing Timeline</h3>
            <div className="space-y-4">
              {timeline.map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    step.done ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {step.done ? <CheckCircle2 className="w-4 h-4" /> : <Loader2 className="w-4 h-4 animate-spin" />}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${step.done ? 'text-slate-900' : 'text-slate-400'}`}>
                      {step.label}
                    </p>
                    {step.date && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(step.date).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Expiration warning */}
            {meta?.expiration_date && (
              <ExpirationWarning expirationDate={meta.expiration_date} />
            )}
          </div>
        </div>
      )}

      {activeTab === 'chat' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col animate-fade-in" style={{ height: '600px' }}>
          <div className="flex items-center gap-2 p-4 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold font-display text-slate-900">AI Chat</h3>
              <p className="text-xs text-slate-400">Ask questions about this document</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
            {chatMessages.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 flex items-center justify-center mb-3">
                  <Sparkles className="w-7 h-7 text-blue-500" />
                </div>
                <p className="font-medium text-slate-700">Ask anything about this document</p>
                <p className="text-sm text-slate-400 mt-1 mb-4">Try one of these questions:</p>
                <div className="flex flex-wrap gap-2 justify-center max-w-md mx-auto">
                  {suggestedQuestions.map((q) => (
                    <button
                      key={q}
                      onClick={() => setChatInput(q)}
                      className="px-3 py-1.5 rounded-lg text-sm bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-all-smooth"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              chatMessages.map((msg) => (
                <div key={msg.id} className="space-y-3 animate-fade-in-up">
                  <div className="flex justify-end">
                    <div className="max-w-[80%] bg-blue-600 text-white rounded-2xl rounded-br-md px-4 py-2.5">
                      <p className="text-sm">{msg.question}</p>
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="max-w-[80%] bg-slate-100 text-slate-800 rounded-2xl rounded-bl-md px-4 py-2.5">
                      {msg.answer ? (
                        <p className="text-sm leading-relaxed">{msg.answer}</p>
                      ) : (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 border-t border-slate-100">
            {chatError && <p className="text-sm text-rose-600 mb-2">{chatError}</p>}
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !chatLoading && handleChat()}
                placeholder="Ask a question about this document..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all-smooth"
                disabled={chatLoading}
              />
              <button
                onClick={handleChat}
                disabled={!chatInput.trim() || chatLoading}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-medium hover:shadow-lg hover:shadow-blue-500/20 disabled:opacity-50 transition-all-smooth flex items-center gap-2"
              >
                {chatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'text' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold font-display text-slate-900">Extracted Text</h3>
            {docText && (
              <span className="text-xs text-slate-400">{docText.word_count} words</span>
            )}
          </div>
          {docText ? (
            <pre className="whitespace-pre-wrap text-sm text-slate-600 font-mono leading-relaxed max-h-96 overflow-y-auto scrollbar-thin p-4 bg-slate-50 rounded-xl">
              {docText.full_text}
            </pre>
          ) : (
            <p className="text-sm text-slate-400">No text was extracted from this document.</p>
          )}
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 animate-scale-in">
            <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-rose-600" />
            </div>
            <h3 className="text-lg font-bold font-display text-slate-900 mb-2">Delete this document?</h3>
            <p className="text-sm text-slate-500 mb-6">
              This will permanently remove the document, its extracted text, AI analysis, and all related data. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-all-smooth"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white font-medium hover:bg-rose-700 transition-all-smooth"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {reminderOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setReminderOpen(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 animate-scale-in">
            <div className="flex items-center gap-2 mb-1"><CalendarPlus className="w-5 h-5 text-blue-600" /><h3 className="text-lg font-bold text-slate-900">Schedule {scheduleType}</h3></div>
            <p className="text-sm text-slate-500 mb-5">Select the date for this {scheduleType}.</p>
            <div className="grid sm:grid-cols-2 gap-4 items-stretch">
              <div><label className="block text-sm font-medium text-slate-700 mb-2">{scheduleType.charAt(0).toUpperCase() + scheduleType.slice(1)} date</label><input type="date" value={reminderDate} onChange={(event) => setReminderDate(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-800" /></div>
              <div className="rounded-xl bg-blue-50 border border-blue-100 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-blue-600 mb-1">Selected date</p><p className="font-semibold text-slate-900">{new Date(`${reminderDate}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p><p className="text-sm text-slate-500 mt-2 truncate">{doc.title}</p></div>
            </div>
            <div className="flex gap-3 mt-6"><button onClick={() => setReminderOpen(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-medium">Cancel</button><button onClick={createSchedule} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-medium">Create calendar event</button></div>
          </div>
        </div>
      )}

      {shareOpen && <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"><div className="absolute inset-0 bg-slate-900/50" onClick={() => setShareOpen(false)} /><div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6"><h3 className="text-lg font-bold text-slate-900">Share document</h3><p className="text-sm text-slate-500 mt-1 mb-4">Select approved company users who can view this document and add notes.</p><div className="max-h-72 overflow-y-auto space-y-2">{companyUsers.length === 0 ? <p className="text-sm text-slate-400 py-4">No approved company users are available.</p> : companyUsers.map((member) => <label key={member.uid} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 cursor-pointer"><div><p className="text-sm font-medium text-slate-800">{member.name}</p><p className="text-xs text-slate-500">{member.email}</p></div><input type="checkbox" checked={selectedShareUids.includes(member.uid)} onChange={() => setSelectedShareUids((current) => current.includes(member.uid) ? current.filter((uid) => uid !== member.uid) : [...current, member.uid])} className="w-4 h-4 accent-blue-600" /></label>)}</div><div className="flex gap-3 mt-5"><button onClick={() => setShareOpen(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700">Cancel</button><button onClick={shareWithSelectedUsers} disabled={selectedShareUids.length === 0} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white disabled:opacity-50">Share with selected</button></div></div></div>}
    </div>
  );
}

function FieldRow({ icon: Icon, label, value, highlight }: { icon?: typeof Calendar; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-slate-400" />}
        <span className="text-sm text-slate-500">{label}</span>
      </div>
      <span className={`text-sm font-medium ${highlight ? 'text-rose-600' : 'text-slate-900'}`}>{value}</span>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex gap-2 min-w-0"><span className="text-slate-500 flex-shrink-0">{label}:</span><span className="font-medium text-slate-800 truncate">{value}</span></div>;
}

function ExpirationWarning({ expirationDate }: { expirationDate: string }) {
  const exp = new Date(expirationDate);
  const now = new Date();
  const daysUntil = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntil < 0) {
    return (
      <div className="mt-6 p-4 rounded-xl bg-rose-50 border border-rose-200">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-rose-600" />
          <p className="text-sm font-medium text-rose-900">This document expired {Math.abs(daysUntil)} days ago</p>
        </div>
      </div>
    );
  }

  if (daysUntil <= 90) {
    return (
      <div className={`mt-6 p-4 rounded-xl border ${daysUntil <= 30 ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}>
        <div className="flex items-center gap-2">
          <Clock className={`w-5 h-5 ${daysUntil <= 30 ? 'text-rose-600' : 'text-amber-600'}`} />
          <p className={`text-sm font-medium ${daysUntil <= 30 ? 'text-rose-900' : 'text-amber-900'}`}>
            Expires in {daysUntil} days ({expirationDate})
          </p>
        </div>
      </div>
    );
  }

  return null;
}
