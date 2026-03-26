import { useState, useMemo } from 'react';
import OnboardingTalent from '../components/OnboardingTalent';
import {
  Sparkles, Home, BarChart2, ClipboardList, User, Calendar,
  LogOut, CheckCircle, Star, Eye, EyeOff, Lock, Mail,
  AlertCircle, TrendingUp, Award, Zap, ChevronRight,
  BookOpen, Briefcase, Phone, MapPin, GraduationCap,
  Save, ArrowRight, Info, Check, UserPlus
} from 'lucide-react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, ResponsiveContainer, Tooltip, Legend
} from 'recharts';
import { CT_KEYS, CT_CATEGORIES, HBS_CATEGORIES } from '../data/initialData';

/* ─── Échelles ─────────────────────────────────────────────────── */
const CT_SCALE  = ['', 'Non acquis', 'En difficulté', "En cours d'acquisition", 'Acquis', 'Dépassé'];
const HBS_SCALE = ['', 'Aptitude', 'Acquisition', 'Maitrise', 'Excellence'];
const CT_AUTO_IDX = Object.fromEntries(CT_KEYS.slice(0, 15).map((k, i) => [k, i]));

/* ─── Utilitaires ───────────────────────────────────────────────── */
function avg(arr) {
  const valid = arr.filter(v => v != null);
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}
function fmt(v, d = 1) { return v != null ? v.toFixed(d) : '–'; }
function initiales(nom, prenom) {
  return `${(prenom?.[0] || '').toUpperCase()}${(nom?.[0] || '').toUpperCase()}`;
}

/* ─── Couleurs catégories ───────────────────────────────────────── */
const CT_COLORS = {
  Communication: '#FF8650',
  'Gestion du Stress': '#3B82F6',
  Leadership: '#10B981',
  'Analyse des problèmes': '#7C3AED',
  'Autonomie et Compétitivité': '#F59E0B',
  Humaine: '#EF4444',
};

/* ── Shared spinner ─────────────────────────────────────────────── */
function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

