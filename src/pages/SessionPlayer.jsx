import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import {
  X, Play, Pause, ChevronRight, ChevronLeft, List, Eye, Users,
  BookOpen, Clock, CheckCircle, AlertTriangle, Zap, Coffee,
  MessageSquare, BarChart2, Star, ArrowRight, Volume2, VolumeX,
} from 'lucide-react';

/* ── Rich text renderer ───────────────────────────────────────── */
// Rules (in priority order):
//  1. **text** → <strong>
//  2. Lines starting with ─── → bold separator
//  3. Lines starting with 2+ consecutive uppercase letters → bold header (THÈME, LES COMMANDES…)
//  4. Bullet • phrase : rest → • **phrase** : rest
//  5. Short header line (≤60 chars, starts with capital, no terminal punct, no article) → bold
function RichText({ text, className }) {
  if (!text) return null;

  const ARTICLE = /^(Le |La |Les |L['''']|Un |Une |Des |Du |Ce |Cette |Il |Elle |Ils |Elles |On |Nous |Vous |Au |Aux |En |Dans |Pour |Par |Sur |Avec |Sans |Depuis |Pendant |Avant |Après |Selon |Chaque |Tout |Toute )/i;

  const parseBold = (str) => {
    // Split on both **text** and → answer — patterns (quiz answers)
    const parts = str.split(/(\*\*.*?\*\*|→\s+.+?\s+[—–])/g);
    if (parts.length === 1) return str;
    return parts.map((p, j) => {
      if (j % 2 === 0) return p;
      if (p.startsWith('**') && p.endsWith('**'))
        return <strong key={j} className="font-semibold text-white">{p.slice(2, -2)}</strong>;
      // → answer — pattern
      const m = p.match(/^(→\s+)(.+?)(\s+[—–])$/);
      if (m)
        return <span key={j}>{m[1]}<strong className="font-semibold text-white">{m[2]}</strong>{m[3]}</span>;
      return p;
    });
  };

  const renderLine = (line, i) => {
    const t = line.trim();
    if (!t) return <span key={i}><br /></span>;

    let content;

    // 1. Separator ─── ... ───
    if (/^─{2,}/.test(t)) {
      content = <strong className="font-bold text-white/90">{t}</strong>;
    }
    // 2. Starts with 2+ uppercase letters = ALL CAPS header (THÈME 1, LES COMMANDES, etc.)
    else if (/^[A-ZÀÂÉÈÊËÎÔÛÙÜÇ]{2}/.test(t) && !t.startsWith('•')) {
      content = <strong className="font-bold text-white">{parseBold(t)}</strong>;
    }
    // 3. Bullet with colon: • Phrase key : description → • **Phrase key** : description
    else if (/^•\s+.+?:/.test(t)) {
      const m = t.match(/^(•\s+)(.{2,60}?)(\s*:)(.*)$/);
      if (m) {
        content = <>{m[1]}<strong className="font-semibold text-white">{m[2]}</strong>{m[3]}{parseBold(m[4])}</>;
      } else {
        content = parseBold(line);
      }
    }
    // 4. Short header: starts with capital, ≤60 chars, no terminal .!?,, not an article/connector
    else if (
      /^[A-ZÀÂÉÈÊËÎÔÛÙÜÇ]/.test(t) &&
      !t.startsWith('•') && !t.startsWith('→') && !t.startsWith('-') &&
      t.length <= 60 && !/[.!?,]$/.test(t) &&
      !ARTICLE.test(t) && !t.includes(' → ')
    ) {
      content = <strong className="font-semibold text-white/95">{parseBold(t)}</strong>;
    }
    else {
      content = parseBold(line);
    }

    return <span key={i}>{i > 0 && <br />}{content}</span>;
  };

  return (
    <div className={className}>
      {text.split('\n').map((line, i) => renderLine(line, i))}
    </div>
  );
}

/* ── Step type config ─────────────────────────────────────────── */
const STEP_TYPES = {
  intro:      { label: 'Introduction', icon: '👋', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  theory:     { label: 'Théorie',      icon: '📚', color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' },
  practice:   { label: 'Activité',     icon: '🎯', color: '#FF8650', bg: 'rgba(255,134,80,0.15)' },
  debrief:    { label: 'Débrief',      icon: '💬', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
  discussion: { label: 'Discussion',   icon: '🗣️', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  break:      { label: 'Pause',        icon: '☕', color: '#94A3B8', bg: 'rgba(148,163,184,0.15)' },
  conclusion: { label: 'Conclusion',   icon: '🏁', color: '#102C32', bg: 'rgba(16,44,50,0.15)'  },
  evaluation: { label: 'Évaluation',   icon: '⭐', color: '#FF8650', bg: 'rgba(255,134,80,0.15)' },
};

/* ── Generate steps from session + bareme ─────────────────────── */
function generateSteps(session, bareme) {
  if (session.steps?.length > 0) return session.steps;

  const steps = [
    {
      id: 'step_intro',
      type: 'intro',
      title: 'Accueil & Cadrage',
      duration: 10,
      content: `Accueillez les participants et posez le cadre de la session.\n\n• Tour de table rapide : prénom + une attente\n• Présentation des objectifs de la session\n• Règles de fonctionnement du groupe\n• Rappel du programme et des compétences travaillées`,
      participantActivity: 'Tour de table : chaque participant dit son prénom et une compétence qu\'il souhaite travailler aujourd\'hui.',
      observationPoints: ["Niveau d'énergie à l'arrivée", 'Participants qui se connaissent déjà', 'Questions ou appréhensions exprimées'],
    },
  ];

  if (bareme) {
    const ctCriteres = bareme.criteres.filter(c => c.section !== 'HBS' && !c.section?.startsWith('HBS'));
    const categories = [...new Set(ctCriteres.map(c => c.section).filter(Boolean))];

    categories.forEach((cat, i) => {
      const catLabel = cat.replace(/^CT\s*[—\-]\s*/, '');
      const criteres = ctCriteres.filter(c => c.section === cat);
      steps.push({
        id: `step_ct_${i}`,
        type: i % 2 === 0 ? 'practice' : 'discussion',
        title: `Activité — ${catLabel}`,
        duration: 20,
        content: `**Compétence ciblée : ${catLabel}**\n\nCritères observés pendant cette activité :\n${criteres.map(c => `• ${c.label}`).join('\n')}\n\n💡 Observez les comportements naturels — ne signalez pas ce que vous observez pour ne pas biaiser.`,
        participantActivity: `Activité de groupe centrée sur la compétence « ${catLabel} ». Les participants interagissent librement.`,
        observationPoints: criteres.map(c => c.label),
      });
    });

    const hbsCriteres = bareme.criteres.filter(c => c.section === 'HBS');
    if (hbsCriteres.length > 0) {
      steps.push({
        id: 'step_hbs',
        type: 'discussion',
        title: 'Observation HBS',
        duration: 15,
        content: `**Habiletés sociocognitives à observer :**\n${hbsCriteres.map(c => `• ${c.label}`).join('\n')}\n\n💡 Ces habiletés se révèlent dans les interactions — notez ce que vous observez sur votre fiche.`,
        participantActivity: 'Les participants interagissent librement. Le formateur observe et prend des notes discrètes.',
        observationPoints: hbsCriteres.map(c => c.label),
      });
    }
  }

  steps.push(
    {
      id: 'step_debrief',
      type: 'debrief',
      title: 'Débrief collectif',
      duration: 15,
      content: `**Animez le retour sur expérience :**\n\n• Qu'avez-vous observé chez vous et chez les autres ?\n• Quelles compétences ont été mobilisées ?\n• Qu'est-ce qui a été difficile ? Pourquoi ?\n• Qu'allez-vous retenir et appliquer ?`,
      participantActivity: 'Tour de table : chaque participant partage un apprentissage concret de la session.',
      observationPoints: ['Qualité de la réflexion individuelle', 'Capacité à nommer ses apprentissages', 'Ouverture au feedback'],
    },
    {
      id: 'step_eval',
      type: 'evaluation',
      title: 'Évaluation des participants',
      duration: 10,
      content: `La session touche à sa fin.\n\nCliquez sur **"Lancer l'évaluation"** pour accéder à la fiche de notation des participants avec le barème de la session.`,
      participantActivity: 'Fin de session — participants libres.',
      observationPoints: [],
    }
  );

  return steps;
}

/* ── Timer ring (SVG) ─────────────────────────────────────────── */
function TimerRing({ timeLeft, totalTime, isPaused }) {
  const r = 72;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, timeLeft / totalTime));
  const offset = circ * (1 - pct);
  const isWarn = timeLeft < 180 && timeLeft > 60;
  const isCrit = timeLeft <= 60;
  const stroke = isCrit ? '#EF4444' : isWarn ? '#F97316' : '#FF8650';

  return (
    <div className="relative flex items-center justify-center select-none">
      <svg width="180" height="180" className="-rotate-90" style={{ filter: 'drop-shadow(0 4px 24px rgba(0,0,0,0.25))' }}>
        <circle cx="90" cy="90" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
        <circle
          cx="90" cy="90" r={r} fill="none"
          stroke={stroke} strokeWidth="10"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: isPaused ? 'none' : 'stroke-dashoffset 1s linear, stroke 0.5s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-4xl font-bold tabular-nums ${isCrit ? 'text-red-400' : isWarn ? 'text-orange-300' : 'text-white'}`}>
          {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
        </span>
        <span className="text-xs text-white/50 mt-1">{isPaused ? '⏸ pause' : 'restant'}</span>
      </div>
    </div>
  );
}

/* ── Main component ───────────────────────────────────────────── */
export default function SessionPlayer({ data: dataProp }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: dataStore } = useStore();
  // Prefer the prop (in-memory, includes just-created sessions) over the store
  // which reads from localStorage and may not yet have the new session
  const data = dataProp || dataStore;

  const session = data.sessions?.find(s => s.id === id);
  const bareme  = session?.baremeId ? data.baremes?.find(b => b.id === session.baremeId) : null;
  const steps   = session ? generateSteps(session, bareme) : [];

  const [current,    setCurrent]    = useState(0);
  const [timeLeft,   setTimeLeft]   = useState((steps[0]?.duration || 10) * 60);
  const [isPaused,   setIsPaused]   = useState(false);
  const [expired,    setExpired]    = useState(false);
  const [showSteps,  setShowSteps]  = useState(false);
  const [showNotes,  setShowNotes]  = useState(true);
  const [sound,      setSound]      = useState(true);
  const [doneSteps,  setDoneSteps]  = useState(new Set());
  const intervalRef  = useRef(null);
  const audioRef     = useRef(null);
  const contentRef   = useRef(null);

  const step       = steps[current] || {};
  const typeConfig = STEP_TYPES[step.type] || STEP_TYPES.practice;
  const totalSecs  = (step.duration || 10) * 60;
  const totalMin   = steps.reduce((s, p) => s + (p.duration || 0), 0);
  const doneMin    = steps.slice(0, current).reduce((s, p) => s + (p.duration || 0), 0);
  const progressPct = steps.length > 1 ? (current / (steps.length - 1)) * 100 : 0;

  /* Timer ── */
  useEffect(() => {
    if (isPaused || expired) return;
    intervalRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(intervalRef.current);
          setExpired(true);
          if (sound) {
            try { new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAA...').play(); } catch {}
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [isPaused, expired, current, sound]);

  const goToStep = useCallback((idx) => {
    if (idx < 0 || idx >= steps.length) return;
    clearInterval(intervalRef.current);
    setDoneSteps(prev => new Set([...prev, current]));
    setCurrent(idx);
    setTimeLeft((steps[idx]?.duration || 10) * 60);
    setExpired(false);
    setIsPaused(false);
  }, [current, steps]);

  // Scroll to top after each step change
  useEffect(() => {
    window.scrollTo(0, 0);
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [current]);

  const goNext = useCallback(() => {
    if (current >= steps.length - 1) {
      navigate(`/evaluation/${id}`);
      return;
    }
    goToStep(current + 1);
  }, [current, steps.length, id, navigate, goToStep]);

  const goPrev = () => { if (current > 0) goToStep(current - 1); };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'n') goNext();
      if (e.key === 'ArrowLeft'  || e.key === 'p') goPrev();
      if (e.key === ' ') { e.preventDefault(); setIsPaused(p => !p); }
      if (e.key === 'Escape') navigate(`/sessions/${id}`);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [current, goNext]);

  if (!session) {
    return (
      <div className="min-h-screen bg-[#102C32] flex items-center justify-center text-white">
        <div className="text-center">
          <p className="text-lg mb-4">Session introuvable</p>
          <button onClick={() => navigate('/sessions')} className="underline opacity-70">Retour aux sessions</button>
        </div>
      </div>
    );
  }

  const isLastStep = current === steps.length - 1;

  return (
    <div className="h-screen flex flex-col bg-[#102C32] text-white overflow-hidden" style={{ background: 'linear-gradient(135deg, #102C32 0%, #1a3a42 50%, #0d2228 100%)' }}>

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 md:px-6 py-3 border-b border-white/10 flex-shrink-0">
        <button
          onClick={() => navigate(`/sessions/${id}`)}
          className="p-2 rounded-xl hover:bg-white/10 transition-all"
          title="Quitter (Echap)"
        >
          <X size={18} className="text-white/70" />
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-xs text-white/40 uppercase tracking-widest font-medium">Session en cours</p>
          <p className="text-sm font-semibold text-white truncate">{session.nom}</p>
        </div>

        <div className="hidden sm:flex items-center gap-3 text-xs text-white/40">
          <span>{doneMin + Math.round((totalSecs - timeLeft) / 60)} / {totalMin} min</span>
          <span>·</span>
          <span>Étape {current + 1} / {steps.length}</span>
        </div>

        <button
          onClick={() => setSound(s => !s)}
          className="p-2 rounded-xl hover:bg-white/10 transition-all text-white/50"
          title="Son"
        >
          {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>

        <button
          onClick={() => setShowSteps(s => !s)}
          className={`p-2 rounded-xl transition-all ${showSteps ? 'bg-white/15 text-white' : 'hover:bg-white/10 text-white/50'}`}
          title="Plan de session"
        >
          <List size={16} />
        </button>
      </div>

      {/* ── Progress bar ─────────────────────────────────────────── */}
      <div className="h-1 bg-white/10 flex-shrink-0">
        <div
          className="h-full transition-all duration-700"
          style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg, #FF8650, #ffb347)' }}
        />
      </div>

      {/* ── Main layout ──────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* ── Step list drawer ─────────────────────────────────── */}
        <div className={`absolute inset-y-0 right-0 z-30 w-72 bg-[#0d2228]/95 backdrop-blur-md border-l border-white/10 flex flex-col transition-transform duration-300 ${showSteps ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <span className="text-sm font-semibold">Plan de session</span>
            <button onClick={() => setShowSteps(false)} className="p-1 hover:bg-white/10 rounded-lg"><X size={14} /></button>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {steps.map((s, i) => {
              const tc = STEP_TYPES[s.type] || STEP_TYPES.practice;
              const isDone = doneSteps.has(i) || i < current;
              const isCur  = i === current;
              return (
                <button
                  key={s.id}
                  onClick={() => { goToStep(i); setShowSteps(false); }}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-all hover:bg-white/10 ${isCur ? 'bg-white/10 border-l-2 border-[#FF8650]' : ''}`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5 ${isDone ? 'bg-green-500' : isCur ? 'bg-[#FF8650]' : 'bg-white/10'}`}>
                    {isDone ? <CheckCircle size={12} /> : isCur ? <Play size={10} fill="white" /> : <span className="text-[10px] font-bold">{i + 1}</span>}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs font-medium truncate ${isCur ? 'text-white' : 'text-white/70'}`}>{s.title}</p>
                    <p className="text-[10px] text-white/30 mt-0.5">{tc.label} · {s.duration} min</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Content area ─────────────────────────────────────── */}
        <div ref={contentRef} className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 md:py-8">

            {/* Step badge + title */}
            <div className="flex items-center gap-3 mb-6">
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{ background: typeConfig.bg, color: typeConfig.color, border: `1px solid ${typeConfig.color}40` }}
              >
                <span>{typeConfig.icon}</span>
                <span>{typeConfig.label}</span>
              </div>
              <span className="text-xs text-white/30">{current + 1} / {steps.length}</span>
            </div>

            <h1 className="text-2xl md:text-3xl font-bold text-white mb-8 leading-tight">
              {step.title}
            </h1>

            {/* Timer */}
            <div className="flex justify-center mb-8">
              <div className="relative">
                <TimerRing timeLeft={timeLeft} totalTime={totalSecs} isPaused={isPaused} />
                {expired && (
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <span className="text-xs text-red-400 animate-pulse font-medium">⏰ Temps écoulé</span>
                  </div>
                )}
              </div>
            </div>

            {/* Step type: break → simple message */}
            {step.type === 'break' ? (
              <div className="text-center py-8 text-white/50">
                <span className="text-5xl">☕</span>
                <p className="mt-3 text-lg">Pause — profitez-en !</p>
              </div>
            ) : (
              <div className="space-y-4">

                {/* Instructions formateur */}
                {step.content && (
                  <div className="rounded-2xl p-4 md:p-5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <BookOpen size={14} className="text-[#FF8650]" />
                      <span className="text-xs font-semibold text-[#FF8650] uppercase tracking-widest">Consignes formateur</span>
                    </div>
                    <RichText text={step.content} className="text-sm text-white/80 leading-relaxed" />
                  </div>
                )}

                {/* Activité participants */}
                {step.participantActivity && (
                  <div className="rounded-2xl p-4 md:p-5" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <Users size={14} className="text-emerald-400" />
                      <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Activité participants</span>
                    </div>
                    <RichText text={step.participantActivity} className="text-sm text-white/80 leading-relaxed" />
                  </div>
                )}

                {/* Points d'observation */}
                {step.observationPoints?.length > 0 && (
                  <div className="rounded-2xl p-4 md:p-5" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <Eye size={14} className="text-violet-400" />
                      <span className="text-xs font-semibold text-violet-400 uppercase tracking-widest">Points d'observation</span>
                    </div>
                    <ul className="space-y-1.5">
                      {step.observationPoints.map((pt, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                          <span className="text-violet-400 mt-1 flex-shrink-0">•</span>
                          {pt}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* CTA évaluation */}
                {step.type === 'evaluation' && (
                  <button
                    onClick={() => navigate(`/evaluation/${id}`)}
                    className="w-full py-4 rounded-2xl text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-95"
                    style={{ background: 'linear-gradient(135deg, #FF8650, #ff6b35)' }}
                  >
                    <Star size={16} />
                    Lancer l'évaluation des participants
                    <ArrowRight size={16} />
                  </button>
                )}
              </div>
            )}

            {/* Keyboard hints */}
            <div className="hidden md:flex items-center justify-center gap-6 mt-10 text-[10px] text-white/20">
              <span>← → naviguer</span>
              <span>· Espace pause</span>
              <span>· Echap quitter</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom controls ──────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-white/10 px-4 md:px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">

          <button
            onClick={goPrev}
            disabled={current === 0}
            className="flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10 text-white/70"
          >
            <ChevronLeft size={16} />
            <span className="hidden sm:inline">Précédent</span>
          </button>

          <div className="flex-1" />

          <button
            onClick={() => setIsPaused(p => !p)}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-medium transition-all"
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
          >
            {isPaused ? <><Play size={15} fill="currentColor" /> <span>Reprendre</span></> : <><Pause size={15} /> <span>Pause</span></>}
          </button>

          <div className="flex-1" />

          <button
            onClick={goNext}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
            style={{
              background: isLastStep
                ? 'linear-gradient(135deg, #FF8650, #ff6b35)'
                : 'rgba(255,255,255,0.1)',
              border: isLastStep ? 'none' : '1px solid rgba(255,255,255,0.15)',
            }}
          >
            {isLastStep ? (
              <><Star size={15} /> <span>Évaluer</span> <ArrowRight size={15} /></>
            ) : (
              <><span className="hidden sm:inline">Suivant</span> <ChevronRight size={16} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
