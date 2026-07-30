import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { FileSearch, Mail, Lock, User as UserIcon, Loader2, ArrowRight, Shield, Sparkles, Zap } from 'lucide-react';

export function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'enterprise_admin' | 'individual' | 'company_member'>('enterprise_admin');
  const [companyCode, setCompanyCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = mode === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password, name, role, companyCode);

    if (result.error) {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - branding */}
      <div className="hidden lg:flex lg:w-1/2 relative gradient-mesh bg-slate-900 items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900" />
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />

        <div className="relative z-10 max-w-md px-12 text-white">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <FileSearch className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-display">DocuMind</h1>
              <p className="text-sm text-blue-200/70">Document Intelligence</p>
            </div>
          </div>

          <h2 className="text-4xl font-bold font-display leading-tight mb-4">
            Turn your documents into<br />
            <span className="gradient-text">actionable knowledge</span>
          </h2>
          <p className="text-blue-200/80 text-lg leading-relaxed mb-10">
            Upload any document and let AI instantly extract text, summarize content,
            classify categories, and surface important details.
          </p>

          <div className="space-y-4">
            {[
              { icon: Sparkles, title: 'AI-Powered Summaries', desc: 'Get instant summaries of any document' },
              { icon: Shield, title: 'Private & Secure', desc: 'Your documents are encrypted and private' },
              { icon: Zap, title: 'Smart Search', desc: 'Find documents by meaning, not just keywords' },
            ].map((feature, i) => (
              <div
                key={feature.title}
                className="flex items-start gap-4 animate-fade-in-up"
                style={{ animationDelay: `${i * 0.15}s`, opacity: 0 }}
              >
                <div className="w-10 h-10 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center flex-shrink-0 border border-white/10">
                  <feature.icon className="w-5 h-5 text-cyan-300" />
                </div>
                <div>
                  <p className="font-semibold text-white">{feature.title}</p>
                  <p className="text-sm text-blue-200/60">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right side - form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-white">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <FileSearch className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-display text-slate-900">DocuMind</h1>
              <p className="text-xs text-slate-500">Document Intelligence</p>
            </div>
          </div>

          <h2 className="text-3xl font-bold font-display text-slate-900 mb-2">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="text-slate-500 mb-8">
            {mode === 'signin'
              ? 'Sign in to access your document library'
              : 'Start organizing your documents with AI'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Full name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Jane Doe"
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all-smooth"
                  />
                </div>
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Account type</label>
                <div className="grid sm:grid-cols-3 gap-2">
                  <button type="button" onClick={() => setRole('enterprise_admin')} className={`p-3 rounded-xl border text-left ${role === 'enterprise_admin' ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-600'}`}><span className="block font-semibold text-sm">Enterprise account</span><span className="text-xs">Create employees and share documents</span></button>
                  <button type="button" onClick={() => setRole('individual')} className={`p-3 rounded-xl border text-left ${role === 'individual' ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-600'}`}><span className="block font-semibold text-sm">Individual account</span><span className="text-xs">Private documents only</span></button>
                  <button type="button" onClick={() => setRole('company_member')} className={`p-3 rounded-xl border text-left ${role === 'company_member' ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-600'}`}><span className="block font-semibold text-sm">Company member</span><span className="text-xs">Join with company credential</span></button>
                </div>
              </div>
            )}

            {mode === 'signup' && role === 'company_member' && <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Company credential</label><input value={companyCode} onChange={(event) => setCompanyCode(event.target.value.toUpperCase())} required placeholder="e.g. A1B2C3D4E5" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900" /></div>}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all-smooth"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all-smooth"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 animate-fade-in">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all-smooth disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {mode === 'signin' ? 'Sign in' : 'Create account'}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setError(null);
              }}
              className="font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
