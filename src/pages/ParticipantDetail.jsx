import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Download, Mail, Phone, MapPin, BookOpen, Briefcase, Tag, Star, Calendar, Save, X, CheckCircle, AlertTriangle, Lightbulb } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { HBS_CATEGORIES, CT_CATEGORIES, HBS_KEYS, CT_KEYS } from '../data/initialData';

// Barème Compétences Transversales (1–5)
const CT_SCALE  = ['', 'Non acquis', 'En difficulté', "En cours d'acquisition", 'Acquis', 'Dépassé'];
// Barème HBS (1–4, valeurs >4 plafonnées)
const HBS_SCALE = ['', 'Aptitude', 'Acquisition', 'Maitrise', 'Excellence'];
const CT_COLORS = { "Communication":"#FF8650","Gestion du Stress":"#3B82F6","Leadership":"#10B981","Analyse des problèmes":"#7C3AED","Autonomie et Compétitivité":"#F59E0B","Humaine":"#EF4444" };
const cap4 = v => Math.min(Math.round(v), 4);

// Keep legacy alias for generateAIAnalysis which still uses COMP_SCALE label logic
const COMP_SCALE = CT_SCALE;

function generateAIAnalysis(participant) {
  const scores = participant.competences || {};
  const entries = Object.entries(scores).filter(([, v]) => v !== null && v !== undefined).sort((a, b) => b[1] - a[1]);
  const pointsForts = entries.slice(0, 3);
  const axesAmelioration = entries.slice(-3).reverse();

  const ambitions = (participant.ambitions || '').toLowerCase();
  let recommendations = [];

  if (ambitions.includes('commerce') || ambitions.includes('vente') || ambitions.includes('marketing')) {
    recommendations.push({ metier: 'Commercial(e) / Chargé(e) de clientèle', match: 85, description: 'Profil adapté aux métiers de la relation client et de la vente.' });
    recommendations.push({ metier: 'Chargé(e) de communication', match: 75, description: 'Bonnes bases pour des missions de communication externe.' });
  } else if (ambitions.includes('informatique') || ambitions.includes('numérique') || ambitions.includes('jeux vidéo') || ambitions.includes('développeur')) {
    recommendations.push({ metier: 'Développeur(se) / Technicien(ne) IT', match: 85, description: 'Profil orienté technique avec une bonne autonomie.' });
    recommendations.push({ metier: 'Chef de projet digital', match: 70, description: 'Gestion de projets numériques avec équipes transversales.' });
  } else if (ambitions.includes('santé') || ambitions.includes('social') || ambitions.includes('service')) {
    recommendations.push({ metier: 'Conseiller(e) en insertion professionnelle', match: 80, description: 'Fort sens du service et de l\'accompagnement.' });
    recommendations.push({ metier: 'Assistant(e) social(e)', match: 75, description: 'Profil empathique adapté aux métiers d\'aide à la personne.' });
  } else if (ambitions.includes('sécurité') || ambitions.includes('défense')) {
    recommendations.push({ metier: 'Agent de sécurité / Gendarme', match: 80, description: 'Profil rigoureux adapté aux métiers de la sécurité.' });
    recommendations.push({ metier: 'Manager d\'équipe opérationnelle', match: 65, description: 'Leadership potentiel pour encadrement d\'équipes.' });
  } else if (ambitions.includes('art') || ambitions.includes('design') || ambitions.includes('architecture')) {
    recommendations.push({ metier: 'Designer graphique / UI-UX', match: 82, description: 'Profil créatif avec sens de l\'esthétique.' });
    recommendations.push({ metier: 'Médiateur(trice) culturel(le)', match: 70, description: 'Valorisation du patrimoine et de la culture.' });
  } else {
    recommendations.push({ metier: 'Chargé(e) de projet', match: 72, description: 'Polyvalence appréciée dans la coordination de projets divers.' });
    recommendations.push({ metier: 'Assistant(e) de direction', match: 68, description: 'Organisation et rigueur sont des atouts majeurs.' });
  }

  // Bonus recommendation based on top skills
  const topKey = pointsForts[0]?.[0] || '';
  if (topKey === 'Leadership' || topKey === 'Force de proposition') {
    recommendations.push({ metier: 'Manager / Responsable d\'équipe', match: 78, description: 'Capacités de leadership détectées.' });
  } else if (topKey === 'Curiosité' || topKey === 'Analyse des problèmes') {
    recommendations.push({ metier: 'Chargé(e) de recherche / Analyste', match: 75, description: 'Fort potentiel analytique et intellectuel.' });
  }

  return { pointsForts, axesAmelioration, recommendations };
}