/* ── Talent left panel ───────────────────────────────────────────── */
function TalentLeftPanel({ mode, onFormateurAccess }) {
  return (
    <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden">
      <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full opacity-10" style={{ background: '#FF8650' }} />
      <div className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full opacity-10" style={{ background: '#FF8650' }} />
      {/* Logo */}
      <div className="flex items-center gap-3 relative z-10">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: '#FF8650', boxShadow: '0 4px 20px rgba(255,134,80,0.4)' }}>
          <Sparkles size={22} className="text-white" />
        </div>
        <div>
          <p className="font-bold text-white text-lg leading-tight" style={{ fontFamily: 'Poppins,sans-serif' }}>Happi Compétence</p>
          <p className="text-xs" style={{ color: '#8AABB0' }}>Espace Talent</p>
        </div>
      </div>
      {/* Hero */}
      <div className="relative z-10">
        <h2 className="text-4xl font-bold text-white mb-4 leading-tight" style={{ fontFamily: 'Poppins,sans-serif' }}>
          {mode === 'register'
            ? <>Créez<br />votre espace<br /><span style={{ color: '#FF8650' }}>Talent.</span></>
            : <>Découvrez<br />votre potentiel<br /><span style={{ color: '#FF8650' }}>en temps réel.</span></>}
        </h2>
        <p className="text-base mb-8" style={{ color: '#8AABB0', fontFamily: 'DM Sans,sans-serif' }}>
          {mode === 'register'
            ? 'Utilisez l\'email de votre session pour créer votre accès personnel et personnaliser votre mot de passe.'
            : 'Consultez vos évaluations, visualisez vos radars de compétences et auto-évaluez-vous en quelques clics.'}
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[['📊', 'Radars de compétences'], ['✏️', 'Auto-évaluation CT'], ['🤖', 'Analyse personnalisée'], ['📅', 'Suivi de sessions']].map(([icon, label]) => (
            <div key={label} className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <span className="text-xl">{icon}</span>
              <span className="text-xs font-medium" style={{ color: '#8AABB0' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
      <button onClick={onFormateurAccess} className="relative z-10 text-xs flex items-center gap-1 transition-colors" style={{ color: '#8AABB0' }}>
        Accès Espace Formateur →
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   TALENT LOGIN + REGISTER (classique)
══════════════════════════════════════════════════════════════════ */
function TalentLogin({ data, update, onLogin, onRegister, onFormateurAccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'

  /* ── Login state ── */
  const [lEmail, setLEmail]     = useState('');
  const [lPwd, setLPwd]         = useState('');
  const [lShow, setLShow]       = useState(false);
  const [lError, setLError]     = useState('');
  const [lLoading, setLLoading] = useState(false);

  /* ── Register state ── */
  const [rPrenom, setRPrenom]   = useState('');
  const [rNom, setRNom]         = useState('');
  const [rEmail, setREmail]     = useState('');
  const [rPwd, setRPwd]         = useState('');
  const [rCfm, setRCfm]         = useState('');
  const [rShowP, setRShowP]     = useState(false);
  const [rShowC, setRShowC]     = useState(false);
  const [rError, setRError]     = useState('');
  const [rLoading, setRLoading] = useState(false);
  const [rSuccess, setRSuccess] = useState(false);

  /* ── Login submit ── */
  const handleLogin = async (e) => {
    e.preventDefault();
    setLError('');
    setLLoading(true);
    await new Promise(r => setTimeout(r, 600));
    const p = data.participants?.find(pp =>
      pp.email?.toLowerCase().trim() === lEmail.toLowerCase().trim()
    );
    if (p) {
      const storedPwd = data.talentPasswords?.[p.id];
      const expected  = storedPwd || 'talent123';
      if (lPwd === expected) {
        onLogin({ participantId: p.id, nom: p.nom, prenom: p.prenom, email: p.email, role: 'talent' });
        setLLoading(false);
        return;
      }
    }
    setLError('Email ou mot de passe incorrect');
    setLLoading(false);
  };

  /* ── Register submit (classique — aucun matching email requis) ── */
  const handleRegister = async (e) => {
    e.preventDefault();
    setRError('');
    if (!rPrenom.trim() || !rNom.trim()) { setRError('Prénom et nom sont obligatoires.'); return; }
    if (rPwd.length < 6) { setRError('Le mot de passe doit contenir au moins 6 caractères.'); return; }
    if (rPwd !== rCfm)   { setRError('Les mots de passe ne correspondent pas.'); return; }

    // Empêche la double inscription
    const emailLow = rEmail.toLowerCase().trim();
    const existingP = data.participants?.find(p => p.email?.toLowerCase() === emailLow);
    if (existingP && data.talentPasswords?.[existingP.id]) {
      setRError('Un espace Talent existe déjà pour cet email. Connectez-vous.');
      return;
    }

    setRLoading(true);
    await new Promise(r => setTimeout(r, 700));

    // Utilise le participant existant OU génère un nouvel ID
    const participantId = existingP?.id || `pt_${Date.now()}`;

    update(prev => ({
      ...prev,
      talentPasswords: { ...(prev.talentPasswords || {}), [participantId]: rPwd },
    }));

    setRLoading(false);
    setRSuccess(true);
    const talentUser = {
      participantId,
      nom:        rNom.trim(),
      prenom:     rPrenom.trim(),
      email:      emailLow,
      role:       'talent',
      isNew:      !existingP,   // si true, TalentPortal créera le participant
    };
    setTimeout(() => {
      if (onRegister) onRegister(talentUser);
      else onLogin(talentUser);
    }, 1200);
  };

  /* ── Shared outer shell ── */
  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg,#102C32 0%,#1A3F48 50%,#102C32 100%)' }}>
      <TalentLeftPanel mode={mode} onFormateurAccess={onFormateurAccess} />

      <div className="flex-1 flex items-start justify-center p-4 sm:p-6 overflow-y-auto min-h-0">
        <div className="w-full max-w-md py-6 my-auto">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#FF8650' }}>
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-white text-lg" style={{ fontFamily: 'Poppins,sans-serif' }}>Happi Compétence</p>
              <p className="text-xs" style={{ color: '#8AABB0' }}>Espace Talent</p>
            </div>
          </div>

          {/* ── LOGIN card ── */}
          {mode === 'login' && (
            <div className="bg-white rounded-3xl p-8" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
              <div className="mb-6">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-3" style={{ background: '#FFF1EB', color: '#FF8650' }}>
                  <Star size={12} fill="#FF8650" /> Espace Talent
                </span>
                <h1 className="text-2xl font-bold text-happi-teal mb-1" style={{ fontFamily: 'Poppins,sans-serif' }}>Connexion</h1>
                <p className="text-sm text-slate-500">Accédez à votre espace personnel</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                {lError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
                    <AlertCircle size={16} />{lError}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-semibold text-happi-teal mb-1.5">Email</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="email" value={lEmail} onChange={e => setLEmail(e.target.value)}
                      placeholder="votre@email.fr" required className="input pl-10" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-happi-teal mb-1.5">Mot de passe</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type={lShow ? 'text' : 'password'} value={lPwd}
                      onChange={e => setLPwd(e.target.value)}
                      placeholder="••••••••" required className="input pl-10 pr-10" />
                    <button type="button" onClick={() => setLShow(!lShow)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-happi-teal">
                      {lShow ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={lLoading}
                  className="w-full py-3 text-white font-semibold rounded-full transition-all duration-200 text-sm"
                  style={{ background: lLoading ? '#ccc' : '#FF8650', boxShadow: lLoading ? 'none' : '0 4px 20px rgba(255,134,80,0.40)', fontFamily: 'DM Sans,sans-serif' }}>
                  {lLoading
                    ? <span className="flex items-center justify-center gap-2"><Spinner />Connexion...</span>
                    : 'Accéder à mon espace →'}
                </button>
              </form>

              {/* Switch to register */}
              <div className="mt-5 text-center">
                <span className="text-sm text-slate-400">Première connexion ? </span>
                <button onClick={() => setMode('register')} className="text-sm font-semibold" style={{ color: '#FF8650' }}>
                  Créer mon espace
                </button>
              </div>

              <div className="mt-5 p-4 rounded-2xl" style={{ background: '#FFF1EB' }}>
                <p className="text-xs font-semibold text-happi-teal mb-1">Mot de passe par défaut :</p>
                <p className="text-xs font-mono" style={{ color: '#FF8650' }}>talent123</p>
                <p className="text-xs text-slate-400 mt-1">Ou créez votre propre mot de passe via "Créer mon espace".</p>
              </div>

              <button onClick={onFormateurAccess} className="mt-4 w-full text-xs text-center text-slate-400 hover:text-happi-teal transition-colors lg:hidden">
                Accès Espace Formateur →
              </button>
            </div>
          )}

          {/* ── REGISTER card (classique) ── */}
          {mode === 'register' && (
            <div className="bg-white rounded-3xl p-8" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
              {rSuccess ? (
                <div className="flex flex-col items-center justify-center text-center py-8">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: '#ECFDF5' }}>
                    <CheckCircle size={32} style={{ color: '#10B981' }} />
                  </div>
                  <h2 className="text-xl font-bold text-happi-teal mb-2" style={{ fontFamily: 'Poppins,sans-serif' }}>Compte créé !</h2>
                  <p className="text-sm text-slate-500">Chargement du formulaire...</p>
                </div>
              ) : (
                <>
                  <div className="mb-5">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-3" style={{ background: '#FFF1EB', color: '#FF8650' }}>
                      <UserPlus size={12} /> Nouvel espace
                    </span>
                    <h1 className="text-2xl font-bold text-happi-teal mb-1" style={{ fontFamily: 'Poppins,sans-serif' }}>Créer mon espace</h1>
                    <p className="text-sm text-slate-500">Rejoignez l'Espace Talent HaPPi</p>
                  </div>

                  <form onSubmit={handleRegister} className="space-y-3">
                    {rError && (
                      <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
                        <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />{rError}
                      </div>
                    )}

                    {/* Prénom + Nom */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-semibold text-happi-teal mb-1.5">Prénom *</label>
                        <input type="text" value={rPrenom} onChange={e => setRPrenom(e.target.value)}
                          placeholder="Jean" required className="input text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-happi-teal mb-1.5">Nom *</label>
                        <input type="text" value={rNom} onChange={e => setRNom(e.target.value)}
                          placeholder="Dupont" required className="input text-sm" />
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-sm font-semibold text-happi-teal mb-1.5">Email *</label>
                      <div className="relative">
                        <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="email" value={rEmail} onChange={e => setREmail(e.target.value)}
                          placeholder="votre@email.fr" required className="input pl-10 text-sm" />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <label className="block text-sm font-semibold text-happi-teal mb-1.5">Mot de passe * (min. 6 car.)</label>
                      <div className="relative">
                        <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type={rShowP ? 'text' : 'password'} value={rPwd} onChange={e => setRPwd(e.target.value)}
                          placeholder="••••••••" required className="input pl-10 pr-10 text-sm" />
                        <button type="button" onClick={() => setRShowP(!rShowP)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-happi-teal">
                          {rShowP ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm */}
                    <div>
                      <label className="block text-sm font-semibold text-happi-teal mb-1.5">Confirmer le mot de passe *</label>
                      <div className="relative">
                        <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type={rShowC ? 'text' : 'password'} value={rCfm} onChange={e => setRCfm(e.target.value)}
                          placeholder="••••••••" required className="input pl-10 pr-10 text-sm"
                          style={{ borderColor: rCfm && rPwd === rCfm ? '#10B981' : rCfm && rPwd !== rCfm ? '#EF4444' : '' }} />
                        <button type="button" onClick={() => setRShowC(!rShowC)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-happi-teal">
                          {rShowC ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <button type="submit" disabled={rLoading}
                      className="w-full py-3 text-white font-semibold rounded-full transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ background: rLoading ? '#ccc' : '#FF8650', boxShadow: !rLoading ? '0 4px 20px rgba(255,134,80,0.40)' : 'none', fontFamily: 'DM Sans,sans-serif' }}>
                      {rLoading
                        ? <span className="flex items-center justify-center gap-2"><Spinner />Création...</span>
                        : 'Créer mon compte →'}
                    </button>
                  </form>

                  <div className="mt-4 text-center">
                    <span className="text-sm text-slate-400">Déjà un compte ? </span>
                    <button onClick={() => setMode('login')} className="text-sm font-semibold" style={{ color: '#FF8650' }}>
                      Se connecter
                    </button>
                  </div>

                  <button onClick={onFormateurAccess} className="mt-3 w-full text-xs text-center text-slate-400 hover:text-happi-teal transition-colors lg:hidden">
                    Accès Espace Formateur →
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   BOTTOM NAV
══════════════════════════════════════════════════════════════════ */
const TABS = [
  { id: 'home',      icon: Home,         label: 'Accueil' },
  { id: 'competences', icon: BarChart2,  label: 'Compétences' },
  { id: 'autoeval',  icon: ClipboardList, label: 'Auto-éval' },
  { id: 'profil',    icon: User,          label: 'Profil' },
  { id: 'sessions',  icon: Calendar,      label: 'Sessions' },
];

function TalentNav({ active, onChange, hasAutoEval }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex z-50"
      style={{ boxShadow: '0 -4px 20px rgba(16,44,50,0.08)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {TABS.map(({ id, icon: Icon, label }) => (
        <button key={id} onClick={() => onChange(id)}
          className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors relative"
          style={{ color: active === id ? '#FF8650' : '#94a3b8' }}>
          <Icon size={20} strokeWidth={active === id ? 2.5 : 1.8} />
          <span className="text-[10px] font-medium leading-tight">{label}</span>
          {id === 'autoeval' && !hasAutoEval && (
            <span className="absolute top-1.5 right-[calc(50%-8px)] w-2 h-2 rounded-full bg-orange-400" />
          )}
        </button>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ACCUEIL TAB
══════════════════════════════════════════════════════════════════ */
function TabHome({ participant, sessions, onNavigate }) {
  const ctScores = Object.values(participant.competences || {}).filter(v => v != null);
  const ctAvg    = avg(ctScores);
  const hbsVals  = (participant.hbsJeu || []).filter(v => v != null);
  const hbsAvg   = avg(hbsVals);
  const hasAutoEval = participant.ctAutoEval?.some(v => v != null);

  return (
    <div className="p-4 pb-24 space-y-4 max-w-lg mx-auto">
      {/* Hero card */}
      <div className="rounded-3xl p-6 relative overflow-hidden" style={{ background: 'linear-gradient(135deg,#102C32,#1A3F48)' }}>
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-10" style={{ background: '#FF8650' }} />
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white flex-shrink-0"
            style={{ background: 'rgba(255,134,80,0.25)', border: '2px solid rgba(255,134,80,0.4)', fontFamily: 'Poppins,sans-serif' }}>
            {initiales(participant.nom, participant.prenom)}
          </div>
          <div>
            <p className="text-xs text-orange-300 font-medium mb-0.5">Bonjour 👋</p>
            <h2 className="text-xl font-bold text-white leading-tight" style={{ fontFamily: 'Poppins,sans-serif' }}>
              {participant.prenom} {participant.nom}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {participant.residence || participant.age || 'Participant'}
            </p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Sessions', value: sessions.length, icon: Calendar, color: '#3B82F6', bg: '#EFF6FF' },
          { label: 'CT moy.', value: ctAvg != null ? fmt(ctAvg) + '/5' : '–', icon: BarChart2, color: '#FF8650', bg: '#FFF1EB' },
          { label: 'HBS moy.', value: hbsAvg != null ? fmt(hbsAvg) + '/4' : '–', icon: TrendingUp, color: '#10B981', bg: '#ECFDF5' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="card p-4 flex flex-col items-center gap-1 text-center">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: bg }}>
              <Icon size={16} style={{ color }} />
            </div>
            <p className="text-base font-bold text-happi-teal" style={{ fontFamily: 'Poppins,sans-serif' }}>{value}</p>
            <p className="text-xs text-slate-400">{label}</p>
          </div>
        ))}
      </div>

      {/* CTA auto-éval */}
      {!hasAutoEval && (
        <button onClick={() => onNavigate('autoeval')}
          className="w-full rounded-2xl p-5 text-left transition-all" style={{ background: 'linear-gradient(135deg,#FF8650,#E86A35)', boxShadow: '0 4px 20px rgba(255,134,80,0.35)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-white text-sm" style={{ fontFamily: 'Poppins,sans-serif' }}>Auto-évaluation à compléter</p>
              <p className="text-xs text-orange-100 mt-0.5">Évaluez vos 15 compétences transversales</p>
            </div>
            <ArrowRight size={20} className="text-white flex-shrink-0" />
          </div>
          <div className="mt-3 bg-white/20 rounded-full h-1.5">
            <div className="h-1.5 rounded-full bg-white" style={{ width: '0%' }} />
          </div>
          <p className="text-xs text-orange-100 mt-1">0/15 complétées</p>
        </button>
      )}
      {hasAutoEval && (
        <div className="card p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: '#ECFDF5' }}>
            <CheckCircle size={20} style={{ color: '#10B981' }} />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-happi-teal text-sm">Auto-évaluation complétée</p>
            <p className="text-xs text-slate-400">{participant.ctAutoEval?.filter(v => v != null).length || 0}/15 compétences évaluées</p>
          </div>
          <button onClick={() => onNavigate('autoeval')} className="text-xs font-semibold flex items-center gap-1" style={{ color: '#FF8650' }}>
            Modifier <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* CT mini preview */}
      {ctAvg != null && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-happi-teal text-sm" style={{ fontFamily: 'Poppins,sans-serif' }}>Compétences Transversales</h3>
            <button onClick={() => onNavigate('competences')} className="text-xs font-semibold flex items-center gap-1" style={{ color: '#FF8650' }}>
              Voir tout <ChevronRight size={14} />
            </button>
          </div>
          <div className="space-y-2.5">
            {CT_CATEGORIES.map(cat => {
              const vals = cat.items.map(k => participant.competences?.[k]).filter(v => v != null);
              const a = avg(vals);
              if (a == null) return null;
              return (
                <div key={cat.label}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-happi-teal">{cat.label}</span>
                    <span className="font-semibold" style={{ color: cat.color }}>{fmt(a)}/5</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full transition-all" style={{ width: `${(a / 5) * 100}%`, background: cat.color }} />
                  </div>
                </div>
              );
            }).filter(Boolean)}
          </div>
        </div>
      )}

      {/* Sessions preview */}
      {sessions.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-happi-teal text-sm" style={{ fontFamily: 'Poppins,sans-serif' }}>Dernières sessions</h3>
            <button onClick={() => onNavigate('sessions')} className="text-xs font-semibold flex items-center gap-1" style={{ color: '#FF8650' }}>
              Voir tout <ChevronRight size={14} />
            </button>
          </div>
          {sessions.slice(0, 2).map(s => (
            <div key={s.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#FFF1EB' }}>
                <Calendar size={16} style={{ color: '#FF8650' }} />
              </div>
              <div>
                <p className="text-sm font-medium text-happi-teal">{s.nom}</p>
                <p className="text-xs text-slate-400">{s.date}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   COMPÉTENCES TAB
══════════════════════════════════════════════════════════════════ */
const CustomRadarTooltip = ({ active, payload, scale }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl p-3 shadow-lg border border-slate-100 text-xs">
      <p className="font-bold text-happi-teal mb-1">{payload[0]?.payload?.subject}</p>
      {payload.map((entry, i) => {
        const v = entry.value;
        const label = scale?.[Math.round(v)] || (v != null ? v.toFixed(1) : '–');
        return v > 0 ? (
          <p key={i} style={{ color: entry.color }}>
            {entry.name} : {v.toFixed(1)} — {label}
          </p>
        ) : null;
      })}
    </div>
  );
};

function TabCompetences({ participant }) {
  const [section, setSection] = useState('ct'); // 'ct' | 'hbs' | 'ai'

  /* ── CT radar data ── */
  const radarCT = useMemo(() => CT_CATEGORIES.map(cat => {
    const jeuVals  = cat.items.map(k => participant.competences?.[k]).filter(v => v != null);
    const jeu      = jeuVals.length ? parseFloat(avg(jeuVals).toFixed(2)) : 0;
    const autoVals = cat.items
      .map(k => { const idx = CT_AUTO_IDX[k]; return idx !== undefined ? participant.ctAutoEval?.[idx] : null; })
      .filter(v => v != null);
    const auto = autoVals.length ? parseFloat(avg(autoVals).toFixed(2)) : null;
    return { subject: cat.label, jeu, auto, color: cat.color, hasJeu: jeuVals.length > 0 };
  }), [participant]);

  const hasCTJeu  = radarCT.some(d => d.hasJeu);
  const hasCTAuto = radarCT.some(d => d.auto != null);

  /* ── HBS radar data ── */
  const radarHBS = useMemo(() => HBS_CATEGORIES.map(cat => {
    const vals = cat.items.map(it => participant.hbsJeu?.[it.hbsIndex]).filter(v => v != null);
    const value = vals.length ? Math.min(parseFloat(avg(vals).toFixed(2)), 4) : 0;
    return { subject: cat.label, value, color: cat.color, hasData: vals.length > 0 };
  }), [participant]);
  const hasHBSData = radarHBS.some(d => d.hasData);

  /* ── AI Analysis ── */
  const ctEntries = Object.entries(participant.competences || {})
    .filter(([, v]) => v != null)
    .sort((a, b) => b[1] - a[1]);
  const pointsForts   = ctEntries.slice(0, 3);
  const axeAmelio     = ctEntries.slice(-3).reverse();

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-4">
      {/* Section tabs */}
      <div className="flex gap-2 bg-slate-100 rounded-2xl p-1">
        {[
          { id: 'ct', label: 'CT' },
          { id: 'hbs', label: 'HBS' },
          { id: 'ai', label: 'Analyse IA' },
        ].map(({ id, label }) => (
          <button key={id} onClick={() => setSection(id)}
            className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: section === id ? 'white' : 'transparent', color: section === id ? '#FF8650' : '#64748b', boxShadow: section === id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── CT section ── */}
      {section === 'ct' && (
        <>
          <div className="card">
            <div className="mb-3">
              <h3 className="font-semibold text-happi-teal text-sm mb-0.5" style={{ fontFamily: 'Poppins,sans-serif' }}>Compétences Transversales</h3>
              <p className="text-xs text-slate-400">Évaluation jeu • Échelle 1–5</p>
            </div>
            {hasCTJeu ? (
              <>
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={radarCT}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'DM Sans,sans-serif' }} />
                    <PolarRadiusAxis domain={[0, 5]} tick={false} axisLine={false} />
                    <Radar name="Jeu" dataKey="jeu" stroke="#FF8650" fill="#FF8650" fillOpacity={0.2} strokeWidth={2} dot />
                    {hasCTAuto && <Radar name="Auto-éval" dataKey="auto" stroke="#7C3AED" fill="#7C3AED" fillOpacity={0.1} strokeWidth={2} strokeDasharray="5 3" dot />}
                    <Tooltip content={<CustomRadarTooltip scale={CT_SCALE} />} />
                    {hasCTAuto && <Legend wrapperStyle={{ fontSize: 11 }} />}
                  </RadarChart>
                </ResponsiveContainer>
                <div className="flex gap-3 flex-wrap mt-1">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="w-4 h-0.5 rounded inline-block" style={{ background: '#FF8650' }} />
                    Évaluation jeu
                  </div>
                  {hasCTAuto && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <span className="w-4 h-px inline-block" style={{ borderTop: '2px dashed #7C3AED' }} />
                      Auto-évaluation
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-400 text-center py-6">Absent lors de la session de jeu</p>
            )}
          </div>

          {/* CT Cards by category */}
          {CT_CATEGORIES.map(cat => {
            const items = cat.items.map(k => {
              const jeu  = participant.competences?.[k];
              const idx  = CT_AUTO_IDX[k];
              const auto = idx !== undefined ? participant.ctAutoEval?.[idx] : null;
              return { key: k, jeu, auto };
            });
            const hasAny = items.some(i => i.jeu != null || i.auto != null);
            return (
              <div key={cat.label} className="card">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-6 rounded-full" style={{ background: cat.color }} />
                  <h4 className="font-semibold text-happi-teal text-sm" style={{ fontFamily: 'Poppins,sans-serif' }}>{cat.label}</h4>
                </div>
                {hasAny ? (
                  <div className="space-y-2.5">
                    {items.map(({ key, jeu, auto }) => (
                      <div key={key}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-happi-teal font-medium">{key}</span>
                          <div className="flex items-center gap-2">
                            {jeu != null  && <span className="font-bold" style={{ color: cat.color }}>{jeu}/5</span>}
                            {auto != null && <span className="text-purple-600 font-medium">{auto}/5</span>}
                            {jeu == null && auto == null && <span className="text-slate-300 italic">–</span>}
                          </div>
                        </div>
                        {jeu != null && (
                          <div className="h-1.5 rounded-full bg-slate-100">
                            <div className="h-1.5 rounded-full transition-all" style={{ width: `${(jeu / 5) * 100}%`, background: cat.color }} />
                          </div>
                        )}
                        {jeu != null && (
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Jeu : {CT_SCALE[jeu] || jeu}
                            {auto != null && ` • Auto : ${CT_SCALE[auto] || auto}`}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 text-center py-2">Absent lors de la session</p>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* ── HBS section ── */}
      {section === 'hbs' && (
        <>
          <div className="card">
            <div className="mb-3">
              <h3 className="font-semibold text-happi-teal text-sm mb-0.5" style={{ fontFamily: 'Poppins,sans-serif' }}>Habiletés Sociocognitives (HBS)</h3>
              <p className="text-xs text-slate-400">Évaluation jeu • Échelle 1–4</p>
            </div>
            {hasHBSData ? (
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={radarHBS}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'DM Sans,sans-serif' }} />
                  <PolarRadiusAxis domain={[0, 4]} tick={false} axisLine={false} />
                  <Radar name="HBS Jeu" dataKey="value" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.2} strokeWidth={2} dot />
                  <Tooltip content={<CustomRadarTooltip scale={HBS_SCALE} />} />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-slate-400 text-center py-6">Absent lors de la session HBS</p>
            )}
          </div>

          {HBS_CATEGORIES.map(cat => {
            const items = cat.items.map(it => ({
              key: it.key,
              val: participant.hbsJeu?.[it.hbsIndex],
            }));
            const hasAny = items.some(i => i.val != null);
            return (
              <div key={cat.label} className="card">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-6 rounded-full" style={{ background: cat.color }} />
                  <h4 className="font-semibold text-happi-teal text-sm" style={{ fontFamily: 'Poppins,sans-serif' }}>Relation {cat.label}</h4>
                </div>
                {hasAny ? (
                  <div className="space-y-2.5">
                    {items.map(({ key, val }) => (
                      <div key={key}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-happi-teal font-medium">{key}</span>
                          {val != null
                            ? <span className="font-bold" style={{ color: cat.color }}>{Math.min(val, 4).toFixed(1)}/4</span>
                            : <span className="text-slate-300">–</span>}
                        </div>
                        {val != null && (
                          <>
                            <div className="h-1.5 rounded-full bg-slate-100">
                              <div className="h-1.5 rounded-full" style={{ width: `${(Math.min(val, 4) / 4) * 100}%`, background: cat.color }} />
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">{HBS_SCALE[Math.round(Math.min(val, 4))] || ''}</p>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 text-center py-2">Absent lors de la session</p>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* ── AI section ── */}
      {section === 'ai' && (
        <>
          <div className="card" style={{ background: 'linear-gradient(135deg,#102C32,#1A3F48)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,134,80,0.2)' }}>
                <Zap size={20} style={{ color: '#FF8650' }} />
              </div>
              <div>
                <h3 className="font-semibold text-white text-sm" style={{ fontFamily: 'Poppins,sans-serif' }}>Analyse personnalisée</h3>
                <p className="text-xs" style={{ color: '#8AABB0' }}>Basée sur vos scores CT</p>
              </div>
            </div>
          </div>

          {pointsForts.length > 0 && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#ECFDF5' }}>
                  <Star size={16} style={{ color: '#10B981' }} fill="#10B981" />
                </div>
                <h4 className="font-semibold text-happi-teal text-sm" style={{ fontFamily: 'Poppins,sans-serif' }}>Points forts</h4>
              </div>
              {pointsForts.map(([key, val]) => (
                <div key={key} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-sm text-happi-teal">{key}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-16 rounded-full bg-slate-100">
                      <div className="h-1.5 rounded-full bg-emerald-400" style={{ width: `${(val / 5) * 100}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-emerald-600">{val}/5</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {axeAmelio.length > 0 && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#FFF1EB' }}>
                  <TrendingUp size={16} style={{ color: '#FF8650' }} />
                </div>
                <h4 className="font-semibold text-happi-teal text-sm" style={{ fontFamily: 'Poppins,sans-serif' }}>Axes d'amélioration</h4>
              </div>
              {axeAmelio.map(([key, val]) => (
                <div key={key} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                    <span className="text-sm text-happi-teal">{key}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-16 rounded-full bg-slate-100">
                      <div className="h-1.5 rounded-full bg-orange-400" style={{ width: `${(val / 5) * 100}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-orange-500">{val}/5</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recommandations métiers */}
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#EEF2FF' }}>
                <Briefcase size={16} style={{ color: '#6366f1' }} />
              </div>
              <h4 className="font-semibold text-happi-teal text-sm" style={{ fontFamily: 'Poppins,sans-serif' }}>Pistes professionnelles</h4>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Basées sur vos ambitions :{' '}
              <span className="font-medium text-happi-teal italic">{participant.ambitions || 'non renseignées'}</span>
            </p>
            {getRecos(participant).map((r, i) => (
              <div key={i} className="p-3 rounded-xl mb-2" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-happi-teal">{r.metier}</p>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: r.match >= 80 ? '#10B981' : r.match >= 70 ? '#F59E0B' : '#6366f1' }}>
                    {r.match}%
                  </span>
                </div>
                <p className="text-xs text-slate-500">{r.description}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function getRecos(participant) {
  const ambitions = (participant.ambitions || '').toLowerCase();
  if (ambitions.includes('commerce') || ambitions.includes('vente') || ambitions.includes('marketing')) {
    return [
      { metier: 'Commercial(e) / Chargé(e) de clientèle', match: 85, description: 'Profil adapté aux métiers de la relation client et de la vente.' },
      { metier: 'Chargé(e) de communication', match: 75, description: 'Bonnes bases pour des missions de communication externe.' },
    ];
  } else if (ambitions.includes('informatique') || ambitions.includes('numérique') || ambitions.includes('jeux vidéo')) {
    return [
      { metier: 'Développeur(se) / Technicien(ne) IT', match: 85, description: 'Profil orienté technique avec une bonne autonomie.' },
      { metier: 'Chef de projet digital', match: 70, description: 'Gestion de projets numériques avec équipes transversales.' },
    ];
  } else if (ambitions.includes('santé') || ambitions.includes('social') || ambitions.includes('service')) {
    return [
      { metier: 'Conseiller(e) en insertion professionnelle', match: 80, description: 'Fort sens du service et de l\'accompagnement.' },
      { metier: 'Assistant(e) social(e)', match: 75, description: 'Profil empathique adapté aux métiers d\'aide à la personne.' },
    ];
  } else if (ambitions.includes('sécurité') || ambitions.includes('défense')) {
    return [
      { metier: 'Agent de sécurité / Gendarme', match: 80, description: 'Profil rigoureux adapté aux métiers de la sécurité.' },
      { metier: 'Manager d\'équipe opérationnelle', match: 65, description: 'Leadership potentiel pour encadrement d\'équipes.' },
    ];
  }
  return [
    { metier: 'Chargé(e) de projet', match: 72, description: 'Polyvalence appréciée dans la coordination de projets divers.' },
    { metier: 'Assistant(e) de direction', match: 68, description: 'Organisation et rigueur sont des atouts majeurs.' },
  ];
}

/* ── Phrases-situations associées aux 15 compétences CT (même ordre que CT_KEYS) ── */
const CT_SITUATIONS = [
  "J'ai de bonnes relations avec les autres",
  "J'aime et je sais travailler en équipe",
  "Je comprends facilement les consignes et les situations",
  "Je m'adapte facilement aux changements",
  "Je sais bien organiser et gérer mes priorités",
  "Je gère bien mon stress en toutes circonstances",
  "Je suis capable de diriger et d'entraîner un groupe",
  "Je propose régulièrement des idées et des solutions",
  "Je suis organisé(e) et méthodique dans mon travail",
  "Je suis pleinement impliqué(e) dans ce que je fais",
  "J'analyse bien les problèmes avant d'agir",
  "Je suis curieux(se) et j'aime apprendre de nouvelles choses",
  "Je travaille de façon autonome sans avoir besoin d'être guidé(e)",
  "Je respecte les délais et les échéances qui me sont fixés",
  "Je suis polyvalent(e) et capable de m'adapter à des tâches variées",
];

/* ══════════════════════════════════════════════════════════════════
   AUTO-ÉVALUATION TAB
══════════════════════════════════════════════════════════════════ */
function TabAutoEval({ participant, update, participantId }) {
  const initial = CT_KEYS.slice(0, 15).map((_, i) => participant.ctAutoEval?.[i] ?? null);
  const [scores, setScores] = useState(initial);
  const [saved, setSaved]   = useState(false);

  const filledCount = scores.filter(v => v != null).length;

  const handleSave = () => {
    update(prev => ({
      ...prev,
      participants: (prev.participants || []).map(p =>
        p.id === participantId ? { ...p, ctAutoEval: scores } : p
      ),
    }));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const CT_CATEGORY_FOR = useMemo(() => {
    const map = {};
    CT_CATEGORIES.forEach(cat => {
      cat.items.forEach(k => { if (CT_AUTO_IDX[k] !== undefined) map[k] = cat; });
    });
    return map;
  }, []);

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div className="card" style={{ background: 'linear-gradient(135deg,#102C32,#1A3F48)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,134,80,0.2)' }}>
            <ClipboardList size={20} style={{ color: '#FF8650' }} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-white text-sm" style={{ fontFamily: 'Poppins,sans-serif' }}>Auto-évaluation CT</h3>
            <p className="text-xs" style={{ color: '#8AABB0' }}>Évaluez vous-même vos 15 compétences</p>
          </div>
        </div>
        {/* Progress */}
        <div className="mt-4">
          <div className="flex justify-between text-xs mb-1.5" style={{ color: '#8AABB0' }}>
            <span>{filledCount}/15 complétées</span>
            <span>{Math.round((filledCount / 15) * 100)}%</span>
          </div>
          <div className="h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <div className="h-2 rounded-full transition-all" style={{ width: `${(filledCount / 15) * 100}%`, background: '#FF8650' }} />
          </div>
        </div>
      </div>

      {/* Badge "pré-rempli depuis le formulaire" */}
      {participant.hbs?.some(v => v != null) && (
        <div className="flex items-center gap-2 p-3 rounded-2xl" style={{ background: 'rgba(16,180,113,0.08)', border: '1px solid rgba(16,180,113,0.2)' }}>
          <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#ECFDF5' }}>
            <Check size={12} style={{ color: '#10B981' }} />
          </div>
          <p className="text-xs" style={{ color: '#065f46' }}>
            Pré-rempli depuis ton <strong>Formulaire HaPPi</strong>. Tu peux ajuster tes réponses ci-dessous.
          </p>
        </div>
      )}

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-2xl" style={{ background: '#FFF1EB' }}>
        <Info size={16} style={{ color: '#FF8650', flexShrink: 0, marginTop: 1 }} />
        <p className="text-xs" style={{ color: '#92400e' }}>
          Pour chaque situation, sélectionnez le niveau qui vous correspond :<br />
          <strong>1</strong> = Pas du tout d'accord → <strong>5</strong> = Tout à fait d'accord
        </p>
      </div>

      {/* Competency cards */}
      {CT_KEYS.slice(0, 15).map((key, idx) => {
        const cat = CT_CATEGORY_FOR[key];
        const val = scores[idx];
        const situation = CT_SITUATIONS[idx];
        return (
          <div key={key} className="card">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {cat && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: cat.color + '18', color: cat.color }}>
                      {cat.label}
                    </span>
                  )}
                </div>
                <p className="font-semibold text-happi-teal text-sm">{key}</p>
                {situation && (
                  <p className="text-xs text-slate-400 italic mt-0.5">« {situation} »</p>
                )}
                {val != null && (
                  <p className="text-xs mt-1 font-medium" style={{ color: '#FF8650' }}>{CT_SCALE[val]}</p>
                )}
              </div>
              {val != null && (
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#FF8650', color: 'white', fontFamily: 'Poppins,sans-serif', fontWeight: 700, fontSize: 16 }}>
                  {val}
                </div>
              )}
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n}
                  onClick={() => { const s = [...scores]; s[idx] = s[idx] === n ? null : n; setScores(s); }}
                  className="py-2 rounded-xl text-sm font-bold transition-all"
                  style={{
                    background: val === n ? '#FF8650' : '#f8fafc',
                    color: val === n ? 'white' : '#64748b',
                    border: val === n ? '2px solid #FF8650' : '2px solid #e2e8f0',
                    boxShadow: val === n ? '0 2px 8px rgba(255,134,80,0.3)' : 'none',
                  }}>
                  {n}
                </button>
              ))}
            </div>
            <div className="flex justify-between mt-1.5 text-[9px] text-slate-300 px-0.5">
              {['Non acquis', '', "En cours", '', 'Dépassé'].map((l, i) => (
                <span key={i} className="text-center" style={{ width: '20%' }}>{l}</span>
              ))}
            </div>
          </div>
        );
      })}

      {/* Save button */}
      <div className="sticky bottom-20 pt-2">
        <button onClick={handleSave} disabled={filledCount === 0}
          className={`w-full py-3.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${filledCount === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          style={{ background: saved ? '#10B981' : '#FF8650', color: 'white', boxShadow: filledCount > 0 ? '0 4px 20px rgba(255,134,80,0.4)' : 'none', fontFamily: 'DM Sans,sans-serif' }}>
          {saved ? <><Check size={18} /> Sauvegardé !</> : <><Save size={18} /> Enregistrer mon auto-évaluation</>}
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PROFIL TAB
══════════════════════════════════════════════════════════════════ */
function TabProfil({ participant, update, participantId }) {
  const [editing, setEditing]           = useState(false);
  const [ambitions, setAmbitions]       = useState(participant.ambitions || '');
  const [savedAmbitions, setSavedAmbitions] = useState(false);

  const handleSaveAmbitions = () => {
    update(prev => ({
      ...prev,
      participants: (prev.participants || []).map(p =>
        p.id === participantId ? { ...p, ambitions } : p
      ),
    }));
    setEditing(false);
    setSavedAmbitions(true);
    setTimeout(() => setSavedAmbitions(false), 2000);
  };

  const infoItems = [
    { icon: Mail, label: 'Email', value: participant.email },
    { icon: Phone, label: 'Téléphone', value: participant.telephone },
    { icon: MapPin, label: 'Résidence', value: participant.residence },
    { icon: GraduationCap, label: 'Niveau d\'études', value: participant.niveauEtudes },
    { icon: BookOpen, label: 'Domaine', value: participant.domainesEtudes },
  ].filter(i => i.value);

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-4">
      {/* Avatar card */}
      <div className="card flex items-center gap-5">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-3xl font-bold text-white flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#FF8650,#E86A35)', fontFamily: 'Poppins,sans-serif', boxShadow: '0 4px 20px rgba(255,134,80,0.3)' }}>
          {initiales(participant.nom, participant.prenom)}
        </div>
        <div>
          <h2 className="text-xl font-bold text-happi-teal leading-tight" style={{ fontFamily: 'Poppins,sans-serif' }}>
            {participant.prenom} {participant.nom}
          </h2>
          {participant.age && <p className="text-sm text-slate-500 mt-0.5">{participant.age}</p>}
          {participant.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {participant.tags.slice(0, 3).map(t => (
                <span key={t} className="px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ background: '#FFF1EB', color: '#FF8650' }}>{t}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Informations */}
      <div className="card">
        <h3 className="font-semibold text-happi-teal text-sm mb-4" style={{ fontFamily: 'Poppins,sans-serif' }}>Informations personnelles</h3>
        <div className="space-y-3">
          {infoItems.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#FFF1EB' }}>
                <Icon size={14} style={{ color: '#FF8650' }} />
              </div>
              <div>
                <p className="text-xs text-slate-400">{label}</p>
                <p className="text-sm font-medium text-happi-teal">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ambitions */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-happi-teal text-sm" style={{ fontFamily: 'Poppins,sans-serif' }}>Ambitions & objectifs</h3>
          {!editing && (
            <button onClick={() => setEditing(true)} className="text-xs font-semibold flex items-center gap-1" style={{ color: '#FF8650' }}>
              Modifier
            </button>
          )}
        </div>
        {editing ? (
          <>
            <textarea
              value={ambitions}
              onChange={e => setAmbitions(e.target.value)}
              rows={4}
              placeholder="Décrivez vos ambitions professionnelles..."
              className="input text-sm resize-none"
            />
            <div className="flex gap-2 mt-3">
              <button onClick={handleSaveAmbitions} className="btn-primary text-xs px-4 py-2 flex-1 justify-center">
                <Save size={14} /> Enregistrer
              </button>
              <button onClick={() => { setEditing(false); setAmbitions(participant.ambitions || ''); }} className="btn-secondary text-xs px-4 py-2">
                Annuler
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500 italic leading-relaxed">
            {participant.ambitions || 'Aucune ambition renseignée pour le moment.'}
          </p>
        )}
        {savedAmbitions && (
          <p className="text-xs text-emerald-600 flex items-center gap-1 mt-2"><Check size={12} /> Sauvegardé !</p>
        )}
      </div>

      {/* Tags */}
      {participant.tags?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-happi-teal text-sm mb-3" style={{ fontFamily: 'Poppins,sans-serif' }}>Tags</h3>
          <div className="flex flex-wrap gap-2">
            {participant.tags.map(t => (
              <span key={t} className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: '#FFF1EB', color: '#FF8650' }}>{t}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SESSIONS TAB
══════════════════════════════════════════════════════════════════ */
function TabSessions({ sessions, presences, participantId }) {
  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-4">
      <div className="card" style={{ background: 'linear-gradient(135deg,#102C32,#1A3F48)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,134,80,0.2)' }}>
            <Calendar size={20} style={{ color: '#FF8650' }} />
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm" style={{ fontFamily: 'Poppins,sans-serif' }}>Mes sessions</h3>
            <p className="text-xs" style={{ color: '#8AABB0' }}>{sessions.length} session{sessions.length !== 1 ? 's' : ''} inscrite{sessions.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="card text-center py-10">
          <Calendar size={32} className="mx-auto mb-3 text-slate-200" />
          <p className="text-sm text-slate-400">Aucune session enregistrée</p>
        </div>
      ) : (
        sessions.map(s => {
          const presenceEntry = presences?.[s.id]?.[participantId];
          const isPresent = presenceEntry === true || presenceEntry === 'present' || presenceEntry === 'présent';
          const isAbsent  = presenceEntry === false || presenceEntry === 'absent';
          const isRetard  = presenceEntry === 'retard';
          return (
            <div key={s.id} className="card">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 text-center"
                  style={{ background: '#FFF1EB' }}>
                  <Calendar size={18} style={{ color: '#FF8650' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-happi-teal text-sm truncate">{s.nom}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{s.date}</p>
                  {s.lieu && <p className="text-xs text-slate-400">{s.lieu}</p>}
                  <div className="mt-2">
                    {isPresent
                      ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: '#ECFDF5', color: '#10B981' }}>
                          <CheckCircle size={10} /> Présent(e)
                        </span>
                      : isRetard
                        ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: '#FFFBEB', color: '#D97706' }}>
                            En retard
                          </span>
                        : isAbsent
                          ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: '#FEF2F2', color: '#EF4444' }}>
                              Absent(e)
                            </span>
                          : <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full" style={{ background: '#F1F5F9', color: '#94a3b8' }}>
                              Non renseigné
                            </span>
                    }
                  </div>
                </div>
              </div>
              {s.description && (
                <p className="text-xs text-slate-400 mt-3 leading-relaxed border-t border-slate-50 pt-3">{s.description}</p>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN TALENT APP
══════════════════════════════════════════════════════════════════ */
function TalentApp({ data, update, talentUser, onLogout }) {
  const [activeTab, setActiveTab]           = useState('home');
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const participant = data.participants?.find(p => p.id === talentUser.participantId);
  const sessions    = data.sessions?.filter(s => s.participants?.includes(talentUser.participantId)) || [];
  const hasAutoEval = participant?.ctAutoEval?.some(v => v != null);

  if (!participant) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f8fafc' }}>
        <div className="text-center p-6">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <User size={28} className="text-slate-300" />
          </div>
          <p className="text-slate-500 mb-4">Profil introuvable</p>
          <button onClick={onLogout} className="btn-primary mx-auto">Se déconnecter</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-slate-50" style={{ height: '100dvh', minHeight: '100vh' }}>

      {/* ── Top header ── */}
      <div className="flex-none sticky top-0 z-40 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between"
        style={{ boxShadow: '0 2px 12px rgba(16,44,50,0.06)' }}>

        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#FF8650' }}>
            <Sparkles size={16} className="text-white" />
          </div>
          <div>
            <p className="text-xs font-bold text-happi-teal leading-tight" style={{ fontFamily: 'Poppins,sans-serif' }}>Happi Compétence</p>
            <p className="text-[10px] text-slate-400">Espace Talent</p>
          </div>
        </div>

        {/* Avatar bubble + dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(m => !m)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 transition-transform active:scale-95"
            style={{ background: 'linear-gradient(135deg,#FF8650,#E86A35)', boxShadow: showProfileMenu ? '0 0 0 3px rgba(255,134,80,0.25)' : '0 2px 8px rgba(255,134,80,0.35)', fontFamily: 'Poppins,sans-serif' }}
            aria-label="Mon profil">
            {initiales(participant.nom, participant.prenom)}
          </button>

          {/* Dropdown menu */}
          {showProfileMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
              <div className="absolute top-full right-0 mt-2 w-60 bg-white rounded-2xl z-50 overflow-hidden"
                style={{ boxShadow: '0 8px 40px rgba(16,44,50,0.18)', border: '1px solid rgba(0,0,0,0.06)' }}>

                {/* Profile header */}
                <div className="px-4 py-4 flex items-center gap-3" style={{ background: 'linear-gradient(135deg,#102C32,#1A3F48)' }}>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
                    style={{ background: 'rgba(255,134,80,0.3)', border: '2px solid rgba(255,134,80,0.5)', fontFamily: 'Poppins,sans-serif' }}>
                    {initiales(participant.nom, participant.prenom)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white leading-tight truncate">{participant.prenom} {participant.nom}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: '#8AABB0' }}>Espace Talent</p>
                    {participant.email && (
                      <p className="text-[10px] mt-0.5 truncate" style={{ color: '#8AABB0' }}>{participant.email}</p>
                    )}
                  </div>
                </div>

                {/* Menu items */}
                <div className="p-2">
                  <button
                    onClick={() => { setActiveTab('profil'); setShowProfileMenu(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-happi-teal transition-colors hover:bg-slate-50 active:bg-slate-100">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#FFF1EB' }}>
                      <User size={14} style={{ color: '#FF8650' }} />
                    </div>
                    Mon profil
                  </button>
                  <button
                    onClick={() => { setActiveTab('competences'); setShowProfileMenu(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-happi-teal transition-colors hover:bg-slate-50 active:bg-slate-100">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#EFF6FF' }}>
                      <BarChart2 size={14} style={{ color: '#3B82F6' }} />
                    </div>
                    Mes compétences
                  </button>
                  <div className="my-1.5 border-t border-slate-100" />
                  <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-red-50 active:bg-red-100"
                    style={{ color: '#EF4444' }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#FEF2F2' }}>
                      <LogOut size={14} style={{ color: '#EF4444' }} />
                    </div>
                    Se déconnecter
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Tab content (scrollable zone) ── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}>
        {activeTab === 'home'        && <TabHome participant={participant} sessions={sessions} onNavigate={setActiveTab} />}
        {activeTab === 'competences' && <TabCompetences participant={participant} />}
        {activeTab === 'autoeval'    && <TabAutoEval participant={participant} update={update} participantId={talentUser.participantId} />}
        {activeTab === 'profil'      && <TabProfil participant={participant} update={update} participantId={talentUser.participantId} />}
        {activeTab === 'sessions'    && <TabSessions sessions={sessions} presences={data.presences} participantId={talentUser.participantId} />}
      </div>

      {/* ── Bottom nav ── */}
      <TalentNav active={activeTab} onChange={setActiveTab} hasAutoEval={hasAutoEval} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ROOT EXPORT
══════════════════════════════════════════════════════════════════ */
export default function TalentPortal({ data, update, onFormateurAccess }) {
  const [talentUser, setTalentUser]           = useState(null);
  const [pendingOnboarding, setPendingOnboarding] = useState(null); // talentUser waiting for onboarding

  /* ── After register → go to onboarding before logging in ── */
  if (pendingOnboarding) {
    const participant = data.participants?.find(p => p.id === pendingOnboarding.participantId);
    return (
      <OnboardingTalent
        participant={participant}
        onComplete={(formData) => {
          // Dériver ctAutoEval depuis les réponses hbs du formulaire (mapping 1:1 par index)
          const ctFromForm = Array.isArray(formData.hbs) && formData.hbs.some(v => v != null)
            ? formData.hbs
            : null;

          update(prev => {
            const exists = prev.participants?.some(p => p.id === pendingOnboarding.participantId);
            if (exists) {
              return {
                ...prev,
                participants: prev.participants.map(p =>
                  p.id === pendingOnboarding.participantId
                    ? { ...p, ...formData, ctAutoEval: ctFromForm ?? p.ctAutoEval }
                    : p
                ),
              };
            }
            // New participant — build a full record from registration + questionnaire data
            const newParticipant = {
              id:              pendingOnboarding.participantId,
              nom:             pendingOnboarding.nom,
              prenom:          pendingOnboarding.prenom,
              email:           pendingOnboarding.email,
              competences:     {},
              hbsJeu:          null,
              dateInscription: new Date().toISOString().split('T')[0],
              tags:            [],
              sessions:        [],
              ...formData,
              ctAutoEval: ctFromForm,  // priorité sur ctAutoEval:null de formData
            };
            return {
              ...prev,
              participants: [...(prev.participants || []), newParticipant],
            };
          });
          setTalentUser(pendingOnboarding);
          setPendingOnboarding(null);
        }}
        onSkip={() => {
          // Even on skip, ensure the participant record exists for new users
          if (pendingOnboarding.isNew) {
            update(prev => {
              const exists = prev.participants?.some(p => p.id === pendingOnboarding.participantId);
              if (exists) return prev;
              const newParticipant = {
                id:              pendingOnboarding.participantId,
                nom:             pendingOnboarding.nom,
                prenom:          pendingOnboarding.prenom,
                email:           pendingOnboarding.email,
                competences:     {},
                hbsJeu:          null,
                ctAutoEval:      null,
                dateInscription: new Date().toISOString().split('T')[0],
                tags:            [],
                sessions:        [],
              };
              return { ...prev, participants: [...(prev.participants || []), newParticipant] };
            });
          }
          setTalentUser(pendingOnboarding);
          setPendingOnboarding(null);
        }}
      />
    );
  }

  /* ── Not logged in → show login / register ── */
  if (!talentUser) {
    return (
      <TalentLogin
        data={data}
        update={update}
        onLogin={setTalentUser}
        onRegister={setPendingOnboarding}
        onFormateurAccess={onFormateurAccess}
      />
    );
  }

  /* ── Logged in → show talent app ── */
  return (
    <TalentApp
      data={data}
      update={update}
      talentUser={talentUser}
      onLogout={() => setTalentUser(null)}
    />
  );
}
