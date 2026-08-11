import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { FileSearch, Mail, Lock, User as UserIcon, Loader2, ArrowRight, Sparkles } from 'lucide-react';

const HERO_VALUES = [
  {
    icon: '📱',
    title: 'Une capture. Plusieurs possibilités.',
    desc: 'Importez, numérisez ou photographiez un document. Signataire Intelligent le transforme en informations structurées et exploitables.'
  },
  {
    icon: '📄',
    title: 'Lire et résumer',
    desc: 'Traitez les PDF, documents Word, images et scans. Obtenez un résumé IA en quelques secondes, même sur des centaines de pages.'
  },
  {
    icon: '🗂️',
    title: 'Organiser et archiver',
    desc: 'Classez et archivez automatiquement les documents par service, client, projet ou type.'
  },
  {
    icon: '📝',
    title: 'Collaborer en temps réel',
    desc: 'Partagez notes, annotations et analyses IA avec votre équipe.'
  },
  {
    icon: '⏰',
    title: 'Suivre les échéances',
    desc: 'Ne manquez plus aucun paiement, renouvellement, suivi ou délai important.'
  },
  {
    icon: '🔍',
    title: 'Tout retrouver instantanément',
    desc: 'Recherchez vos documents avec l’IA et retrouvez une information en quelques secondes.'
  },
  {
    icon: '🎧',
    title: 'Écouter plutôt que lire',
    desc: 'Écoutez le document complet ou son résumé IA en français ou en anglais.'
  },
  {
    icon: '🤖',
    title: 'Double moteur IA',
    desc: 'Propulsé par OpenAI avec un relais automatique vers l’IA locale pour plus de fiabilité et de confidentialité.'
  }
];

