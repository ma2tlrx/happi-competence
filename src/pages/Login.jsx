import { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import logo from '../assets/logo.png';

/* ── Spinner ────────────────────────────────────────────────────── */
function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

/* ── Left decorative panel ──────────────────────────────────────── */
function LeftPanel() {
  return (
    <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden">
      <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full opacity-10" style={{ background: '#FF8650' }} />
      <div className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full opacity-10" style={{ background: '#FF8650' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full opacity-5" style={{ background: '#FF8650' }} />

      <div className="flex items-center gap-3 relative z-10">
        <img src={logo} alt="Happi" className="w-12 h-12 rounded-2xl object-contain bg-white" />
        <div>
          <p className="font-bold text-white text-lg leading-tight" style={{ fontFamily: 'Poppins,sans-serif' }}>Happi Compétence</p>
          <p className="text-xs" style={{ color: '#8AABB0' }}>Plateforme formateur</p>
        </div>
      </div>

      <div className="relative z-10">
        <h2 className="text-4xl font-bold text-white mb-4 leading-tight" style={{ fontFamily: 'Poppins,sans-serif' }}>
          Développez<br />les compétences<br />
          <span style={{ color: '#FF8650' }}>de vos équipes.</span>
        </h2>
        <p className="text-base" style={{ color: '#8AABB0', fontFamily: 'DM Sans,sans-serif' }}>
          Gérez vos sessions, évaluez les participants et générez des bilans professionnels en quelques clics.
        </p>
      </div>

      <div className="flex gap-8 relative z-10">
        {[['66', 'Participants'], ['3', 'Sessions'], ['18', 'Compétences']].map(([n, l]) => (
          <div key={l}>
            <p className="text-2xl font-bold text-white" style={{ fontFamily: 'Poppins,sans-serif' }}>{n}</p>
            <p className="text-xs" style={{ color: '#8AABB0' }}>{l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ROOT EXPORT — login only (no formateur registration)
══════════════════════════════════════════════════════════════════ */
export default function Login({ onLogin, users, onBack }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const adminUser = (users || []).find(u => u.id === 'admin') || users?.[0];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    const found = (users || []).find(
      u => u.email.toLowerCase() === email.toLowerCase().trim() && u.password === password
    );
    if (found) {
      onLogin(found);
    } else {
      setError('Email ou mot de passe incorrect');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg,#102C32 0%,#1A3F48 50%,#102C32 100%)' }}>
      <LeftPanel />

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <img src={logo} alt="Happi" className="w-11 h-11 rounded-xl object-contain bg-white" />
            <p className="font-bold text-white text-lg" style={{ fontFamily: 'Poppins,sans-serif' }}>Happi Compétence</p>
          </div>

          <div className="bg-white rounded-3xl p-8" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-happi-teal mb-1" style={{ fontFamily: 'Poppins,sans-serif' }}>Connexion</h1>
              <p className="text-sm text-slate-500">Accédez à votre espace formateur</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
                  <AlertCircle size={16} />{error}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-happi-teal mb-1.5">Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="votre@email.fr" required className="input pl-10" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-happi-teal mb-1.5">Mot de passe</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type={showPwd ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" required className="input pl-10 pr-10" />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-happi-teal">
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="w-full py-3 text-white font-semibold rounded-full transition-all duration-200 text-sm disabled:opacity-70 disabled:cursor-not-allowed"
                style={{ background: loading ? '#ccc' : '#FF8650', boxShadow: loading ? 'none' : '0 4px 20px rgba(255,134,80,0.40)', fontFamily: 'DM Sans,sans-serif' }}>
                {loading
                  ? <span className="flex items-center justify-center gap-2"><Spinner />Connexion...</span>
                  : 'Se connecter →'}
              </button>
            </form>


            {/* Back to talent */}
            {onBack && (
              <div className="mt-4 pt-4 border-t border-slate-100 text-center">
                <button type="button" onClick={onBack}
                  className="text-sm text-slate-400 hover:text-happi-teal transition-colors flex items-center gap-1.5 mx-auto">
                  <ArrowRight size={14} className="rotate-180" />
                  Retour à l'Espace Talent
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
