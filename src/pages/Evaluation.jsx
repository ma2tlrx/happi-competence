import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Save, Check, ChevronDown, ChevronUp, CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════
   MAPPING HBS label → index dans participant.hbsJeu (15 valeurs)
   Correspond aux HBS_KEYS de initialData.js
═══════════════════════════════════════════════════════════════════════ */
const HBS_LABEL_TO_INDEX = {
  'sensibilité sociale':           0,   // Bon relationnel
  'adaptation relationnelle':      3,   // Adaptabilité
  'coopération':                   1,   // Esprit d'équipe
  'raisonnement logique':          10,  // Analyse des problèmes
  'planification':                 4,   // Gestion des priorités
  'arbitrage':                     7,   // Force de proposition
  "traitement de l'information":   2,   // Compréhension
  'synthèse':                      11,  // Curiosité
  'conceptualisation':             14,  // Polyvalence
  'flexibilité mentale':           13,  // Respect des délais
  'projection':                    12,  // Autonomie
  'approche globale':              14,  // Polyvalence
  'auto-évaluation':               9,   // Implication
  'auto-régulation':               5,   // Gestion du stress
  'auto-organisation':             8,   // Organisation
  'auto-mobilisation':             6,   // Leadership
};

/* ═══════════════════════════════════════════════════════════════════════
   CONSTANTES HBS — descriptions des 4 niveaux pour chaque habilité
═══════════════════════════════════════════════════════════════════════ */
const HBS_DESCRIPTIONS = {
  'Sensibilité sociale': [
    'Détecte parfois les émotions des autres.',
    'Réagit à certaines émotions identifiées.',
    'Adapte son comportement aux besoins émotionnels des autres.',
    'Capte et régule activement les dynamiques émotionnelles du groupe.',
  ],
  'Adaptation relationnelle': [
    "S'adapte difficilement à un interlocuteur différent.",
    'Ajuste partiellement son attitude selon la situation.',
    'Change volontairement de registre pour fluidifier la relation.',
    'Adapte et module son comportement avec aisance dans tout contexte social.',
  ],
  'Coopération': [
    'Coopère si sollicité directement.',
    'Participe activement quand les règles sont claires.',
    "S'implique spontanément et soutient les autres.",
    "Favorise la cohésion et optimise l'efficacité collective.",
  ],
  'Planification': [
    'Organise ses actions immédiates.',
    'Planifie des étapes simples et connues.',
    'Structure des séquences complètes de manière réaliste.',
    'Anticipe et ajuste la planification dans des contextes dynamiques.',
  ],
  "Traitement de l'information": [
    'Capte partiellement les informations.',
    'Comprend et applique les infos dans un cadre simple.',
    'Analyse et interprète correctement dans la plupart des cas.',
    "Traite, hiérarchise et transmet les informations avec clarté à l'équipe.",
  ],
};

const HBS_LEVEL_NAMES = ['Aptitude', 'Acquisition', 'Maîtrise', 'Excellence'];