export function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'enterprise_admin' | 'individual' | 'company_member'>('enterprise_admin');
  const [companyCode, setCompanyCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cardScrollDirection, setCardScrollDirection] = useState<'up' | 'down'>('up');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = mode === 'signin'
        ? await signIn(email, password)
        : await signUp(email, password, name, role, companyCode);

      if (result.error) {
        setError(result.error);
      }
    } catch {
      setError(mode === 'signin'
        ? 'Connexion impossible. Veuillez réessayer.'
        : 'Création du compte impossible. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden lg:min-h-screen lg:flex-row">
      {/* Left side - branding */}
      <div className={`relative flex min-h-0 w-full flex-none items-start justify-center overflow-x-hidden overflow-y-auto bg-slate-900 gradient-mesh lg:h-[99vh] lg:items-center lg:overflow-hidden ${mode === 'signup' ? 'h-[40vh] lg:w-[40vw]' : 'h-[50vh] lg:w-[70vw]'}`}>
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900" />
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />

        <div className={`relative z-10 grid w-full grid-cols-1 gap-8 px-6 py-6 text-white sm:px-8 xl:gap-12 xl:px-12 ${mode === 'signin' ? 'md:grid-cols-2' : ''}`}>
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-2.5 mb-8">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <FileSearch className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold font-display">Signataire Intelligent</h1>
                <p className="text-xs text-blue-200/70">Intelligence documentaire</p>
              </div>
            </div>

            <h2 className="text-3xl xl:text-4xl font-bold font-display leading-tight mb-3">
              Une action.<br />
              <span className="gradient-text">Plusieurs possibilités.</span>
            </h2>
            <p className="text-base font-semibold text-white mb-1">Numérisez. Importez. Photographiez.</p>
            <p className="text-blue-200/80 text-sm">Signataire Intelligent fait le reste.</p>
            <p className="mt-8 text-xs font-medium text-blue-100/90">
              Passez moins de temps à chercher et à lire. Consacrez-en davantage à décider et agir.
            </p>
          </div>

          {mode === 'signin' && <div className="flex flex-col justify-center border-t border-white/10 pt-8 md:border-l md:border-t-0 md:pl-8 md:pt-0 xl:pl-12">
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-cyan-300/30 bg-gradient-to-r from-cyan-400/15 via-blue-400/10 to-transparent px-4 py-3 shadow-lg shadow-cyan-950/20">
              <div className="ai-sparkle relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-300/15 text-cyan-200 shadow-md shadow-cyan-400/20">
                <span className="absolute inset-0 rounded-full border border-cyan-300/30" />
                <Sparkles className="relative h-5 w-5" aria-hidden="true" />
                <span className="sr-only">Propulsé par l’IA</span>
              </div>
              <p className="text-sm font-bold leading-snug tracking-wide text-cyan-100">
                Vos documents sont automatiquement transformés en
                <span className="block bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text text-base text-transparent">
                  informations exploitables
                </span>
              </p>
            </div>
            <div
              className="feature-card-viewport h-[50vh] overflow-hidden"
              onMouseMove={(event) => {
                const bounds = event.currentTarget.getBoundingClientRect();
                const direction = event.clientY < bounds.top + bounds.height / 2 ? 'down' : 'up';
                setCardScrollDirection((current) => current === direction ? current : direction);
              }}
              onMouseLeave={() => setCardScrollDirection('up')}
            >
              <div className={`feature-card-track ${cardScrollDirection === 'down' ? 'feature-card-track-down' : ''}`}>
                {[0, 1].map((group) => (
                  <div key={group} className="grid gap-2 pb-2" aria-hidden={group === 1}>
                    {HERO_VALUES.map((value) => (
                      <div
                        key={`${group}-${value.title}`}
                        className="rounded-lg border border-white/10 bg-white/[0.07] px-3 py-2 text-blue-50 backdrop-blur-sm transition-all-smooth hover:border-cyan-300/40 hover:bg-white/[0.12]"
                      >
                        <p className="text-xs font-semibold leading-tight text-white">
                          <span className="mr-1.5">{value.icon}</span>{value.title}
                        </p>
                        <p className="mt-1 text-[10px] leading-snug text-blue-200/65">{value.desc}</p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>}
        </div>
      </div>

      {/* Right side - form */}
      <div className={`flex min-h-0 w-full flex-none items-start justify-center overflow-y-auto bg-white p-6 sm:p-12 lg:items-center ${mode === 'signup' ? 'h-[60vh] lg:h-screen lg:w-[60vw]' : 'h-[50vh] lg:h-auto lg:flex-1 lg:overflow-visible'}`}>
        <div className={`w-full ${mode === 'signup' ? 'max-w-2xl lg:h-[60vh] lg:overflow-y-auto lg:px-3 lg:py-2' : 'max-w-md'}`}>
          <h2 className={`font-bold font-display text-slate-900 mb-2 ${mode === 'signup' ? 'text-2xl' : 'text-3xl'}`}>
            {mode === 'signin' ? 'Heureux de vous revoir' : 'Créer votre compte'}
          </h2>
          <p className={`text-slate-500 ${mode === 'signup' ? 'mb-4' : 'mb-8'}`}>
            {mode === 'signin'
              ? 'Connectez-vous pour accéder à vos documents'
              : 'Commencez à organiser vos documents avec l’IA'}
          </p>

          <form onSubmit={handleSubmit} className={mode === 'signup' ? 'space-y-3' : 'space-y-5'}>
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nom complet</label>
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
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Type de compte</label>
                <div className="grid sm:grid-cols-3 gap-2">
                  <button type="button" onClick={() => setRole('enterprise_admin')} className={`p-3 rounded-xl border text-left ${role === 'enterprise_admin' ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-600'}`}><span className="block font-semibold text-sm">Compte entreprise</span><span className="text-xs">Créer des employés et partager des documents</span></button>
                  <button type="button" onClick={() => setRole('individual')} className={`p-3 rounded-xl border text-left ${role === 'individual' ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-600'}`}><span className="block font-semibold text-sm">Compte individuel</span><span className="text-xs">Documents privés uniquement</span></button>
                  <button type="button" onClick={() => setRole('company_member')} className={`p-3 rounded-xl border text-left ${role === 'company_member' ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-600'}`}><span className="block font-semibold text-sm">Membre d’entreprise</span><span className="text-xs">Rejoindre avec un code d’entreprise</span></button>
                </div>
              </div>
            )}

            {mode === 'signup' && role === 'company_member' && <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Code d’entreprise</label><input value={companyCode} onChange={(event) => setCompanyCode(event.target.value.toUpperCase())} required placeholder="ex. A1B2C3D4E5" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900" /></div>}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Adresse e-mail</label>
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
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Mot de passe</label>
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
                  {mode === 'signin' ? 'Se connecter' : 'Créer un compte'}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <p className={`text-center text-sm text-slate-500 ${mode === 'signup' ? 'mt-3' : 'mt-6'}`}>
            {mode === 'signin' ? 'Vous n’avez pas de compte ? ' : 'Vous avez déjà un compte ? '}
            <button
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setError(null);
              }}
              className="font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              {mode === 'signin' ? 'S’inscrire' : 'Se connecter'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
