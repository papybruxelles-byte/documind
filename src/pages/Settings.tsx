import { useAuth } from '@/context/AuthContext';
import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, firebaseApp } from '@/lib/firebase';
import { useDocuments, useTags } from '@/hooks/useData';
import { PageHeader } from '@/components/AppShell';
import { User, Mail, Calendar, FileText, Tag, Sparkles, Cpu, Shield, Zap } from 'lucide-react';

export function Settings() {
  const { user } = useAuth();
  const { documents } = useDocuments();
  const { tags } = useTags();
  const [role, setRole] = useState('individual');
  const [employee, setEmployee] = useState({ name: '', email: '', password: '' });
  const [employeeMessage, setEmployeeMessage] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyCode, setCompanyCode] = useState('');
  const [employees, setEmployees] = useState<{ uid: string; name: string; email: string; role: string; status?: string }[]>([]);
  const loadEmployees = async (id: string) => {
    const snapshot = await getDocs(query(collection(db, 'profiles'), where('company_id', '==', id)));
    setEmployees(snapshot.docs.map((item) => item.data() as { uid: string; name: string; email: string; role: string; status?: string }));
  };
  useEffect(() => { if (user) void getDoc(doc(db, 'profiles', user.uid)).then(async (snapshot) => { const profile = snapshot.data(); setRole(profile?.role || 'individual'); setCompanyId(profile?.company_id || null); if (profile?.company_id) { void loadEmployees(profile.company_id); const company = await getDoc(doc(db, 'companies', profile.company_id)); setCompanyCode(company.data()?.join_code || ''); } }); }, [user]);
  const approveEmployee = async (uid: string) => { await (await import('firebase/firestore')).updateDoc(doc(db, 'profiles', uid), { status: 'approved' }); if (companyId) await loadEmployees(companyId); };
  const createEmployee = async () => {
    try {
      const result = await httpsCallable(getFunctions(firebaseApp), 'createEmployee')(employee);
      setEmployee({ name: '', email: '', password: '' }); setEmployeeMessage(`Employee account created: ${(result.data as { email: string }).email}`); if (companyId) await loadEmployees(companyId);
    } catch (error) { setEmployeeMessage(error instanceof Error ? error.message : 'Unable to create employee. Deploy the Firebase Function first.'); }
  };

  const userName = user?.displayName || 'User';
  const initials = userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const memberSince = user?.metadata.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Unknown';

  const aiProviders = [
    { name: 'OpenAI GPT', desc: 'Primary document analysis and chat engine', active: true, icon: Zap },
    { name: 'Local NLP Engine', desc: 'Automatic free fallback when OpenAI is unavailable', active: false, icon: Cpu },
    { name: 'Anthropic Claude', desc: 'Excellent for long documents and reasoning', active: false, icon: Sparkles },
    { name: 'Google Gemini', desc: 'Multimodal document analysis', active: false, icon: Sparkles },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto animate-fade-in">
      <PageHeader title="Settings" subtitle="Manage your account and preferences" />

      {/* Profile */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
        <h2 className="font-semibold font-display text-slate-900 mb-4">Profile</h2>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white font-bold text-xl">
            {initials}
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-900">{userName}</p>
            <p className="text-sm text-slate-500">{user?.email}</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <InfoCard icon={User} label="Name" value={userName} />
          <InfoCard icon={Mail} label="Email" value={user?.email || 'N/A'} />
          <InfoCard icon={Calendar} label="Member since" value={memberSince} />
        </div>
      </div>

      {/* Account stats */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <StatBox icon={FileText} label="Documents" value={documents.length} color="from-blue-500 to-cyan-500" />
        <StatBox icon={Tag} label="Tags" value={tags.length} color="from-emerald-500 to-teal-500" />
        <StatBox icon={Sparkles} label="AI Analyses" value={documents.filter((d) => d.ai_status === 'completed').length} color="from-violet-500 to-purple-500" />
      </div>

      {role === 'enterprise_admin' ? <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6"><h2 className="font-semibold font-display text-slate-900 mb-1">Company access</h2><p className="text-sm text-slate-500 mb-4">Give this company credential to employees so they can register and wait for approval.</p><p className="font-mono font-bold text-lg text-blue-700 bg-blue-50 rounded-xl px-4 py-3 inline-block">{companyCode || 'Loading...'}</p><div className="mt-6 pt-5 border-t border-slate-100"><h3 className="font-semibold text-slate-900 mb-3">Company users ({employees.length})</h3>{employees.map((member) => <div key={member.uid} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0"><div><p className="text-sm font-medium text-slate-800">{member.name}</p><p className="text-xs text-slate-500">{member.email}</p></div><div className="flex gap-2 items-center">{member.status === 'pending' && <button onClick={() => approveEmployee(member.uid)} className="text-xs px-2 py-1 rounded bg-emerald-600 text-white">Approve</button>}<span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">{member.status || 'approved'}</span></div></div>)}</div></div> : <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6"><h2 className="font-semibold text-amber-900">Individual account</h2><p className="text-sm text-amber-800 mt-1">Sharing documents, creating groups, and employee management require an Enterprise account. Upgrade to share documents with your team.</p></div>}

      {/* AI Providers */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
        <h2 className="font-semibold font-display text-slate-900 mb-1">AI Engine</h2>
        <p className="text-sm text-slate-500 mb-4">Choose the AI provider that processes your documents</p>

        <div className="space-y-3">
          {aiProviders.map((provider) => (
            <div
              key={provider.name}
              className={`flex items-center gap-4 p-4 rounded-xl border transition-all-smooth ${
                provider.active
                  ? 'border-blue-200 bg-blue-50/50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                provider.active ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'
              }`}>
                <provider.icon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-900">{provider.name}</p>
                  {provider.active && (
                    <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">Active</span>
                  )}
                </div>
                <p className="text-sm text-slate-500">{provider.desc}</p>
              </div>
              {!provider.active && (
                <span className="text-xs text-slate-400 px-3 py-1 rounded-lg bg-slate-50">Available</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Privacy */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <Shield className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="font-semibold font-display text-slate-900">Privacy & Security</h2>
            <p className="text-sm text-slate-500">Your documents are private and encrypted</p>
          </div>
        </div>
        <div className="space-y-2 text-sm text-slate-600">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-50">
            <CheckIcon /> Documents are stored in your private encrypted storage
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-50">
            <CheckIcon /> Only you can access your documents and data
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-50">
            <CheckIcon /> Row-level security enforced at the database level
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="w-4 h-4 text-slate-400" />
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      <p className="text-sm font-semibold text-slate-900 truncate">{value}</p>
    </div>
  );
}

function StatBox({ icon: Icon, label, value, color }: { icon: typeof FileText; label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <p className="text-2xl font-bold font-display text-slate-900">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

function CheckIcon() {
  return (
    <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
      <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </div>
  );
}