export default function ParticipantDetail({ data, update }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const printRef = useRef();

  const participant = data.participants?.find(p => p.id === id);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [newTag, setNewTag] = useState('');

  if (!participant) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500">Participant introuvable</p>
        <button onClick={() => navigate('/participants')} className="btn-primary mx-auto mt-4">Retour</button>
      </div>
    );
  }

  const sessions = data.sessions?.filter(s => s.participants?.includes(id)) || [];
  const analysis = generateAIAnalysis(participant);

  // Mapping item CT → index ctAutoEval (15 premiers CT_KEYS)
  const ctItemToAutoIdx = Object.fromEntries(CT_KEYS.slice(0, 15).map((k, i) => [k, i]));

  // Radar CT dual — 6 axes : jeu (1–5) + auto-éval CT (1–5)
  const radarCT = CT_CATEGORIES.map(cat => {
    const jeuVals = cat.items.map(it => participant.competences?.[it]).filter(v => v != null);
    const jeu = jeuVals.length ? parseFloat((jeuVals.reduce((a,b)=>a+b,0)/jeuVals.length).toFixed(2)) : 0;
    const autoVals = cat.items
      .map(it => { const idx = ctItemToAutoIdx[it]; return idx !== undefined ? participant.ctAutoEval?.[idx] : null; })
      .filter(v => v != null);
    const auto = autoVals.length ? parseFloat((autoVals.reduce((a,b)=>a+b,0)/autoVals.length).toFixed(2)) : null;
    return { subject: cat.label, jeu, auto, color: cat.color, evaluatedJeu: jeuVals.length > 0, evaluatedAuto: autoVals.length > 0 };
  });
  const hasCTData = radarCT.some(d => d.evaluatedJeu);
  const hasCTAutoData = radarCT.some(d => d.evaluatedAuto);

  // Radar HBS jeu — 5 axes RELATION (jeu seul)
  const radarHbsJeu = HBS_CATEGORIES.map(cat => {
    const vals = cat.items.map(it => participant.hbsJeu?.[it.hbsIndex]).filter(v => v != null);
    return {
      subject: cat.label,
      value: vals.length ? parseFloat((vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2)) : 0,
      color: cat.color,
      evaluated: vals.length > 0
    };
  });
  const hasHbsJeuData = radarHbsJeu.some(d => d.evaluated);

  const startEdit = () => {
    setEditForm({ ...participant });
    setEditing(true);
  };

  const saveEdit = () => {
    update(prev => ({
      ...prev,
      participants: prev.participants.map(p => p.id === id ? { ...editForm } : p)
    }));
    setEditing(false);
  };

  const addTag = () => {
    if (!newTag.trim()) return;
    const updatedTags = [...(participant.tags || []), newTag.trim()];
    update(prev => ({
      ...prev,
      participants: prev.participants.map(p => p.id === id ? { ...p, tags: updatedTags } : p)
    }));
    setNewTag('');
  };

  const removeTag = (tag) => {
    const updatedTags = (participant.tags || []).filter(t => t !== tag);
    update(prev => ({
      ...prev,
      participants: prev.participants.map(p => p.id === id ? { ...p, tags: updatedTags } : p)
    }));
  };

  const exportPDF = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${participant.prenom}_${participant.nom}_profil.pdf`);
    } catch (e) {
      alert('Erreur lors de l\'export PDF');
    }
  };

  const scoreColor = (s) => s >= 4 ? 'text-emerald-600' : s >= 3 ? 'text-blue-600' : s >= 2 ? 'text-amber-600' : 'text-red-500';
  const ctScoreColor = (s) => s == null ? 'text-slate-300' : s >= 4 ? 'text-emerald-600' : s >= 3 ? 'text-blue-600' : s >= 2 ? 'text-amber-600' : 'text-red-500';
  const hbsScoreColor = (s) => s == null ? 'text-slate-300' : s >= 3 ? 'text-emerald-600' : s >= 2 ? 'text-blue-600' : 'text-amber-600';

  return (
    <div className="space-y-6" ref={printRef}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/participants')} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1" />
        <button onClick={startEdit} className="btn-secondary text-sm">
          <Edit2 size={15} /> Modifier
        </button>
        <button onClick={exportPDF} className="btn-primary text-sm">
          <Download size={15} /> Exporter PDF
        </button>
      </div>

      {/* Profile card */}
      <div className="card">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-400 to-violet-600 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0 shadow-lg shadow-blue-200">
            {participant.prenom?.[0]}{participant.nom?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold text-slate-800">{participant.prenom} {participant.nom}</h2>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-500">
              {participant.email && (
                <span className="flex items-center gap-1.5"><Mail size={14} className="text-blue-400" />{participant.email}</span>
              )}
              <span className="flex items-center gap-1.5"><Phone size={14} className="text-blue-400" />{participant.telephone}</span>
              <span className="flex items-center gap-1.5"><MapPin size={14} className="text-blue-400" />{participant.village || participant.residence}</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {(participant.tags || []).map(tag => (
                <span key={tag} className="badge bg-blue-50 text-blue-700 gap-1">
                  <Tag size={10} />
                  {tag}
                  <button onClick={() => removeTag(tag)} className="ml-0.5 hover:text-blue-900">×</button>
                </span>
              ))}
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={newTag}
                  onChange={e => setNewTag(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTag()}
                  placeholder="+ tag"
                  className="text-xs border border-dashed border-slate-300 rounded-full px-2 py-0.5 w-20 focus:outline-none focus:border-blue-400"
                />
              </div>
            </div>
          </div>
          <div className="flex gap-6 flex-shrink-0">
            <div className="text-center">
              <div className="text-3xl font-bold text-violet-500">{sessions.length}</div>
              <div className="text-xs text-slate-400">Sessions</div>
            </div>
          </div>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen size={16} className="text-blue-400" />
            <h3 className="text-sm font-semibold text-slate-700">Formation</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div><span className="text-slate-400">Âge : </span><span className="text-slate-700 font-medium">{participant.age}</span></div>
            <div><span className="text-slate-400">Niveau : </span><span className="text-slate-700 font-medium">{participant.niveauEtudes || '—'}</span></div>
            <div><span className="text-slate-400">Domaine : </span><span className="text-slate-700 font-medium">{participant.domainesEtudes || '—'}</span></div>
            <div><span className="text-slate-400">Établissement : </span><span className="text-slate-700 font-medium">{participant.etablissement || '—'}</span></div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Briefcase size={16} className="text-violet-400" />
            <h3 className="text-sm font-semibold text-slate-700">Parcours</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div><span className="text-slate-400">Ambitions : </span><span className="text-slate-700 font-medium">{participant.ambitions || '—'}</span></div>
            <div><span className="text-slate-400">Expériences : </span><span className="text-slate-700 font-medium">{participant.experiences || '—'}</span></div>
            <div><span className="text-slate-400">Bénévolat : </span><span className="text-slate-700 font-medium">{participant.benevole || '—'}</span></div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={16} className="text-amber-400" />
            <h3 className="text-sm font-semibold text-slate-700">Sessions suivies</h3>
          </div>
          {sessions.length === 0 ? (
            <p className="text-sm text-slate-400">Aucune session</p>
          ) : (
            <div className="space-y-2">
              {sessions.map(s => (
                <div key={s.id} className="text-sm p-2 bg-slate-50 rounded-xl">
                  <p className="font-medium text-slate-700">{s.nom}</p>
                  <p className="text-xs text-slate-400">{s.date}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Compétences Transversales ─────────────────────────────────────────── */}
      <div className="card">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-slate-800">Compétences Transversales</h3>
          <p className="text-xs text-slate-400">Évaluation jeu et Auto-évaluation — 6 catégories, échelle 1–5</p>
        </div>

        {hasCTData ? (
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarCT}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748b' }} />
              <PolarRadiusAxis domain={[0, 5]} tick={false} axisLine={false} />
              <Radar
                name="Évaluation de Compétences (Jeu)"
                dataKey="jeu"
                stroke="#FF8650"
                fill="#FF8650"
                fillOpacity={0.20}
                strokeWidth={2}
              />
              {hasCTAutoData && (
                <Radar
                  name="Auto-évaluation"
                  dataKey="auto"
                  stroke="#6366F1"
                  fill="#6366F1"
                  fillOpacity={0.12}
                  strokeWidth={2}
                  strokeDasharray="4 2"
                />
              )}
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Tooltip
                formatter={(v, name) => {
                  if (v == null || v === 0) return ['Absent lors de la session', name];
                  return [`${v}/5 — ${CT_SCALE[Math.round(v)] || ''}`, name];
                }}
                contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
              />
            </RadarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-36 text-slate-400 text-sm">
            Aucune évaluation de compétences disponible
          </div>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-2 mb-4 px-1 text-[10px] text-slate-400">
          {CT_SCALE.slice(1).map((label, i) => (
            <span key={i}><span className="font-semibold text-slate-500">{i + 1}</span> = {label}</span>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {CT_CATEGORIES.map(cat => {
            const catVals = cat.items.map(k => participant.competences?.[k]).filter(v => v != null);
            const catAvg = catVals.length ? (catVals.reduce((a,b)=>a+b,0)/catVals.length) : null;
            return (
              <div key={cat.label} className="rounded-2xl border border-slate-100 p-3" style={{ borderLeftColor: cat.color, borderLeftWidth: 3 }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wide" style={{ color: cat.color }}>{cat.label}</span>
                  {catAvg !== null ? (
                    <span className="text-xs font-semibold text-slate-600">
                      {catAvg.toFixed(1)}/5
                      <span className="ml-1 text-slate-400 font-normal">{CT_SCALE[Math.round(catAvg)]}</span>
                    </span>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </div>
                <div className="space-y-1">
                  {cat.items.map(k => {
                    const v = participant.competences?.[k] ?? null;
                    return (
                      <div key={k} className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 truncate mr-2">{k}</span>
                        {v !== null ? (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <div className="flex gap-0.5">
                              {[1,2,3,4,5].map(i => (
                                <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: i <= v ? cat.color : '#e2e8f0' }} />
                              ))}
                            </div>
                            <span className={`font-bold w-3 text-right ${ctScoreColor(v)}`}>{v}</span>
                            <span className="text-[10px] text-slate-400 w-28 text-right">{CT_SCALE[v] || ''}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] italic text-slate-400 flex-shrink-0">Absent lors de la session</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Habiletés Sociocognitives (HBS) ──────────────────────────────────── */}
      <div className="card">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-slate-800">Habiletés Sociocognitives (HBS)</h3>
          <p className="text-xs text-slate-400">Évaluation par les observateurs — 5 catégories RELATION, échelle 1–4</p>
        </div>

        <ResponsiveContainer width="100%" height={260}>
          <RadarChart data={radarHbsJeu}>
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748b' }} />
            <PolarRadiusAxis domain={[0, 4]} tick={false} axisLine={false} />
            <Radar
              name="Évaluation HBS (Jeu)"
              dataKey="value"
              stroke="#102C32"
              fill="#102C32"
              fillOpacity={0.15}
              strokeWidth={2}
            />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            <Tooltip
              formatter={(v, name) => [`${v}/4 — ${HBS_SCALE[cap4(v)] || ''}`, name]}
              contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
            />
          </RadarChart>
        </ResponsiveContainer>

        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 mb-4 px-1 text-[10px] text-slate-400">
          {HBS_SCALE.slice(1).map((label, i) => (
            <span key={i}><span className="font-semibold text-slate-500">{i + 1}</span> = {label}</span>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {HBS_CATEGORIES.map((cat) => {
            const jeuVals = cat.items.map(it => participant.hbsJeu?.[it.hbsIndex]).filter(v => v != null);
            const jeuAvg = jeuVals.length ? jeuVals.reduce((a,b)=>a+b,0)/jeuVals.length : null;
            return (
              <div key={cat.label} className="rounded-2xl border border-slate-100 p-3" style={{ borderLeftColor: cat.color, borderLeftWidth: 3 }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wide" style={{ color: cat.color }}>{cat.label}</span>
                  {jeuAvg !== null ? (
                    <span className={`text-sm font-bold ${hbsScoreColor(cap4(jeuAvg))}`}>
                      {jeuAvg.toFixed(1)}/4
                      <span className="ml-1 text-[10px] font-normal text-slate-400">{HBS_SCALE[cap4(jeuAvg)]}</span>
                    </span>
                  ) : (
                    <span className="text-xs italic text-slate-400">Absent lors de la session</span>
                  )}
                </div>

                <div className="space-y-1">
                  {cat.items.map(it => {
                    const jeuRaw = participant.hbsJeu?.[it.hbsIndex] ?? null;
                    const jeuV = jeuRaw != null ? cap4(jeuRaw) : null;
                    const hbsKey = HBS_KEYS[it.hbsIndex];
                    return (
                      <div key={it.key} className="flex items-center justify-between text-xs border-t border-slate-50 pt-1">
                        <div>
                          <span className="text-slate-600 font-medium">{it.key}</span>
                          <span className="text-[10px] text-slate-400 ml-1">({hbsKey})</span>
                        </div>
                        {jeuV !== null ? (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <div className="flex gap-0.5">
                              {[1,2,3,4].map(i => (
                                <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: i <= jeuV ? cat.color : '#e2e8f0' }} />
                              ))}
                            </div>
                            <span className={`font-bold w-7 text-right ${hbsScoreColor(jeuV)}`}>{jeuRaw?.toFixed ? jeuRaw.toFixed(1) : jeuV}</span>
                            <span className="text-[10px] text-slate-400 w-20 text-right">{HBS_SCALE[jeuV]}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] italic text-slate-400 flex-shrink-0">Absent lors de la session</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Analyse du profil (AI) ────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
            <Star size={14} className="text-white" />
          </div>
          <h3 className="text-base font-semibold text-slate-800">Analyse du profil</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Points forts */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle size={15} className="text-emerald-500" />
              <h4 className="text-sm font-semibold text-emerald-700">Points forts</h4>
            </div>
            <div className="space-y-2">
              {analysis.pointsForts.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-sm p-2 bg-emerald-50 rounded-xl">
                  <span className="text-emerald-700 font-medium">{k}</span>
                  <span className="badge bg-emerald-100 text-emerald-700">{v}/5</span>
                </div>
              ))}
            </div>
          </div>

          {/* Axes amélioration */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={15} className="text-amber-500" />
              <h4 className="text-sm font-semibold text-amber-700">Axes d'amélioration</h4>
            </div>
            <div className="space-y-2">
              {analysis.axesAmelioration.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-sm p-2 bg-amber-50 rounded-xl">
                  <span className="text-amber-700 font-medium">{k}</span>
                  <span className="badge bg-amber-100 text-amber-700">{v}/5</span>
                </div>
              ))}
            </div>
          </div>

          {/* Métiers recommandés */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb size={15} className="text-blue-500" />
              <h4 className="text-sm font-semibold text-blue-700">Orientations recommandées</h4>
            </div>
            <div className="space-y-2">
              {analysis.recommendations.slice(0, 3).map((rec, i) => (
                <div key={i} className="p-3 bg-blue-50 rounded-xl">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-blue-800">{rec.metier}</span>
                    <span className="badge bg-blue-100 text-blue-700">{rec.match}%</span>
                  </div>
                  <p className="text-xs text-blue-600">{rec.description}</p>
                  <div className="mt-1.5 h-1.5 bg-blue-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${rec.match}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Modifier le profil</h2>
              <button onClick={() => setEditing(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400"><X size={18} /></button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              {[
                { label: 'Prénom', key: 'prenom' },
                { label: 'Nom', key: 'nom' },
                { label: 'Email', key: 'email', type: 'email' },
                { label: 'Téléphone', key: 'telephone' },
                { label: 'Résidence', key: 'residence' },
                { label: 'Village', key: 'village' },
                { label: 'Établissement', key: 'etablissement' },
                { label: 'Domaines d\'études', key: 'domainesEtudes' },
              ].map(({ label, key, type = 'text' }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                  <input
                    type={type}
                    value={editForm[key] || ''}
                    onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                    className="input"
                  />
                </div>
              ))}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Ambitions</label>
                <input
                  value={editForm.ambitions || ''}
                  onChange={e => setEditForm(f => ({ ...f, ambitions: e.target.value }))}
                  className="input"
                />
              </div>
              {/* Competences editing */}
              <div className="col-span-2">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Compétences (session de jeu)</h3>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(editForm.competences || {}).filter(([, v]) => v !== null).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2">
                      <label className="text-xs text-slate-600 flex-1 min-w-0 truncate">{k}</label>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={v}
                        onChange={e => setEditForm(f => ({
                          ...f,
                          competences: { ...f.competences, [k]: parseInt(e.target.value) || 1 }
                        }))}
                        className="w-14 border border-slate-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    </div>
                  ))}
                  {Object.entries(editForm.competences || {}).filter(([, v]) => v === null).length > 0 && (
                    <p className="col-span-2 text-xs text-slate-400 italic">Les autres compétences n'ont pas été évaluées lors d'une session de jeu.</p>
                  )}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setEditing(false)} className="btn-secondary">Annuler</button>
              <button onClick={saveEdit} className="btn-primary">
                <Save size={15} /> Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