const LEVEL_CFG = {
  Aptitude:    { bg: 'bg-slate-100',   text: 'text-slate-600',   border: 'border-slate-300',   ring: 'ring-2 ring-slate-400'    },
  Acquisition: { bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-300',   ring: 'ring-2 ring-amber-500'    },
  Maîtrise:    { bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-300',    ring: 'ring-2 ring-blue-500'     },
  Excellence:  { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', ring: 'ring-2 ring-emerald-500'  },
};

/* Palette couleurs pour les catégories CT (jusqu'à 5 catégories) */
const CT_PALETTE = [
  {
    color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200',
    dot: 'bg-violet-500', checked: 'bg-violet-500 border-violet-500',
    score: 'bg-violet-600 text-white',
  },
  {
    color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200',
    dot: 'bg-blue-500', checked: 'bg-blue-500 border-blue-500',
    score: 'bg-blue-600 text-white',
  },
  {
    color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200',
    dot: 'bg-emerald-500', checked: 'bg-emerald-500 border-emerald-500',
    score: 'bg-emerald-600 text-white',
  },
  {
    color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200',
    dot: 'bg-amber-500', checked: 'bg-amber-500 border-amber-500',
    score: 'bg-amber-600 text-white',
  },
  {
    color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200',
    dot: 'bg-rose-500', checked: 'bg-rose-500 border-rose-500',
    score: 'bg-rose-600 text-white',
  },
];

/* ═══════════════════════════════════════════════════════════════════════
   SOUS-COMPOSANTS
═══════════════════════════════════════════════════════════════════════ */

/** Checkbox visuelle pour un critère CT */
function CriterionCheck({ checked, checkedClass }) {
  return (
    <div className={[
      'w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all duration-150',
      checked ? `${checkedClass} scale-110 shadow-sm` : 'border-slate-300 bg-white',
    ].join(' ')}>
      {checked && <Check size={13} className="text-white" strokeWidth={3} />}
    </div>
  );
}

/** Sélecteur de niveau HBS dépliable */
function SocioLevelPicker({ critere, value, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const descriptions = HBS_DESCRIPTIONS[critere.label] ||
    HBS_LEVEL_NAMES.map((_, i) => `Niveau ${i + 1}`);

  const currentLevel = value > 0 ? HBS_LEVEL_NAMES[value - 1] : null;
  const currentCfg   = currentLevel ? LEVEL_CFG[currentLevel] : null;

  return (
    <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white">
      {/* En-tête cliquable */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-800 text-sm">{critere.label}</span>
          {currentLevel ? (
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${currentCfg.bg} ${currentCfg.text}`}>
              {currentLevel}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-400">Non évalué</span>
          )}
        </div>
        {expanded
          ? <ChevronUp size={16} className="text-slate-400 flex-shrink-0" />
          : <ChevronDown size={16} className="text-slate-400 flex-shrink-0" />}
      </button>

      {/* Grille des 4 niveaux */}
      {expanded && (
        <div className="p-3 bg-slate-50 border-t border-slate-100 grid grid-cols-2 gap-2">
          {HBS_LEVEL_NAMES.map((level, idx) => {
            const cfg        = LEVEL_CFG[level];
            const isSelected = value === idx + 1;
            return (
              <button
                key={level}
                onClick={() => { onChange(value === idx + 1 ? 0 : idx + 1); setExpanded(false); }}
                className={[
                  'p-3 rounded-xl border-2 text-left transition-all duration-150',
                  isSelected
                    ? `${cfg.bg} ${cfg.border} ${cfg.text} ${cfg.ring}`
                    : 'bg-white border-slate-200 hover:border-slate-300',
                ].join(' ')}
              >
                <p className={`text-xs font-black mb-1 ${isSelected ? cfg.text : 'text-slate-500'}`}>
                  {idx + 1} — {level}
                </p>
                <p className={`text-[11px] leading-snug ${isSelected ? cfg.text : 'text-slate-400'}`}>
                  {descriptions[idx]}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
═══════════════════════════════════════════════════════════════════════ */
export default function Evaluation({ data, update }) {
  const { sessionId } = useParams();
  const navigate      = useNavigate();

  /* ── Données de base ── */
  const session = data.sessions?.find(s => s.id === sessionId);

  const sessionParticipants = (session?.participants || [])
    .map(pid => data.participants?.find(p => p.id === pid))
    .filter(Boolean);

  /* ── Barème de la session ── */
  const bareme = (data.baremes || []).find(b => b.id === session?.baremeId) || null;
  const isSessionBareme = bareme?.type === 'Session';

  /* ── Catégories CT extraites du barème ── */
  const ctCategories = (() => {
    if (!isSessionBareme) return [];
    const ctCriteres = bareme.criteres.filter(c => !c.noteMax);
    const groups = {};
    const order  = [];
    ctCriteres.forEach(c => {
      const name = (c.section || '').replace('CT — ', '') || 'Général';
      if (!groups[name]) { groups[name] = []; order.push(name); }
      groups[name].push(c);
    });
    return order.map((name, idx) => ({
      name,
      criteres: groups[name],
      colors: CT_PALETTE[idx % CT_PALETTE.length],
    }));
  })();

  /* ── Critères HBS extraits du barème ── */
  const hbsCriteres = isSessionBareme
    ? bareme.criteres.filter(c => c.noteMax === 4)
    : [];

  /* ── État évaluation ── */
  const [selectedPid, setSelectedPid] = useState(sessionParticipants[0]?.id || '');

  const [ctChecked, setCtChecked] = useState(() => {
    const existing = data.evaluations?.[sessionId] || {};
    const init = {};
    sessionParticipants.forEach(p => {
      init[p.id] = existing[p.id]?.ctChecked || {};
    });
    return init;
  });

  const [hbsScores, setHbsScores] = useState(() => {
    const existing = data.evaluations?.[sessionId] || {};
    const init = {};
    sessionParticipants.forEach(p => {
      init[p.id] = existing[p.id]?.hbsScores || {};
    });
    return init;
  });

  const [savedPids, setSavedPids]   = useState(new Set());
  const [showSaved, setShowSaved]   = useState(false);

  /* ── Helpers ── */
  const isChecked   = (pid, cId) => ctChecked[pid]?.[cId] ?? false;
  const toggleCheck = (pid, cId) =>
    setCtChecked(prev => ({
      ...prev,
      [pid]: { ...prev[pid], [cId]: !prev[pid]?.[cId] },
    }));

  const getHbs = (pid, cId)      => hbsScores[pid]?.[cId] ?? 0;
  const setHbs = (pid, cId, v)   =>
    setHbsScores(prev => ({
      ...prev,
      [pid]: { ...prev[pid], [cId]: v },
    }));

  const getCatScore     = (pid, cat) => cat.criteres.filter(c => isChecked(pid, c.id)).length;
  const countCtChecked  = (pid) => ctCategories.flatMap(c => c.criteres).filter(c => isChecked(pid, c.id)).length;
  const countHbsFilled  = (pid) => hbsCriteres.filter(c => getHbs(pid, c.id) > 0).length;
  const totalItems      = ctCategories.flatMap(c => c.criteres).length + hbsCriteres.length;

  const ctAvgStr = (pid) => {
    if (!ctCategories.length) return '—';
    const total = ctCategories.reduce((s, cat) => s + getCatScore(pid, cat), 0);
    return (total / ctCategories.length).toFixed(1);
  };
  const hbsAvgStr = (pid) => {
    const scores = hbsCriteres.map(c => getHbs(pid, c.id)).filter(s => s > 0);
    return scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '—';
  };

  /* ── Enregistrement ── */
  const handleSave = () => {
    const newEvals = {};
    sessionParticipants.forEach(p => {
      newEvals[p.id] = {
        ctChecked:  ctChecked[p.id]  || {},
        hbsScores:  hbsScores[p.id] || {},
        ctAvg:      parseFloat(ctAvgStr(p.id))  || 0,
        hbsAvg:     parseFloat(hbsAvgStr(p.id)) || 0,
      };
    });

    update(prev => {
      // 1. Mettre à jour les évaluations
      const updatedEvals = { ...prev.evaluations, [sessionId]: newEvals };

      // 2. Propager les scores vers participant.competences et participant.hbsJeu
      const sessionPidSet = new Set(sessionParticipants.map(p => p.id));
      const updatedParticipants = (prev.participants || []).map(p => {
        if (!sessionPidSet.has(p.id)) return p;
        const pid = p.id;

        // CT → competences : score par catégorie = nb critères cochés (0–5)
        const newCompetences = { ...(p.competences || {}) };
        ctCategories.forEach(cat => {
          newCompetences[cat.name] = getCatScore(pid, cat);
        });

        // HBS → hbsJeu : mise à jour ciblée des indices évalués dans cette session
        const hbsArr = p.hbsJeu ? [...p.hbsJeu] : new Array(15).fill(null);
        hbsCriteres.forEach(c => {
          const score = getHbs(pid, c.id);
          const idx   = HBS_LABEL_TO_INDEX[c.label.toLowerCase()];
          if (idx !== undefined && score > 0) hbsArr[idx] = score;
        });

        return { ...p, competences: newCompetences, hbsJeu: hbsArr };
      });

      return {
        ...prev,
        evaluations:  updatedEvals,
        participants: updatedParticipants,
      };
    });

    setSavedPids(prev => new Set([...prev, selectedPid]));
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2500);
  };

  /* ── Session introuvable ── */
  if (!session) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500">Session introuvable</p>
        <button onClick={() => navigate('/sessions')} className="btn-primary mx-auto mt-4">Retour</button>
      </div>
    );
  }

  /* ── Pas de barème Session assigné ── */
  if (!isSessionBareme) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/sessions/${sessionId}`)}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Fiche de notation</h2>
            <p className="text-sm text-slate-500">{session.nom}</p>
          </div>
        </div>
        <div className="card text-center py-16 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto">
            <SlidersHorizontal size={24} className="text-slate-400" />
          </div>
          <div>
            <p className="font-semibold text-slate-700 mb-1">Aucun barème de session assigné</p>
            <p className="text-sm text-slate-400 max-w-xs mx-auto">
              Pour accéder à la fiche de notation, assigne un barème de type <strong>Session</strong> à cette session depuis la page Sessions.
            </p>
          </div>
          <button onClick={() => navigate(`/sessions/${sessionId}`)} className="btn-secondary mx-auto">
            Retour à la session
          </button>
        </div>
      </div>
    );
  }

  /* ── Aucun participant ── */
  if (sessionParticipants.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/sessions/${sessionId}`)}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-all">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-lg font-semibold text-slate-800">Fiche de notation — {session.nom}</h2>
        </div>
        <div className="card text-center py-16">
          <p className="text-slate-400">Aucun participant dans cette session</p>
        </div>
      </div>
    );
  }

  const selectedP    = sessionParticipants.find(p => p.id === selectedPid);
  const filledCount  = countCtChecked(selectedPid) + countHbsFilled(selectedPid);
  const fillPercent  = totalItems > 0 ? (filledCount / totalItems) * 100 : 0;

  return (
    <div className="space-y-0 -m-4 md:-m-6">
      {/* ══ HEADER sticky ══════════════════════════════════════════════ */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-100"
        style={{ boxShadow: '0 1px 8px rgba(16,44,50,0.06)' }}>

        {/* Titre + actions */}
        <div className="flex items-center gap-3 px-4 md:px-6 py-3">
          <button
            onClick={() => navigate(`/sessions/${sessionId}`)}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-happi-teal truncate">Fiche de notation</h2>
            <p className="text-xs text-slate-400 truncate">{session.nom}</p>
          </div>
          {showSaved && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">
              <CheckCircle2 size={13} /> Sauvegardé
            </span>
          )}
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #102C32, #1A3F48)', boxShadow: '0 2px 8px rgba(16,44,50,0.25)' }}
          >
            <Save size={15} /> Enregistrer
          </button>
        </div>

        {/* Onglets participants */}
        <div className="flex gap-2 px-4 md:px-6 pb-3 overflow-x-auto no-scrollbar">
          {sessionParticipants.map(p => {
            const filled   = countCtChecked(p.id) + countHbsFilled(p.id);
            const isSaved  = savedPids.has(p.id);
            const isActive = selectedPid === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedPid(p.id)}
                className={[
                  'flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-bold transition-all',
                  isActive
                    ? 'border-happi-orange bg-happi-orange text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-happi-orange/40',
                ].join(' ')}
              >
                {isSaved && <CheckCircle2 size={13} className={isActive ? 'text-white/70' : 'text-emerald-500'} />}
                {p.prenom} {p.nom?.charAt(0)}.
                {filled > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${isActive ? 'bg-white/20 text-white' : 'bg-happi-orange-light text-happi-orange'}`}>
                    {filled}/{totalItems}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ══ CONTENU PRINCIPAL ════════════════════════════════════════════ */}
      <div className="px-4 md:px-6 py-6 pb-32 space-y-8 max-w-3xl">

        {/* Carte résumé participant */}
        {selectedP && (
          <div className="bg-white rounded-2xl p-4 border border-slate-100 flex items-center gap-4"
            style={{ boxShadow: '0 2px 12px rgba(16,44,50,0.06)' }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold flex-shrink-0 text-lg"
              style={{ background: 'linear-gradient(135deg, #FF8650, #ff6a2f)' }}>
              {selectedP.prenom?.[0]}{selectedP.nom?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-happi-teal truncate">{selectedP.prenom} {selectedP.nom}</p>
              <p className="text-xs text-slate-400">{selectedP.age}{selectedP.age && selectedP.residence ? ' · ' : ''}{selectedP.residence}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[10px] text-slate-400 mb-0.5">CT moy.</p>
              <p className="font-black text-violet-600 text-lg leading-none">
                {ctAvgStr(selectedPid)}<span className="text-slate-300 font-normal text-sm">/5</span>
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[10px] text-slate-400 mb-0.5">HBS moy.</p>
              <p className="font-black text-emerald-600 text-lg leading-none">
                {hbsAvgStr(selectedPid)}<span className="text-slate-300 font-normal text-sm">/4</span>
              </p>
            </div>
          </div>
        )}

        {/* ══ SECTION 1 — Compétences Transversales ══════════════════ */}
        <section>
          {/* Titre de section */}
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 bg-slate-200" />
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-black"
                style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' }}>CT</span>
              <span className="text-sm font-black text-slate-700 uppercase tracking-wide">Compétences Transversales</span>
            </div>
            <div className="h-px flex-1 bg-slate-200" />
          </div>
          <p className="text-xs text-center text-slate-400 mb-5">
            Cochez les critères observés — le score par catégorie = nombre de critères cochés (0 à 5)
          </p>

          <div className="space-y-5">
            {ctCategories.map(cat => {
              const catScore = getCatScore(selectedPid, cat);
              const { colors } = cat;
              return (
                <div key={cat.name} className={`rounded-2xl border ${colors.border} overflow-hidden`}>
                  {/* En-tête catégorie */}
                  <div className={`${colors.bg} px-4 py-3 flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                      <h3 className={`font-black text-sm ${colors.color}`}>{cat.name}</h3>
                      <span className={`text-[10px] ${colors.color} opacity-60`}>({cat.criteres.length} critères)</span>
                    </div>
                    <span className={`text-sm font-black px-3 py-1 rounded-xl ${catScore > 0 ? colors.score : 'bg-white text-slate-400'}`}>
                      {catScore}/{cat.criteres.length}
                    </span>
                  </div>

                  {/* Liste des critères */}
                  <div className="bg-white divide-y divide-slate-50">
                    {cat.criteres.map(item => {
                      const checked = isChecked(selectedPid, item.id);
                      return (
                        <button
                          key={item.id}
                          onClick={() => toggleCheck(selectedPid, item.id)}
                          className={`w-full px-4 py-3.5 flex items-center gap-3 text-left transition-colors ${checked ? colors.bg + ' bg-opacity-40' : 'hover:bg-slate-50'}`}
                        >
                          <CriterionCheck checked={checked} checkedClass={colors.checked} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold ${checked ? colors.color : 'text-slate-800'}`}>
                              {item.label}
                            </p>
                            {item.description && (
                              <p className="text-xs text-slate-400 leading-snug mt-0.5">{item.description}</p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ══ SECTION 2 — Habiletés Sociocognitives ══════════════════ */}
        {hbsCriteres.length > 0 && (
          <section>
            {/* Titre de section */}
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-slate-200" />
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-9 h-7 rounded-full text-white text-xs font-black"
                  style={{ background: 'linear-gradient(135deg, #059669, #10B981)' }}>HBS</span>
                <span className="text-sm font-black text-slate-700 uppercase tracking-wide">Habiletés Sociocognitives</span>
              </div>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            {/* Légende des niveaux */}
            <div className="grid grid-cols-4 gap-1.5 mb-5">
              {HBS_LEVEL_NAMES.map((level, i) => {
                const cfg = LEVEL_CFG[level];
                return (
                  <div key={level} className={`rounded-xl p-2 text-center ${cfg.bg} border ${cfg.border}`}>
                    <p className={`text-lg font-black ${cfg.text}`}>{i + 1}</p>
                    <p className={`text-[10px] font-bold ${cfg.text}`}>{level}</p>
                  </div>
                );
              })}
            </div>

            {/* Sélecteurs de niveau */}
            <div className="space-y-2">
              {hbsCriteres.map(critere => (
                <SocioLevelPicker
                  key={critere.id}
                  critere={critere}
                  value={getHbs(selectedPid, critere.id)}
                  onChange={v => setHbs(selectedPid, critere.id, v)}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ══ BARRE DE PROGRESSION FIXE EN BAS ═══════════════════════════ */}
      <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-white border-t border-slate-100 px-4 py-3 pb-safe-bottom z-20"
        style={{ boxShadow: '0 -2px 12px rgba(16,44,50,0.06)' }}>
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <div className="flex-1">
            <p className="text-xs text-slate-500 mb-1">
              <span className="font-bold text-slate-700">{filledCount}</span> / {totalItems} critères renseignés
            </p>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${fillPercent}%`,
                  background: 'linear-gradient(90deg, #FF8650, #ff6a2f)',
                }}
              />
            </div>
          </div>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #102C32, #1A3F48)', boxShadow: '0 2px 8px rgba(16,44,50,0.25)' }}
          >
            <Save size={15} /> Sauvegarder
          </button>
        </div>
      </div>
    </div>
  );
}
