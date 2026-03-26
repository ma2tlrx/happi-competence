import { useState } from 'react';
import {
  Plus, SlidersHorizontal, Trash2, Copy, Edit2, X, ChevronRight,
  Check, ArrowLeft, AlertCircle, Star, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  CT_LEVELS, CT_LEVELS_COLOR, CT_COMPETENCES_FULL,
  HBS_LEVELS, HBS_LEVELS_COLOR, HBS_COMPETENCES_FULL,
} from '../data/competences';

/* ══ Config & palettes ════════════════════════════════════════════════ */

const TYPE_CONFIG = {
  'CT':             { label: 'CT',             color: '#FF8650', bg: '#FFF1EB' },
  'HBS':            { label: 'HBS',            color: '#7C3AED', bg: '#F5F3FF' },
  'Comportemental': { label: 'Comportemental', color: '#3B82F6', bg: '#EFF6FF' },
  'Technique':      { label: 'Technique',      color: '#10B981', bg: '#ECFDF5' },
  'Personnalisé':   { label: 'Personnalisé',   color: '#F59E0B', bg: '#FFFBEB' },
  'Session':        { label: 'Session',        color: '#EC4899', bg: '#FDF2F8' },
};

const CT_PALETTE = [
  { color: 'text-violet-700', bg: 'bg-violet-50',   border: 'border-violet-200',  dot: 'bg-violet-500'  },
  { color: 'text-blue-700',   bg: 'bg-blue-50',     border: 'border-blue-200',    dot: 'bg-blue-500'    },
  { color: 'text-emerald-700',bg: 'bg-emerald-50',  border: 'border-emerald-200', dot: 'bg-emerald-500' },
  { color: 'text-amber-700',  bg: 'bg-amber-50',    border: 'border-amber-200',   dot: 'bg-amber-500'   },
  { color: 'text-rose-700',   bg: 'bg-rose-50',     border: 'border-rose-200',    dot: 'bg-rose-500'    },
];

