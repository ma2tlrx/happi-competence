import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Users, Calendar, MapPin, Clock, ClipboardList, Star,
  UserPlus, UserMinus, Save, Edit2, X, Target, FileText, ChevronRight,
  CheckCircle2, SlidersHorizontal, Check, Eye, BookOpen, Play
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

/* ── Part type config ── */
const PART_TYPE = {
  intro:      { dot: 'bg-indigo-400',  label: 'Intro',      text: 'text-indigo-600',  bg: 'bg-indigo-50'  },
  theory:     { dot: 'bg-violet-400',  label: 'Théorie',    text: 'text-violet-600',  bg: 'bg-violet-50'  },
  practice:   { dot: 'bg-blue-400',    label: 'Activité',   text: 'text-blue-600',    bg: 'bg-blue-50'    },
  discussion: { dot: 'bg-cyan-400',    label: 'Débat',      text: 'text-cyan-600',    bg: 'bg-cyan-50'    },
  break:      { dot: 'bg-slate-300',   label: 'Pause',      text: 'text-slate-500',   bg: 'bg-slate-100'  },
  debrief:    { dot: 'bg-amber-400',   label: 'Débrief',    text: 'text-amber-600',   bg: 'bg-amber-50'   },
  conclusion: { dot: 'bg-emerald-400', label: 'Conclusion', text: 'text-emerald-600', bg: 'bg-emerald-50' },
};

function RichContent({ text }) {
  const lines = text.split('\n').filter(l => l.trim());
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        const t = line.trim();
        if (t.startsWith('•'))
          return <div key={i} className="flex items-start gap-2"><span className="text-slate-300 shrink-0 mt-0.5 text-[10px]">●</span><span className="text-xs text-slate-600 leading-relaxed">{t.slice(1).trim()}</span></div>;
        if (t.startsWith('→'))
          return <div key={i} className="flex items-start gap-2 pl-1"><span className="text-emerald-400 shrink-0 text-xs mt-0.5">→</span><span className="text-xs text-emerald-700 font-medium leading-relaxed">{t.slice(1).trim()}</span></div>;
        if (t.startsWith('💡') || t.startsWith('⚠'))
          return <div key={i} className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2 mt-2"><span className="text-xs shrink-0">{t[0]}</span><span className="text-xs text-amber-800 font-medium leading-relaxed">{t.slice(1).trim()}</span></div>;
        if (t.startsWith('**') && t.endsWith('**'))
          return <p key={i} className="text-xs font-black text-slate-700 mt-2">{t.slice(2, -2)}</p>;
        return <p key={i} className="text-xs text-slate-600 leading-relaxed">{t}</p>;
      })}
    </div>
  );
}