const HBS_LEVEL_CFG = {
  Aptitude:    { bg: 'bg-slate-100',   text: 'text-slate-600',   border: 'border-slate-300'   },
  Acquisition: { bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-300'   },
  Maîtrise:    { bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-300'    },
  Excellence:  { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
};

const EMPTY_FORM = {
  nom: '', description: '', type: 'Personnalisé', noteMax: 5,
  echelle: [
    { valeur: 1, label: 'Insuffisant',  color: '#EF4444' },
    { valeur: 2, label: 'En progrès',   color: '#F97316' },
    { valeur: 3, label: 'Satisfaisant', color: '#3B82F6' },
    { valeur: 4, label: 'Bien',         color: '#10B981' },
    { valeur: 5, label: 'Excellent',    color: '#7C3AED' },
  ],
};

/* ══ Micro-composants ═════════════════════════════════════════════════ */

function TypeBadge({ type }) {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG['Personnalisé'];
  return (
    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full"
      style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

function SectionDivider({ badge, badgeColor, label }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="h-px flex-1 bg-slate-200" />
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center px-2 h-6 rounded-full text-white text-xs font-black"
          style={{ background: badgeColor }}>
          {badge}
        </span>
        <span className="text-sm font-black text-slate-700 uppercase tracking-wide">{label}</span>
      </div>
      <div className="h-px flex-1 bg-slate-200" />
    </div>
  );
}

function CTCategoryBlock({ name, criteres, colors }) {
  return (
    <div className={`rounded-2xl border ${colors.border} overflow-hidden`}>
      <div className={`${colors.bg} px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
          <h3 className={`font-black text-sm ${colors.color}`}>{name}</h3>
          <span className={`text-[10px] ${colors.color} opacity-60`}>({criteres.length} critères)</span>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${colors.color} opacity-60`}>/{criteres.length}</span>
      </div>
      <div className="bg-white divide-y divide-slate-50">
        {criteres.map((c, i) => (
          <div key={c.id || i} className="px-4 py-3 flex items-center gap-3">
            <div className="w-5 h-5 rounded-md border-2 border-slate-200 bg-white flex-shrink-0" />
            <p className="text-sm text-slate-700">{c.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function HBSLevelLegend() {
  return (
    <div className="grid grid-cols-4 gap-1.5 mb-4">
      {HBS_LEVELS.map((l, i) => {
        const cfg = HBS_LEVEL_CFG[l];
        return (
          <div key={l} className={`rounded-xl p-2 text-center ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
            <div className="text-base font-black">{i + 1}</div>
            <div className="text-xs font-bold leading-tight">{l}</div>
          </div>
        );
      })}
    </div>
  );
}

function HBSRow({ label }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition-colors text-left">
        <span className="font-bold text-slate-800 text-sm">{label}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-bold text-slate-400">/4</span>
          {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
        </div>
      </button>
      {open && (
        <div className="p-3 bg-slate-50 border-t border-slate-100 grid grid-cols-2 gap-2">
          {HBS_LEVELS.map((level, idx) => {
            const cfg = HBS_LEVEL_CFG[level];
            return (
              <div key={level} className={`p-3 rounded-xl border-2 ${cfg.bg} ${cfg.border} ${cfg.text} text-left`}>
                <p className={`text-xs font-black mb-0.5 ${cfg.text}`}>{idx + 1} — {level}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Vue détaillée d'un barème (dépliée) ─────────────────────────────── */
function BaremeDetail({ bar }) {
  const isSession = bar.type === 'Session';

  if (isSession) {
    const ctCriteres = bar.criteres.filter(c => !c.noteMax);
    const groups = {};
    const order = [];
    ctCriteres.forEach(c => {
      const name = (c.section || '').replace('CT — ', '') || 'Général';
      if (!groups[name]) { groups[name] = []; order.push(name); }
      groups[name].push(c);
    });
    const ctCategories = order.map((name, idx) => ({ name, criteres: groups[name], colors: CT_PALETTE[idx % CT_PALETTE.length] }));
    const hbsCriteres = bar.criteres.filter(c => c.noteMax === 4);

    return (
      <div className="space-y-8 pt-5">
        {ctCategories.length > 0 && (
          <div>
            <SectionDivider badge="CT" badgeColor="#7C3AED" label="Compétences Transversales" />
            <p className="text-xs text-center text-slate-400 mb-5">
              Critères cochables lors de l'évaluation — score = nombre de critères observés
            </p>
            <div className="space-y-4">
              {ctCategories.map(cat => <CTCategoryBlock key={cat.name} {...cat} />)}
            </div>
          </div>
        )}
        {hbsCriteres.length > 0 && (
          <div>
            <SectionDivider badge="HBS" badgeColor="#10B981" label="Habiletés Sociocognitives" />
            <HBSLevelLegend />
            <div className="space-y-2">
              {hbsCriteres.map(c => <HBSRow key={c.id} label={c.label} />)}
            </div>
          </div>
        )}
      </div>
    );
  }

  const cfg = TYPE_CONFIG[bar.type] || TYPE_CONFIG['Personnalisé'];
  return (
    <div className="space-y-4 pt-5">
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${bar.echelle.slice(0, bar.noteMax).length}, 1fr)` }}>
        {bar.echelle.slice(0, bar.noteMax).map(e => (
          <div key={e.valeur} className="flex flex-col items-center gap-1">
            <div className="w-full h-2 rounded-full" style={{ background: e.color }} />
            <span className="text-[10px] text-slate-400 font-medium text-center leading-tight">{e.valeur} — {e.label}</span>
          </div>
        ))}
      </div>
      <div className="rounded-2xl overflow-hidden border" style={{ borderColor: cfg.color + '40' }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ background: cfg.bg }}>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: cfg.color }} />
            <h3 className="font-black text-sm" style={{ color: cfg.color }}>{bar.nom}</h3>
            <span className="text-[10px] opacity-60" style={{ color: cfg.color }}>({bar.criteres.length} critères)</span>
          </div>
          <span className="text-xs font-bold" style={{ color: cfg.color }}>/{bar.noteMax}</span>
        </div>
        <div className="bg-white divide-y divide-slate-50">
          {bar.criteres.map((c, i) => (
            <div key={c.id || i} className="px-4 py-3 flex items-center justify-between gap-3">
              <p className="text-sm text-slate-700">{c.label}</p>
              <span className="text-xs text-slate-400 flex-shrink-0 font-medium">×{c.coefficient}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Sélecteur compétences CT / HBS (composant unifié) ────────────────── */
function CompetenceSelector({
  criteres, setCriteres, levels, levelsColor,
  itemLabel, totalCount,
  expandedId, setExpandedId,
  updateDescription, toggleSelected, updateCoeff,
  showCoeff = false,
}) {
  const categories = [...new Set(criteres.map(c => c.category))];
  const selectedCount = criteres.filter(c => c.selected).length;

  return (
    <div className="space-y-4">
      {/* Barre sélection globale */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 font-medium">
          {selectedCount} / {totalCount} {itemLabel} sélectionnées
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setCriteres(cs => cs.map(c => ({ ...c, selected: true })))}
            className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
            Tout sélectionner
          </button>
          <button type="button" onClick={() => setCriteres(cs => cs.map(c => ({ ...c, selected: false })))}
            className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
            Tout désélectionner
          </button>
        </div>
      </div>

      {/* Catégories */}
      {categories.map(cat => {
        const catItems = criteres.filter(c => c.category === cat);
        const catColor = catItems[0]?.categoryColor || '#888';
        return (
          <div key={cat} className="rounded-2xl border overflow-hidden" style={{ borderColor: catColor + '40' }}>
            {/* En-tête catégorie */}
            <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: catColor + '15' }}>
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: catColor }} />
              <h3 className="text-sm font-black" style={{ color: catColor }}>{cat}</h3>
              <span className="text-xs opacity-60 ml-1" style={{ color: catColor }}>
                ({catItems.filter(c => c.selected).length}/{catItems.length})
              </span>
            </div>

            {/* Compétences */}
            <div className="divide-y divide-slate-50 bg-white">
              {catItems.map(critere => {
                const isExp = expandedId === critere.id;
                return (
                  <div key={critere.id}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      {/* Checkbox */}
                      <button type="button" onClick={() => toggleSelected(critere.id)}
                        className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all"
                        style={{ borderColor: critere.selected ? catColor : '#CBD5E1', background: critere.selected ? catColor : 'white' }}>
                        {critere.selected && <Check size={11} color="white" strokeWidth={3} />}
                      </button>

                      {/* Label */}
                      <span className={`flex-1 text-sm font-semibold ${critere.selected ? 'text-slate-800' : 'text-slate-400'}`}>
                        {critere.label}
                      </span>

                      {/* Coefficient (CT uniquement) */}
                      {critere.selected && showCoeff && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-xs text-slate-400">×</span>
                          <input type="number" min="1" max="5" value={critere.coefficient}
                            onChange={e => updateCoeff(critere.id, 'coefficient', Number(e.target.value))}
                            className="w-10 text-center text-xs font-bold border border-slate-200 rounded-lg py-1 focus:outline-none focus:border-happi-orange"
                            style={{ color: '#FF8650' }} />
                        </div>
                      )}

                      {/* Toggle niveaux */}
                      {critere.selected && (
                        <button type="button"
                          onClick={() => setExpandedId(isExp ? null : critere.id)}
                          className="text-xs font-bold px-2 py-1 rounded-lg transition-colors flex-shrink-0"
                          style={{ background: isExp ? catColor + '20' : '#f1f5f9', color: isExp ? catColor : '#64748b' }}>
                          {isExp ? 'Fermer' : `${levels.length} niveaux`}
                        </button>
                      )}
                    </div>

                    {/* Niveaux dépliés */}
                    {critere.selected && isExp && (
                      <div className="px-4 pb-4 pt-1 space-y-2" style={{ background: catColor + '08' }}>
                        {levels.map((level, li) => (
                          <div key={li} className="flex items-start gap-2">
                            <div className="flex-shrink-0 mt-1 w-20">
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full text-white block text-center"
                                style={{ background: levelsColor[li] }}>
                                {level}
                              </span>
                            </div>
                            <textarea
                              value={(critere.descriptions || [])[li] || ''}
                              onChange={e => updateDescription(critere.id, li, e.target.value)}
                              rows={2}
                              className="flex-1 text-xs text-slate-600 bg-white border border-slate-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-happi-orange leading-relaxed"
                              placeholder={`Description niveau "${level}"…`}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ══ COMPOSANT PRINCIPAL ══════════════════════════════════════════════ */
export default function Baremes({ data, update }) {
  const baremes = data.baremes || [];

  const [expandedId, setExpandedId]           = useState(null);
  const [showModal, setShowModal]             = useState(false);
  const [modalStep, setModalStep]             = useState(1);
  const [editTarget, setEditTarget]           = useState(null);
  const [form, setForm]                       = useState(EMPTY_FORM);
  const [criteres, setCriteres]               = useState([{ id: 'c_' + Date.now(), label: '', coefficient: 1 }]);
  const [hbsCriteres, setHbsCriteres]         = useState([]);
  const [deleteConfirm, setDeleteConfirm]     = useState(null);
  const [newCritereLabel, setNewCritereLabel] = useState('');
  const [newCritereCoeff, setNewCritereCoeff] = useState(1);
  const [expandedCritereId, setExpandedCritereId] = useState(null);

  /* Helpers */
  const totalPoints = bar => bar.criteres.reduce((s, c) => s + c.coefficient * (c.noteMax ?? bar.noteMax), 0);

  const openCreate = () => {
    setEditTarget(null); setForm(EMPTY_FORM);
    setCriteres([{ id: 'c_' + Date.now(), label: '', coefficient: 1 }]);
    setHbsCriteres([]);
    setNewCritereLabel(''); setNewCritereCoeff(1);
    setExpandedCritereId(null); setModalStep(1); setShowModal(true);
  };

  const openEdit = (bar, e) => {
    e.stopPropagation(); setEditTarget(bar);
    setForm({ nom: bar.nom, description: bar.description || '', type: bar.type, noteMax: bar.noteMax, echelle: bar.echelle || EMPTY_FORM.echelle });
    if (bar.type === 'Session') {
      const ct  = bar.criteres.filter(c => !c.noteMax || c.noteMax !== 4).map(c => ({ ...c, selected: true }));
      const hbs = bar.criteres.filter(c => c.noteMax === 4).map(c => ({ ...c, selected: true }));
      setCriteres(ct.length  ? ct  : CT_COMPETENCES_FULL.map(c => ({ ...c, coefficient: 1, selected: false })));
      setHbsCriteres(hbs.length ? hbs : HBS_COMPETENCES_FULL.map(c => ({ ...c, coefficient: 1, noteMax: 4, selected: false })));
    } else {
      setCriteres(bar.criteres.map(c => ({ ...c })));
      setHbsCriteres([]);
    }
    setNewCritereLabel(''); setNewCritereCoeff(1);
    setExpandedCritereId(null); setModalStep(1); setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditTarget(null); };

  const handleSave = () => {
    let validCriteres;
    if (form.type === 'Session') {
      validCriteres = [...criteres.filter(c => c.selected), ...hbsCriteres.filter(c => c.selected)];
    } else if (form.type === 'CT' || form.type === 'HBS') {
      validCriteres = criteres.filter(c => c.selected);
    } else {
      validCriteres = criteres.filter(c => c.label.trim());
    }
    if (!form.nom.trim() || validCriteres.length === 0) return;
    const saved = {
      id: editTarget ? editTarget.id : 'b_' + Date.now(),
      ...form, criteres: validCriteres,
      createdAt: editTarget ? editTarget.createdAt : new Date().toISOString().split('T')[0],
      isDefault: editTarget ? (editTarget.isDefault || false) : false,
    };
    update(prev => ({
      ...prev,
      baremes: editTarget
        ? (prev.baremes || []).map(b => b.id === editTarget.id ? saved : b)
        : [...(prev.baremes || []), saved],
    }));
    closeModal();
  };

  const handleDelete    = id => { update(prev => ({ ...prev, baremes: (prev.baremes || []).filter(b => b.id !== id) })); setDeleteConfirm(null); };
  const handleDuplicate = (bar, e) => { e.stopPropagation(); update(prev => ({ ...prev, baremes: [...(prev.baremes || []), { ...bar, id: 'b_' + Date.now(), nom: bar.nom + ' (copie)', isDefault: false, createdAt: new Date().toISOString().split('T')[0] }] })); };

  const addCritere    = () => { if (!newCritereLabel.trim()) return; setCriteres(c => [...c, { id: 'c_' + Date.now(), label: newCritereLabel.trim(), coefficient: newCritereCoeff }]); setNewCritereLabel(''); setNewCritereCoeff(1); };
  const removeCritere = id => setCriteres(c => c.filter(x => x.id !== id));
  const updateCritere = (id, field, val) => setCriteres(c => c.map(x => x.id === id ? { ...x, [field]: val } : x));
  const updateEchelle = (i, field, val) => setForm(f => { const ech = [...f.echelle]; ech[i] = { ...ech[i], [field]: val }; return { ...f, echelle: ech }; });

  const initCTCriteres  = () => setCriteres(CT_COMPETENCES_FULL.map(c => ({ ...c, coefficient: 1, selected: true })));
  const initHBSCriteres = () => setCriteres(HBS_COMPETENCES_FULL.map(c => ({ ...c, coefficient: 1, noteMax: 4, selected: true })));
  const initSessionCriteres = () => {
    setCriteres(CT_COMPETENCES_FULL.map(c => ({ ...c, coefficient: 1, selected: true })));
    setHbsCriteres(HBS_COMPETENCES_FULL.map(c => ({ ...c, coefficient: 1, noteMax: 4, selected: true })));
  };

  const toggleCritereSelected    = id => setCriteres(cs => cs.map(c => c.id === id ? { ...c, selected: !c.selected } : c));
  const updateCritereDescription = (id, li, val) => setCriteres(cs => cs.map(c => { if (c.id !== id) return c; const d = [...(c.descriptions || [])]; d[li] = val; return { ...c, descriptions: d }; }));
  const toggleHbsSelected        = id => setHbsCriteres(cs => cs.map(c => c.id === id ? { ...c, selected: !c.selected } : c));
  const updateHbsDescription     = (id, li, val) => setHbsCriteres(cs => cs.map(c => { if (c.id !== id) return c; const d = [...(c.descriptions || [])]; d[li] = val; return { ...c, descriptions: d }; }));
  const updateHbsCritere         = (id, field, val) => setHbsCriteres(cs => cs.map(c => c.id === id ? { ...c, [field]: val } : c));

  const isSession = form.type === 'Session';
  const isCTHBS   = form.type === 'CT' || form.type === 'HBS';
  const canSave   = form.nom.trim() && (
    isSession ? criteres.filter(c => c.selected).length + hbsCriteres.filter(c => c.selected).length > 0
    : isCTHBS ? criteres.filter(c => c.selected).length > 0
    : criteres.filter(c => c.label.trim()).length > 0
  );

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        style={{ background: 'linear-gradient(135deg,#102C32,#1A3F48)' }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,134,80,0.25)', border: '2px solid rgba(255,134,80,0.4)' }}>
            <SlidersHorizontal size={22} style={{ color: '#FF8650' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white" style={{ fontFamily: 'Poppins,sans-serif' }}>Barèmes d'évaluation</h1>
            <p className="text-sm mt-0.5" style={{ color: '#8AABB0' }}>
              {baremes.length} barème{baremes.length !== 1 ? 's' : ''} · Créez et gérez vos grilles de notation
            </p>
          </div>
        </div>
        <button onClick={openCreate} className="btn-primary flex-shrink-0"><Plus size={16} /> Nouveau barème</button>
      </div>

      {/* ── Liste ── */}
      {baremes.length === 0 ? (
        <div className="card text-center py-16">
          <SlidersHorizontal size={40} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">Aucun barème créé</p>
          <p className="text-sm text-slate-300 mt-1">Créez votre premier barème d'évaluation</p>
          <button onClick={openCreate} className="btn-primary mx-auto mt-4"><Plus size={16} /> Créer un barème</button>
        </div>
      ) : (
        <div className="space-y-3">
          {baremes.map(bar => {
            const cfg = TYPE_CONFIG[bar.type] || TYPE_CONFIG['Personnalisé'];
            const isExpanded = expandedId === bar.id;
            const ctCount  = bar.criteres.filter(c => !c.noteMax).length;
            const hbsCount = bar.criteres.filter(c => c.noteMax === 4).length;
            return (
              <div key={bar.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden"
                style={{ boxShadow: '0 2px 12px rgba(16,44,50,0.06)' }}>

                {/* Ligne titre */}
                <div className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors select-none"
                  onClick={() => setExpandedId(isExpanded ? null : bar.id)}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: cfg.bg }}>
                    <SlidersHorizontal size={18} style={{ color: cfg.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-slate-800 text-sm leading-tight">{bar.nom}</h3>
                      <TypeBadge type={bar.type} />
                      {bar.isDefault && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 flex items-center gap-0.5">
                          <Star size={8} fill="currentColor" /> Défaut
                        </span>
                      )}
                    </div>
                    {bar.description && <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{bar.description}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      {bar.type === 'Session' ? (
                        <>
                          <span className="text-[11px] text-slate-400">{ctCount} critères CT</span>
                          <span className="text-slate-200 text-xs">·</span>
                          <span className="text-[11px] text-slate-400">{hbsCount} critères HBS</span>
                        </>
                      ) : (
                        <span className="text-[11px] text-slate-400">
                          {bar.criteres.length} critère{bar.criteres.length > 1 ? 's' : ''} · /{bar.noteMax} · {totalPoints(bar)} pts max
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="hidden sm:flex gap-0.5 flex-shrink-0">
                    {bar.echelle.slice(0, bar.noteMax).map(e => (
                      <div key={e.valeur} className="w-3.5 h-3.5 rounded" style={{ background: e.color }} title={e.label} />
                    ))}
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={e => openEdit(bar, e)} className="p-2 rounded-xl text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-all" title="Modifier"><Edit2 size={15} /></button>
                    <button onClick={e => handleDuplicate(bar, e)} className="p-2 rounded-xl text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-all" title="Dupliquer"><Copy size={15} /></button>
                    <button onClick={e => { e.stopPropagation(); setDeleteConfirm(bar.id); }}
                      className="p-2 rounded-xl transition-all text-slate-300 hover:text-red-500 hover:bg-red-50"
                      title="Supprimer">
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="flex-shrink-0 pl-1">
                    {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-5 pb-8 border-t border-slate-100 bg-slate-50/30">
                    <BaremeDetail bar={bar} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══ Modal création / édition ══ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-white w-full md:max-w-xl md:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col max-h-[92vh]">

            <div className="md:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>

            {/* Header modal */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                {modalStep === 2 && (
                  <button onClick={() => setModalStep(1)} className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 -ml-1">
                    <ArrowLeft size={16} />
                  </button>
                )}
                <div>
                  <h2 className="font-bold text-slate-800" style={{ fontFamily: 'Poppins,sans-serif' }}>
                    {editTarget ? 'Modifier le barème' : 'Nouveau barème'}
                  </h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {[1, 2].map(i => (
                      <div key={i} className="h-1 rounded-full transition-all"
                        style={{ width: i === modalStep ? 20 : 10, background: i <= modalStep ? '#FF8650' : '#e2e8f0' }} />
                    ))}
                    <span className="text-[10px] text-slate-400 font-bold">{modalStep}/2</span>
                  </div>
                </div>
              </div>
              <button onClick={closeModal} className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400"><X size={18} /></button>
            </div>

            {/* STEP 1 : Informations */}
            {modalStep === 1 && (
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nom du barème *</label>
                  <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                    placeholder="Ex : Évaluation CT — Niveau débutant" className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                  <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    rows={2} className="input resize-none" placeholder="Objectif et contexte d'utilisation…" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Type de barème</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
                      <button key={type} type="button" onClick={() => {
                        setForm(f => ({ ...f, type }));
                        if (!editTarget) {
                          if (type === 'CT')      initCTCriteres();
                          else if (type === 'HBS')     initHBSCriteres();
                          else if (type === 'Session') initSessionCriteres();
                          else { setCriteres([{ id: 'c_' + Date.now(), label: '', coefficient: 1 }]); setHbsCriteres([]); }
                        }
                      }}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all text-left"
                        style={{
                          borderColor: form.type === type ? cfg.color : '#E2E8F0',
                          background:  form.type === type ? cfg.bg    : 'white',
                          color:       form.type === type ? cfg.color : '#64748b',
                        }}>
                        <div className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ background: form.type === type ? cfg.color : '#CBD5E1' }} />
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Note maximale par critère</label>
                  <div className="flex gap-2">
                    {[5, 10, 20].map(n => (
                      <button key={n} type="button" onClick={() => setForm(f => ({ ...f, noteMax: n }))}
                        className="flex-1 py-2.5 rounded-xl border-2 text-sm font-bold transition-all"
                        style={{
                          borderColor: form.noteMax === n ? '#FF8650' : '#E2E8F0',
                          background:  form.noteMax === n ? '#FFF1EB' : 'white',
                          color:       form.noteMax === n ? '#FF8650' : '#64748b',
                        }}>
                        /{n}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Échelle de notation ({form.noteMax} niveaux)</label>
                  <div className="space-y-2">
                    {form.echelle.slice(0, form.noteMax).map((e, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: e.color }}>{e.valeur}</div>
                        <input value={e.label} onChange={ev => updateEchelle(i, 'label', ev.target.value)} className="input flex-1 text-sm py-1.5" />
                        <input type="color" value={e.color} onChange={ev => updateEchelle(i, 'color', ev.target.value)} className="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer p-0.5" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button onClick={() => setModalStep(2)} disabled={!form.nom.trim()} className="btn-primary disabled:opacity-50">
                    Suivant — Critères <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2 : Critères */}
            {modalStep === 2 && (
              <div className="flex-1 overflow-y-auto p-5 space-y-4">

                {/* CT */}
                {form.type === 'CT' && (
                  <CompetenceSelector
                    criteres={criteres} setCriteres={setCriteres}
                    levels={CT_LEVELS} levelsColor={CT_LEVELS_COLOR}
                    itemLabel="compétences" totalCount={CT_COMPETENCES_FULL.length}
                    expandedId={expandedCritereId} setExpandedId={setExpandedCritereId}
                    updateDescription={updateCritereDescription}
                    toggleSelected={toggleCritereSelected}
                    updateCoeff={updateCritere}
                    showCoeff
                  />
                )}

                {/* HBS */}
                {form.type === 'HBS' && (
                  <CompetenceSelector
                    criteres={criteres} setCriteres={setCriteres}
                    levels={HBS_LEVELS} levelsColor={HBS_LEVELS_COLOR}
                    itemLabel="habiletés" totalCount={HBS_COMPETENCES_FULL.length}
                    expandedId={expandedCritereId} setExpandedId={setExpandedCritereId}
                    updateDescription={updateCritereDescription}
                    toggleSelected={toggleCritereSelected}
                    updateCoeff={updateCritere}
                  />
                )}

                {/* Session : CT + HBS combinés */}
                {isSession && (
                  <div className="space-y-6">
                    {/* Section CT */}
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-px flex-1 bg-slate-200" />
                        <span className="inline-flex items-center justify-center px-2.5 h-6 rounded-full text-white text-xs font-black" style={{ background: '#FF8650' }}>CT</span>
                        <span className="text-sm font-black text-slate-700 uppercase tracking-wide">Compétences Transversales</span>
                        <div className="h-px flex-1 bg-slate-200" />
                      </div>
                      <CompetenceSelector
                        criteres={criteres} setCriteres={setCriteres}
                        levels={CT_LEVELS} levelsColor={CT_LEVELS_COLOR}
                        itemLabel="compétences" totalCount={CT_COMPETENCES_FULL.length}
                        expandedId={expandedCritereId} setExpandedId={setExpandedCritereId}
                        updateDescription={updateCritereDescription}
                        toggleSelected={toggleCritereSelected}
                        updateCoeff={updateCritere}
                        showCoeff
                      />
                    </div>
                    {/* Section HBS */}
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-px flex-1 bg-slate-200" />
                        <span className="inline-flex items-center justify-center px-2.5 h-6 rounded-full text-white text-xs font-black" style={{ background: '#10B981' }}>HBS</span>
                        <span className="text-sm font-black text-slate-700 uppercase tracking-wide">Habiletés Sociocognitives</span>
                        <div className="h-px flex-1 bg-slate-200" />
                      </div>
                      <CompetenceSelector
                        criteres={hbsCriteres} setCriteres={setHbsCriteres}
                        levels={HBS_LEVELS} levelsColor={HBS_LEVELS_COLOR}
                        itemLabel="habiletés" totalCount={HBS_COMPETENCES_FULL.length}
                        expandedId={expandedCritereId} setExpandedId={setExpandedCritereId}
                        updateDescription={updateHbsDescription}
                        toggleSelected={toggleHbsSelected}
                        updateCoeff={updateHbsCritere}
                      />
                    </div>
                  </div>
                )}

                {/* Autres types */}
                {!isCTHBS && !isSession && (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-500">Ajoutez les critères d'évaluation et leur coefficient de pondération.</p>
                    <div className="space-y-2">
                      {criteres.map((c, idx) => (
                        <div key={c.id} className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100">
                          <span className="text-xs font-bold text-slate-400 w-5 text-center flex-shrink-0">{idx + 1}</span>
                          <input value={c.label} onChange={e => updateCritere(c.id, 'label', e.target.value)}
                            placeholder="Nom du critère"
                            className="flex-1 bg-transparent text-sm font-medium text-slate-700 focus:outline-none placeholder-slate-300" />
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <span className="text-xs text-slate-400">×</span>
                            <input type="number" min="1" max="5" value={c.coefficient}
                              onChange={e => updateCritere(c.id, 'coefficient', Number(e.target.value))}
                              className="w-12 text-center text-sm font-bold border border-slate-200 rounded-lg py-1 focus:outline-none focus:border-happi-orange"
                              style={{ color: '#FF8650' }} />
                          </div>
                          <button onClick={() => removeCritere(c.id)}
                            className="p-1 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 p-3 rounded-xl border-2 border-dashed border-slate-200 bg-white">
                      <input value={newCritereLabel} onChange={e => setNewCritereLabel(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addCritere()}
                        placeholder="Nouveau critère…"
                        className="flex-1 text-sm text-slate-700 focus:outline-none placeholder-slate-300 bg-transparent" />
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-xs text-slate-400">×</span>
                        <input type="number" min="1" max="5" value={newCritereCoeff}
                          onChange={e => setNewCritereCoeff(Number(e.target.value))}
                          className="w-12 text-center text-sm font-bold border border-slate-200 rounded-lg py-1 focus:outline-none"
                          style={{ color: '#64748b' }} />
                      </div>
                      <button onClick={addCritere} disabled={!newCritereLabel.trim()}
                        className="p-1.5 rounded-lg transition-all disabled:opacity-40"
                        style={{ background: newCritereLabel.trim() ? '#FF8650' : '#e2e8f0', color: 'white' }}>
                        <Plus size={14} />
                      </button>
                    </div>
                    {criteres.filter(c => c.label.trim()).length === 0 && (
                      <div className="flex items-center gap-2 text-amber-600 text-xs">
                        <AlertCircle size={13} /> Au moins un critère est requis.
                      </div>
                    )}
                    {criteres.filter(c => c.label.trim()).length > 0 && (
                      <div className="p-3 rounded-xl" style={{ background: '#FFF1EB' }}>
                        <p className="text-xs text-slate-600">
                          <strong>{criteres.filter(c => c.label.trim()).length} critères</strong> · Note max : <strong>/{form.noteMax}</strong> · Total : <strong>{criteres.filter(c => c.label.trim()).reduce((s, c) => s + c.coefficient * form.noteMax, 0)} pts</strong>
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Résumé CT/HBS/Session */}
                {(isCTHBS || isSession) && (
                  <div className="p-3 rounded-xl sticky bottom-0" style={{ background: '#FFF1EB' }}>
                    <p className="text-xs text-slate-600">
                      {isSession ? (
                        <>
                          <strong>{criteres.filter(c => c.selected).length} CT</strong> + <strong>{hbsCriteres.filter(c => c.selected).length} HBS</strong> sélectionnées
                        </>
                      ) : (
                        <><strong>{criteres.filter(c => c.selected).length} compétences</strong> sélectionnées · Note max <strong>/{form.type === 'HBS' ? 4 : form.noteMax}</strong></>
                      )}
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={closeModal} className="btn-secondary">Annuler</button>
                  <button onClick={handleSave} disabled={!canSave} className="btn-primary disabled:opacity-50">
                    <Check size={16} /> {editTarget ? 'Enregistrer' : 'Créer le barème'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation suppression */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-white rounded-t-3xl md:rounded-3xl shadow-2xl w-full md:max-w-sm text-center">
            <div className="md:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>
            <div className="p-6">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={20} className="text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Supprimer ce barème ?</h3>
            <p className="text-sm text-slate-500 mb-6">Les sessions utilisant ce barème ne seront pas affectées.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary">Annuler</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="btn-danger">Supprimer</button>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