function PartTimeline({ parts }) {
  const [expanded, setExpanded] = useState(null);
  const total = parts.reduce((s, p) => s + (p.duration || 0), 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden" style={{ boxShadow: '0 2px 8px rgba(16,44,50,0.05)' }}>
      <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
        <Target size={16} className="text-indigo-500" />
        <h2 className="font-black text-slate-900 text-sm">Déroulé pédagogique</h2>
        <span className="ml-auto text-xs text-slate-400 font-semibold">{parts.length} parties · {total} min</span>
      </div>
      <div className="divide-y divide-slate-50">
        {parts.map((p, i) => {
          const cfg = PART_TYPE[p.type] || PART_TYPE.practice;
          const isOpen = expanded === i;
          const hasContent = !!(p.content || p.participantActivity || (p.observationPoints && p.observationPoints.length));
          const firstLine = p.content?.split('\n')[0]?.replace(/\*\*(.*?)\*\*/g, '$1')?.replace(/^→\s*/, '')?.trim() || '';
          return (
            <div key={p.id || i}>
              <button
                className="w-full flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50/70 transition-colors text-left"
                onClick={() => hasContent && setExpanded(isOpen ? null : i)}
              >
                {/* Timeline dot */}
                <div className="flex flex-col items-center shrink-0 w-4 pt-1.5">
                  <div className={`w-3 h-3 rounded-full ${cfg.dot} shrink-0`} />
                  {i < parts.length - 1 && <div className="w-px flex-1 bg-slate-100 mt-1 min-h-[16px]" />}
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0 pb-0.5">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                    <span className="font-bold text-slate-800 text-sm leading-snug">{p.title}</span>
                  </div>
                  {firstLine && !isOpen && (
                    <p className="text-[11px] text-slate-400 leading-snug line-clamp-2 pl-0.5">{firstLine}</p>
                  )}
                </div>
                {/* Duration */}
                <div className="flex items-center gap-1.5 shrink-0 ml-1 mt-0.5">
                  <span className="text-xs text-slate-400 font-semibold">{p.duration}min</span>
                  {hasContent && (
                    <ChevronRight size={14} className={`text-slate-300 transition-transform shrink-0 ${isOpen ? 'rotate-90' : ''}`} />
                  )}
                </div>
              </button>
              {/* Expanded */}
              {isOpen && (
                <div className="px-4 md:px-5 pb-5 pl-10 md:pl-12 border-t border-slate-50 pt-3 space-y-3">
                  {p.content && <RichContent text={p.content} />}
                  {p.participantActivity && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-wide mb-1.5">Activité participant</p>
                      <p className="text-xs text-blue-800 leading-relaxed">{p.participantActivity}</p>
                    </div>
                  )}
                  {p.observationPoints && p.observationPoints.length > 0 && (
                    <div className="bg-violet-50 border border-violet-100 rounded-xl p-3">
                      <p className="text-[10px] font-black text-violet-600 uppercase tracking-wide mb-1.5">Points d'observation formateur</p>
                      <div className="space-y-1">
                        {p.observationPoints.map((obs, j) => (
                          <div key={j} className="flex items-start gap-2">
                            <Eye size={11} className="text-violet-400 shrink-0 mt-0.5" />
                            <span className="text-xs text-violet-700 leading-relaxed">{obs}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ statut }) {
  const map = {
    'terminée':  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
    'en cours':  { bg: 'bg-blue-100',    text: 'text-blue-700'    },
    'à venir':   { bg: 'bg-amber-100',   text: 'text-amber-700'   },
  };
  const cfg = map[statut] || map['à venir'];
  return (
    <span className={`inline-block text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
      {statut}
    </span>
  );
}

export default function SessionDetail({ data, update }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const session = data.sessions?.find(s => s.id === id);

  const [activeTab, setActiveTab] = useState('plan');
  const [editing, setEditing]     = useState(false);
  const [editForm, setEditForm]   = useState({});
  const [searchP, setSearchP]     = useState('');
  const [note, setNote]           = useState(session?.note || '');
  const [noteSaved, setNoteSaved] = useState(false);

  if (!session) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500">Session introuvable</p>
        <button onClick={() => navigate('/sessions')} className="btn-primary mx-auto mt-4">Retour</button>
      </div>
    );
  }

  const sessionParticipants = (session.participants || []).map(pid => data.participants?.find(p => p.id === pid)).filter(Boolean);
  const availableParticipants = (data.participants || []).filter(p => !(session.participants || []).includes(p.id));
  const filteredAvailable = availableParticipants.filter(p => {
    const q = searchP.toLowerCase();
    return !q || `${p.prenom} ${p.nom}`.toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q);
  });

  const presences    = data.presences?.[id]    || {};
  const evaluations  = data.evaluations?.[id]  || {};
  const presenceCount = Object.values(presences).filter(v => v === 'présent').length;
  const evalCount     = Object.keys(evaluations).length;
  const bareme        = (data.baremes || []).find(b => b.id === session.baremeId);

  const parts      = session.parts      || [];
  const objectives = session.objectives || [];
  const totalDuration = parts.reduce((s, p) => s + (p.duration || 0), 0);

  const addParticipant = (pid) => {
    update(prev => ({
      ...prev,
      sessions: prev.sessions.map(s => s.id === id ? { ...s, participants: [...(s.participants || []), pid] } : s),
      participants: prev.participants.map(p => p.id === pid ? { ...p, sessions: [...(p.sessions || []), id] } : p),
    }));
  };

  const removeParticipant = (pid) => {
    update(prev => ({
      ...prev,
      sessions: prev.sessions.map(s => s.id === id ? { ...s, participants: (s.participants || []).filter(x => x !== pid) } : s),
      participants: prev.participants.map(p => p.id === pid ? { ...p, sessions: (p.sessions || []).filter(x => x !== id) } : p),
    }));
  };

  const saveEdit = () => {
    update(prev => ({ ...prev, sessions: prev.sessions.map(s => s.id === id ? { ...editForm } : s) }));
    setEditing(false);
  };

  const saveNote = () => {
    update(prev => ({ ...prev, sessions: prev.sessions.map(s => s.id === id ? { ...s, note } : s) }));
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2000);
  };

  const TABS = [
    { key: 'plan',         label: 'Plan de séance' },
    { key: 'participants', label: `Participants (${sessionParticipants.length})` },
    { key: 'bareme',       label: 'Barème' },
  ];

  return (
    <div className="space-y-0 -m-4 md:-m-6 min-h-screen bg-slate-50/50">

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-100" style={{ boxShadow: '0 1px 8px rgba(16,44,50,0.06)' }}>
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 md:px-6 py-3">
          <button onClick={() => navigate('/sessions')}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all flex-shrink-0">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge statut={session.statut} />
              <h1 className="text-base font-black text-slate-900 truncate">{session.nom}</h1>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-slate-400">
              {session.date && <span className="flex items-center gap-1"><Calendar size={11} />{format(new Date(session.date), 'EEEE dd MMM yyyy', { locale: fr })}{session.heure ? ` · ${session.heure}` : ''}</span>}
              {session.lieu && <span className="flex items-center gap-1"><MapPin size={11} />{session.lieu}</span>}
              {totalDuration > 0 && <span className="flex items-center gap-1"><Clock size={11} />{totalDuration} min</span>}
            </div>
          </div>
          <button onClick={() => { setEditForm({ ...session }); setEditing(true); }}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all flex-shrink-0">
            <Edit2 size={16} />
          </button>
        </div>

        {/* Quick actions bar */}
        <div className="flex flex-wrap items-center gap-2 px-4 md:px-6 pb-3">
          <button onClick={() => navigate(`/presence/${id}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all shrink-0"
            style={{ background: 'linear-gradient(135deg,#102C32,#1A3F48)' }}>
            <ClipboardList size={13} /> Faire l'appel
          </button>
          <button onClick={() => navigate(`/evaluation/${id}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shrink-0"
            style={{ borderColor: '#FF8650', color: '#FF8650' }}>
            <Star size={13} /> Évaluer
          </button>
          <button onClick={() => navigate(`/sessions/${session.templateSessionId || id}/player`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all shrink-0"
            style={{ background: 'linear-gradient(135deg,#FF8650,#ff6b2b)' }}>
            <Play size={11} fill="white" /> Lancer la session
          </button>
          <div className="ml-auto flex items-center gap-2 text-xs text-slate-400 shrink-0">
            <span className="flex items-center gap-1"><Users size={12} />{presenceCount}/{sessionParticipants.length}</span>
            <span className="flex items-center gap-1"><Star size={12} />{evalCount} éval.</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-slate-100 px-4 md:px-6 overflow-x-auto scrollbar-none">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`shrink-0 px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === t.key
                  ? 'border-happi-orange text-happi-orange'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-4 md:px-6 pt-5 pb-24 w-full max-w-2xl mx-auto space-y-4">

        {/* ══ Tab : Plan de séance ══════════════════════════════════ */}
        {activeTab === 'plan' && (
          <>
            {/* Desc */}
            {session.description && (
              <div className="bg-white rounded-2xl border border-slate-100 px-5 py-4 text-sm text-slate-600" style={{ boxShadow: '0 2px 8px rgba(16,44,50,0.05)' }}>
                {session.description}
              </div>
            )}

            {/* Timeline */}
            {parts.length > 0
              ? <PartTimeline parts={parts} />
              : null
            }

            {/* Objectifs */}
            {objectives.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden" style={{ boxShadow: '0 2px 8px rgba(16,44,50,0.05)' }}>
                <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
                  <Target size={16} className="text-violet-500" />
                  <h2 className="font-black text-slate-900 text-sm">Objectifs pédagogiques</h2>
                </div>
                <div className="px-5 py-4 space-y-2.5">
                  {objectives.map((obj, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <CheckCircle2 size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                      <span className="text-sm text-slate-700">{obj}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Note privée */}
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden" style={{ boxShadow: '0 2px 8px rgba(16,44,50,0.05)' }}>
              <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
                <FileText size={16} className="text-amber-500" />
                <h2 className="font-black text-slate-900 text-sm">Note privée</h2>
              </div>
              <div className="p-4">
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Vos notes de préparation (visible uniquement par vous)..."
                  className="w-full text-sm text-slate-700 resize-none outline-none placeholder:text-slate-300 leading-relaxed min-h-[80px]"
                />
                <button onClick={saveNote}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    noteSaved ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}>
                  {noteSaved ? <><Check size={12} /> Sauvegardé</> : <><Save size={12} /> Sauvegarder</>}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ══ Tab : Participants ══════════════════════════════════ */}
        {activeTab === 'participants' && (
          <div className="space-y-4">
            {/* Inscrits */}
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden" style={{ boxShadow: '0 2px 8px rgba(16,44,50,0.05)' }}>
              <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
                <Users size={16} className="text-indigo-500" />
                <h2 className="font-black text-slate-900 text-sm">Participants inscrits ({sessionParticipants.length})</h2>
              </div>
              {sessionParticipants.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <Users className="mx-auto mb-2 text-slate-200" size={32} />
                  <p className="text-sm font-bold">Aucun participant inscrit</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {sessionParticipants.map(p => {
                    const presence = presences[p.id];
                    const hasEval  = !!evaluations[p.id];
                    return (
                      <div key={p.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 cursor-pointer"
                          style={{ background: 'linear-gradient(135deg,#FF8650,#ff6a2f)' }}
                          onClick={() => navigate(`/participants/${p.id}`)}>
                          {p.prenom?.[0]}{p.nom?.[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate">{p.prenom} {p.nom}</p>
                          <div className="flex gap-1.5 mt-0.5 flex-wrap">
                            {presence && (
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                presence === 'présent'  ? 'bg-emerald-100 text-emerald-700' :
                                presence === 'absent'   ? 'bg-red-100 text-red-600' :
                                'bg-amber-100 text-amber-700'
                              }`}>{presence}</span>
                            )}
                            {hasEval && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-600">évalué</span>}
                          </div>
                        </div>
                        <button onClick={() => removeParticipant(p.id)}
                          className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0">
                          <UserMinus size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Ajouter */}
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden" style={{ boxShadow: '0 2px 8px rgba(16,44,50,0.05)' }}>
              <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
                <UserPlus size={16} className="text-emerald-500" />
                <h2 className="font-black text-slate-900 text-sm">Ajouter des participants</h2>
              </div>
              <div className="p-4">
                <input type="text" value={searchP} onChange={e => setSearchP(e.target.value)}
                  placeholder="Rechercher un participant…" className="input mb-3" />
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filteredAvailable.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">Aucun participant disponible</p>
                  ) : filteredAvailable.map(p => (
                    <div key={p.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-all">
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-xs font-bold flex-shrink-0">
                        {p.prenom?.[0]}{p.nom?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{p.prenom} {p.nom}</p>
                        <p className="text-xs text-slate-400 truncate">{p.residence}</p>
                      </div>
                      <button onClick={() => addParticipant(p.id)}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 transition-all flex-shrink-0">
                        <UserPlus size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ Tab : Barème ══════════════════════════════════════ */}
        {activeTab === 'bareme' && (
          <div className="space-y-4">
            {bareme ? (
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden" style={{ boxShadow: '0 2px 8px rgba(16,44,50,0.05)' }}>
                <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
                  <SlidersHorizontal size={16} className="text-orange-500" />
                  <h2 className="font-black text-slate-900 text-sm">Barème assigné</h2>
                </div>
                <div className="px-5 py-4">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: '#FFF1EB' }}>
                      <SlidersHorizontal size={18} style={{ color: '#FF8650' }} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{bareme.nom}</p>
                      {bareme.description && <p className="text-xs text-slate-400 mt-0.5">{bareme.description}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1 mb-4">
                    {bareme.echelle?.slice(0, bareme.noteMax).map(e => (
                      <div key={e.valeur} className="flex-1 flex flex-col items-center gap-0.5">
                        <div className="w-full h-2 rounded-full" style={{ background: e.color }} />
                        <span className="text-[9px] text-slate-400">{e.valeur}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    {bareme.type === 'Session' ? (
                      <>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">{bareme.criteres?.filter(c => !c.noteMax).length} critères CT · {bareme.criteres?.filter(c => c.noteMax === 4).length} critères HBS</p>
                      </>
                    ) : (
                      bareme.criteres?.slice(0, 5).map(c => (
                        <div key={c.id} className="flex justify-between text-xs">
                          <span className="text-slate-600 truncate">{c.label}</span>
                          <span className="text-slate-400 ml-2 flex-shrink-0">×{c.coefficient}</span>
                        </div>
                      ))
                    )}
                  </div>
                  <button onClick={() => navigate('/baremes')}
                    className="mt-4 text-xs font-bold text-happi-orange hover:underline flex items-center gap-1">
                    Gérer les barèmes <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center">
                <SlidersHorizontal size={28} className="text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400 font-medium">Aucun barème assigné</p>
                <button onClick={() => { setEditForm({ ...session }); setEditing(true); }}
                  className="mt-3 text-xs font-bold text-happi-orange hover:underline">
                  Modifier la session pour en assigner un →
                </button>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── Edit Modal ── */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-white w-full md:max-w-lg md:rounded-3xl rounded-t-3xl shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">Modifier la session</h2>
              <button onClick={() => setEditing(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nom</label>
                <input value={editForm.nom || ''} onChange={e => setEditForm(f => ({ ...f, nom: e.target.value }))} className="input" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                  <input type="date" value={editForm.date || ''} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Heure</label>
                  <input type="time" value={editForm.heure || ''} onChange={e => setEditForm(f => ({ ...f, heure: e.target.value }))} className="input" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Lieu</label>
                <input value={editForm.lieu || ''} onChange={e => setEditForm(f => ({ ...f, lieu: e.target.value }))} className="input" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                  <select value={editForm.type || ''} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))} className="input">
                    {['Atelier découverte','Formation','Atelier','Séminaire','Conférence','Coaching'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Statut</label>
                  <select value={editForm.statut || ''} onChange={e => setEditForm(f => ({ ...f, statut: e.target.value }))} className="input">
                    {['à venir','en cours','terminée'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea value={editForm.description || ''} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={3} className="input resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Barème</label>
                <select value={editForm.baremeId || ''} onChange={e => setEditForm(f => ({ ...f, baremeId: e.target.value }))} className="input">
                  <option value="">— Aucun barème —</option>
                  {(data.baremes || []).map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setEditing(false)} className="btn-secondary">Annuler</button>
              <button onClick={saveEdit} className="btn-primary"><Save size={15} /> Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
