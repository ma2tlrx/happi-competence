import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Calendar, MapPin, Users, Clock, X, Trash2, Copy,
  ArrowRight, CheckCircle, ArrowLeft, FileText, Sparkles,
  Upload, Edit2, Search, Check, ChevronRight, AlertCircle,
  SlidersHorizontal, Play,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

/* ── Status badge ───────────────────────────────────────────────── */
function StatusBadge({ statut }) {
  const map = {
    'terminée':  'bg-green-50 text-green-700 border-green-100',
    'en cours':  'bg-blue-50 text-blue-700 border-blue-100',
    'à venir':   'bg-amber-50 text-amber-700 border-amber-100',
  };
  return <span className={`badge border ${map[statut] || map['à venir']}`}>{statut}</span>;
}

/* ── Sessions pré-définies (modèles) ───────────────────────────── */
const SESSION_TEMPLATES = [
  {
    id: 'tpl_communication',
    sessionId: 'sess_1',
    baremeId: 'b_sess_1',
    nom: 'SESSION 1 - LA COMMUNICATION',
    type: 'Atelier HaPPi',
    duree: '3h',
    description: "Développer l'écoute active, l'assertivité et la coopération par le jeu (Moving Out, WorldGuessr) et le débat.",
    tags: ['Communication', 'Coopération', 'Écoute active'],
    color: '#3B82F6', bg: '#EFF6FF', emoji: '🗣️',
    theme: 'Communication',
    objectives: [
      "Maîtriser l'écoute active et la reformulation",
      "Développer l'assertivité : s'exprimer sans agressivité ni passivité",
      "Observer la communication non-verbale",
      "Renforcer la coopération et le travail d'équipe sous pression",
    ],
    parts: [
      { id: 'c_p1', type: 'intro',      title: 'Accueil & Présentation du programme',       duration: 10 },
      { id: 'c_p2', type: 'theory',     title: 'Introduction à la Communication',            duration: 10 },
      { id: 'c_p3', type: 'practice',   title: 'Auto-évaluation initiale',                   duration: 10 },
      { id: 'c_p4', type: 'practice',   title: "Icebreaker — Jeu de l'Imposteur",            duration: 15 },
      { id: 'c_p5', type: 'discussion', title: 'Débat thématique OUI/NON',                   duration: 20 },
      { id: 'c_p6', type: 'break',      title: 'Pause',                                      duration: 10 },
      { id: 'c_p7', type: 'practice',   title: 'Moving Out — Jeu coopératif',                duration: 60 },
      { id: 'c_p8', type: 'practice',   title: 'WorldGuessr — Tournoi géographique',         duration: 20 },
      { id: 'c_p9', type: 'theory',     title: 'Quiz de consolidation',                      duration: 15 },
      { id: 'c_p10', type: 'debrief',   title: 'Conclusion & Discussion de groupe',          duration: 15 },
    ],
  },
  {
    id: 'tpl_adaptabilite',
    sessionId: 'sess_2',
    baremeId: 'b_sess_2',
    nom: 'SESSION 2 - ADAPTABILITÉ & GESTION DU STRESS',
    type: 'Atelier HaPPi',
    duree: '3h',
    description: "Développer la réactivité, la gestion des priorités et la maîtrise émotionnelle sous pression via Keep Talking et Unchained Together.",
    tags: ['Adaptabilité', 'Stress', 'Priorités'],
    color: '#8B5CF6', bg: '#F5F3FF', emoji: '⚡',
    theme: 'Adaptabilité',
    objectives: [
      "Comprendre et utiliser la matrice Urgent/Important",
      "Développer la régulation émotionnelle sous pression",
      "Renforcer la flexibilité comportementale",
      "Pratiquer la communication efficace en situation de crise",
    ],
    parts: [
      { id: 'a_p1', type: 'intro',      title: 'Accueil & Cadrage de la session',            duration: 10 },
      { id: 'a_p2', type: 'theory',     title: "Introduction à l'Adaptation en entreprise",  duration: 10 },
      { id: 'a_p3', type: 'practice',   title: "Icebreaker — Jeu de l'Imposteur",            duration: 20 },
      { id: 'a_p4', type: 'discussion', title: 'Débat thématique OUI/NON',                   duration: 20 },
      { id: 'a_p5', type: 'break',      title: 'Pause',                                      duration: 10 },
      { id: 'a_p6', type: 'practice',   title: 'Keep Talking and Nobody Explodes',           duration: 40 },
      { id: 'a_p7', type: 'practice',   title: 'Unchained Together — Coopération enchaînée', duration: 40 },
      { id: 'a_p8', type: 'theory',     title: 'Quiz de consolidation',                      duration: 15 },
      { id: 'a_p9', type: 'debrief',    title: 'Conclusion & Discussion de groupe',          duration: 15 },
    ],
  },
  {
    id: 'tpl_leadership',
    sessionId: 'sess_3',
    baremeId: 'b_sess_3',
    nom: 'SESSION 3 - LEADERSHIP',
    type: 'Atelier HaPPi',
    duree: '3h',
    description: "Explorer les styles de leadership, la prise de décision et l'organisation collective via Overcooked 2 et Supermarket Together.",
    tags: ['Leadership', 'Organisation', 'Délégation'],
    color: '#FF8650', bg: '#FFF7ED', emoji: '👑',
    theme: 'Leadership',
    objectives: [
      "Comprendre les 3 types de leadership (rôle, compétence, situation)",
      "Expérimenter différents styles de leadership",
      "Développer la capacité à organiser et coordonner une équipe",
      "Pratiquer la prise de décision sous pression",
    ],
    parts: [
      { id: 'l_p1', type: 'intro',      title: 'Accueil & Cadrage — Le Leadership',          duration: 10 },
      { id: 'l_p2', type: 'theory',     title: 'Introduction au Leadership en entreprise',   duration: 10 },
      { id: 'l_p3', type: 'practice',   title: "Icebreaker — Jeu de l'Imposteur",            duration: 15 },
      { id: 'l_p4', type: 'discussion', title: 'Débat thématique OUI/NON',                   duration: 20 },
      { id: 'l_p5', type: 'break',      title: 'Pause',                                      duration: 10 },
      { id: 'l_p6', type: 'practice',   title: 'Overcooked 2 — Cuisine coopérative',         duration: 40 },
      { id: 'l_p7', type: 'practice',   title: 'Supermarket Together — Gestion de magasin',  duration: 20 },
      { id: 'l_p8', type: 'theory',     title: 'Quiz de consolidation',                      duration: 15 },
      { id: 'l_p9', type: 'debrief',    title: 'Conclusion & Discussion de groupe',          duration: 20 },
    ],
  },
  {
    id: 'tpl_analyse',
    sessionId: 'sess_4',
    baremeId: 'b_sess_4',
    nom: 'SESSION 4 - ANALYSE DES PROBLÈMES',
    type: 'Atelier HaPPi',
    duree: '3h',
    description: "Développer la curiosité, l'analyse logique et la résolution collective via Escape Simulator et Biped.",
    tags: ['Analyse', 'Résolution', 'Curiosité'],
    color: '#10B981', bg: '#ECFDF5', emoji: '🔍',
    theme: 'Analyse',
    objectives: [
      "Maîtriser la méthode QQOQCP pour structurer l'analyse",
      "Développer la curiosité et l'exploration de pistes",
      "Pratiquer la résolution collective sous contrainte de temps",
      "Adopter une approche globale avant les détails",
    ],
    parts: [
      { id: 'p_p1', type: 'intro',      title: "Accueil & Cadrage — Analyse de problèmes",  duration: 10 },
      { id: 'p_p2', type: 'theory',     title: "Introduction à l'Analyse de problèmes",      duration: 10 },
      { id: 'p_p3', type: 'practice',   title: "Icebreaker — Jeu de l'Imposteur",            duration: 15 },
      { id: 'p_p4', type: 'discussion', title: 'Débat thématique OUI/NON',                   duration: 20 },
      { id: 'p_p5', type: 'break',      title: 'Pause',                                      duration: 10 },
      { id: 'p_p6', type: 'practice',   title: "Escape Simulator — Résolution d'énigmes",    duration: 60 },
      { id: 'p_p7', type: 'practice',   title: 'Biped — Coopération physique',               duration: 20 },
      { id: 'p_p8', type: 'theory',     title: 'Quiz de consolidation',                      duration: 15 },
      { id: 'p_p9', type: 'debrief',    title: 'Conclusion & Discussion de groupe',          duration: 20 },
    ],
  },
  {
    id: 'tpl_autonomie',
    sessionId: 'sess_5',
    baremeId: 'b_sess_5',
    nom: 'SESSION 5 - AUTONOMIE & COMPÉTITIVITÉ',
    type: 'Atelier HaPPi',
    duree: '3h',
    description: "Développer l'autonomie, le respect des délais et la compétitivité saine via Supermarket Together (solo) et Mario Kart.",
    tags: ['Autonomie', 'Délais', 'Compétition'],
    color: '#F59E0B', bg: '#FFFBEB', emoji: '🏆',
    theme: 'Autonomie',
    objectives: [
      "Développer l'auto-organisation sans supervision",
      "Renforcer la polyvalence et la gestion des priorités",
      "Pratiquer la compétition saine comme moteur de performance",
      "Consolider les apprentissages des 5 sessions",
    ],
    parts: [
      { id: 'au_p1', type: 'intro',      title: 'Accueil & Cadrage — Autonomie & Compétitivité', duration: 10 },
      { id: 'au_p2', type: 'theory',     title: "Introduction à l'Autonomie et la Compétitivité", duration: 10 },
      { id: 'au_p3', type: 'practice',   title: "Icebreaker — Jeu de l'Imposteur",               duration: 15 },
      { id: 'au_p4', type: 'discussion', title: 'Débat thématique OUI/NON',                       duration: 20 },
      { id: 'au_p5', type: 'break',      title: 'Pause',                                          duration: 10 },
      { id: 'au_p6', type: 'practice',   title: 'Supermarket Together — Mode autonomie',          duration: 20 },
      { id: 'au_p7', type: 'practice',   title: 'Mario Kart — Compétition et pression',           duration: 40 },
      { id: 'au_p8', type: 'theory',     title: 'Quiz de consolidation',                          duration: 15 },
      { id: 'au_p9', type: 'debrief',    title: 'Conclusion & Bilan du programme',                duration: 20 },
    ],
  },
]

/* ── Valeur par défaut du formulaire ────────────────────────────── */
const EMPTY_FORM = {
  nom: '', date: '', heure: '09:00', lieu: '', type: 'Atelier',
  statut: 'à venir', description: '', baremeId: '',
  participants: [],
  competences: ["Relationnel", "Esprit d'équipe", "Compréhension", "Adaptabilité",
    "Gestion des priorités", "Gestion du stress", "Leadership", "Force de proposition"],
  parts: [], objectives: [], theme: '',
};

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════ */
export default function Sessions({ data, update }) {
  const navigate = useNavigate();
  const { sessions } = data;
  const fileInputRef = useRef(null);
  const baremes = data.baremes || [];
  const hiddenTemplates = data.hiddenTemplates || [];

  const deleteTemplate = id => update(prev => ({ ...prev, hiddenTemplates: [...(prev.hiddenTemplates || []), id] }));
  const restoreTemplate = id => update(prev => ({ ...prev, hiddenTemplates: (prev.hiddenTemplates || []).filter(t => t !== id) }));
  const visibleTemplates = SESSION_TEMPLATES.filter(t => !hiddenTemplates.includes(t.id));

  /* ── State ── */
  const [showModal, setShowModal]       = useState(false);
  const [modalMode, setModalMode]       = useState('choice'); // 'choice' | 'templates' | 'template_step2' | 'create_choice' | 'pdf' | 'form'
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [viewMode, setViewMode]         = useState('list');

  /* template flow */
  const [templateSearch, setTemplateSearch] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  /* PDF flow */
  const [pdfFile, setPdfFile]       = useState(null);
  const [pdfDrag, setPdfDrag]       = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError]     = useState('');

  /* ── Sorted sessions ── */
  const sorted = useMemo(() => [...sessions].sort((a, b) => new Date(b.date) - new Date(a.date)), [sessions]);
  const upcoming = sorted.filter(s => s.statut === 'à venir');
  const ongoing  = sorted.filter(s => s.statut === 'en cours');
  const done     = sorted.filter(s => s.statut === 'terminée');

  /* ── Open / close modal ── */
  const openModal = () => {
    setForm(EMPTY_FORM);
    setModalMode('choice');
    setSelectedTemplate(null);
    setTemplateSearch('');
    setPdfFile(null);
    setPdfError('');
    setPdfLoading(false);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setPdfLoading(false);
  };

  /* ── Création ── */
  const handleCreate = () => {
    if (!form.nom || !form.date) return;
    // If created from a template linked to an existing session, navigate to that session's player
    if (selectedTemplate?.sessionId) {
      const newS = { ...form, id: 's' + Date.now(), templateSessionId: selectedTemplate.sessionId };
      update(prev => ({ ...prev, sessions: [...(prev.sessions || []), newS] }));
      closeModal();
      navigate(`/sessions/${selectedTemplate.sessionId}/player`);
      return;
    }
    const newS = { ...form, id: 's' + Date.now() };
    update(prev => ({ ...prev, sessions: [...(prev.sessions || []), newS] }));
    closeModal();
    navigate(`/sessions/${newS.id}/player`);
  };

  /* ── Suppression ── */
  const handleDelete = (id) => {
    update(prev => ({ ...prev, sessions: (prev.sessions || []).filter(s => s.id !== id) }));
    setDeleteConfirm(null);
  };

  /* ── Duplication ── */
  const handleDuplicate = (session) => {
    const newS = { ...session, id: 's' + Date.now(), nom: session.nom + ' (copie)', statut: 'à venir' };
    update(prev => ({ ...prev, sessions: [...(prev.sessions || []), newS] }));
  };

  /* ── Template → formulaire ── */
  const applyTemplate = (tpl) => {
    setSelectedTemplate(tpl);
    // Auto-select the matching session barème if it exists
    const sessionBareme = baremes.find(b => b.id === tpl.baremeId || (b.type === 'Session' && b.templateId === tpl.id));
    setForm(f => ({
      ...f,
      nom: tpl.nom,
      type: tpl.type,
      description: tpl.description,
      baremeId: sessionBareme ? sessionBareme.id : f.baremeId,
      parts: tpl.parts || [],
      objectives: tpl.objectives || [],
      theme: tpl.theme || '',
    }));
    setModalMode('template_step2');
  };

  /* ── PDF → extraction du nom + pré-remplissage ── */
  const processPdf = (file) => {
    if (!file || !file.type.includes('pdf')) {
      setPdfError('Veuillez envoyer un fichier PDF valide.');
      return;
    }
    setPdfLoading(true);
    setPdfError('');
    setPdfFile(file);

    // Extraire le nom du fichier comme titre par défaut
    const rawName = file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
    const cleanName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

    // Lecture binaire pour extraire du texte brut (meilleur effort)
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const binary = new Uint8Array(e.target.result);
        let text = '';
        for (let i = 0; i < Math.min(binary.length, 50000); i++) {
          const c = binary[i];
          if (c >= 32 && c < 127) text += String.fromCharCode(c);
          else if (c === 10 || c === 13) text += ' ';
        }
        // Chercher des lignes lisibles (≥ 20 chars sans trop de symboles)
        const lines = text.split(/\s{3,}/)
          .map(l => l.replace(/[^\w\sàâäéèêëîïôùûü',.\-]/gi, '').trim())
          .filter(l => l.length >= 20 && l.length < 150 && /\w/.test(l));

        const description = lines.slice(0, 3).join(' · ') || '';

        setForm(f => ({
          ...f,
          nom: cleanName,
          description: description || f.description,
          type: 'Formation',
        }));
      } catch {
        setForm(f => ({ ...f, nom: cleanName }));
      }
      setPdfLoading(false);
      setModalMode('form');
    };
    reader.onerror = () => {
      setPdfError('Impossible de lire le fichier.');
      setPdfLoading(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setPdfDrag(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processPdf(file);
  };

  /* ── Titre de la modal ── */
  const modalTitle = {
    choice:         'Nouvelle session',
    templates:      'Choisir un modèle',
    template_step2: 'Planifier la session',
    create_choice:  'Créer une session',
    pdf:            'Importer un PDF',
    form:           'Informations de la session',
  }[modalMode] || 'Nouvelle session';

  /* ── Back button dans la modal ── */
  const modalBack = {
    templates:      () => setModalMode('choice'),
    template_step2: () => setModalMode('templates'),
    create_choice:  () => setModalMode('choice'),
    pdf:            () => setModalMode('create_choice'),
    form:           () => setModalMode('create_choice'),
  }[modalMode];

  /* ── Carte session ── */
  const SessionCard = ({ session }) => {
    const date = new Date(session.date);
    const day  = format(date, 'd', { locale: fr });
    const month = format(date, 'MMM', { locale: fr }).toUpperCase().replace('.', '');
    return (
      <div
        className="bg-white rounded-2xl border border-slate-100 p-4 md:p-5 hover:shadow-md cursor-pointer transition-all duration-200 group"
        style={{ boxShadow: '0 1px 4px rgba(16,44,50,0.06)' }}
        onClick={() => navigate(`/sessions/${session.id}`)}
      >
        <div className="flex items-start gap-4">
          {/* Bloc date */}
          <div className="flex-shrink-0 w-[56px] h-[56px] rounded-xl bg-slate-50 border border-slate-100 flex flex-col items-center justify-center gap-0.5">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">{month}</span>
            <span className="text-2xl font-black text-slate-700 leading-none">{day}</span>
          </div>

          {/* Contenu principal */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <h3 className="font-bold text-[15px] text-slate-800 group-hover:text-happi-orange transition-colors leading-snug">{session.nom}</h3>
              <StatusBadge statut={session.statut} />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-500 mb-2">
              <span className="flex items-center gap-1"><Clock size={12} />{session.heure}</span>
              {session.lieu && <span className="flex items-center gap-1"><MapPin size={12} />{session.lieu}</span>}
              <span className="flex items-center gap-1"><Users size={12} />{session.participants?.length || 0} participant{(session.participants?.length || 0) !== 1 ? 's' : ''}</span>
            </div>
            {session.description && (
              <p className="text-[12px] text-slate-400 line-clamp-1 mb-2">{session.description}</p>
            )}
            <div className="flex items-center justify-between gap-2">
              {session.type && (
                <span className="inline-block text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">{session.type}</span>
              )}
              <div className="flex items-center gap-1 ml-auto" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => navigate(`/sessions/${session.id}/player`)}
                  className="flex items-center gap-1.5 text-xs font-bold text-white bg-happi-orange hover:bg-happi-orange/90 px-3 py-1.5 rounded-xl transition-all"
                >
                  <Play size={11} fill="white" /> Lancer
                </button>
                <button onClick={() => handleDuplicate(session)} className="p-1.5 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-all" title="Dupliquer"><Copy size={13} /></button>
                <button onClick={() => setDeleteConfirm(session.id)} className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all" title="Supprimer"><Trash2 size={13} /></button>
                <button onClick={() => navigate(`/sessions/${session.id}`)} className="p-1.5 rounded-lg text-slate-300 hover:text-happi-orange hover:bg-happi-orange-light transition-all"><ChevronRight size={13} /></button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ══════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-6">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
          <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'list' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Liste</button>
          <button onClick={() => setViewMode('grid')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'grid' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Grille</button>
        </div>
        <div className="flex items-center gap-3 ml-auto flex-wrap">
          <div className="hidden sm:flex gap-3 text-sm text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" />{upcoming.length} à venir</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400" />{ongoing.length} en cours</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-400" />{done.length} terminées</span>
          </div>
          <button onClick={openModal} className="btn-primary">
            <Plus size={16} /> Nouvelle session
          </button>
        </div>
      </div>

      {/* ── Liste / Grille ── */}
      {sessions.length === 0 ? (
        <div className="card text-center py-16">
          <Calendar size={40} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">Aucune session créée</p>
          <p className="text-sm text-slate-300 mt-1">Créez votre première session de formation</p>
          <button onClick={openModal} className="btn-primary mx-auto mt-4"><Plus size={16} /> Créer une session</button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sorted.map(s => <SessionCard key={s.id} session={s} />)}
        </div>
      ) : (
        <div className="space-y-8">
          {ongoing.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">En cours · {ongoing.length}</h2>
              </div>
              <div className="space-y-3">
                {ongoing.map(s => <SessionCard key={s.id} session={s} />)}
              </div>
            </div>
          )}
          {upcoming.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">À venir · {upcoming.length}</h2>
              </div>
              <div className="space-y-3">
                {upcoming.map(s => <SessionCard key={s.id} session={s} />)}
              </div>
            </div>
          )}
          {done.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Terminées · {done.length}</h2>
              </div>
              <div className="space-y-3">
                {done.map(s => <SessionCard key={s.id} session={s} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          MODAL CRÉATION MULTI-ÉTAPES
      ══════════════════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-white w-full md:max-w-lg md:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col max-h-[92vh]">

            {/* ── En-tête modal ── */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {modalBack && (
                  <button onClick={modalBack} className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 -ml-1 flex-shrink-0">
                    <ArrowLeft size={16} />
                  </button>
                )}
                <div className="min-w-0">
                  <h2 className="font-bold text-slate-800 text-base truncate" style={{ fontFamily: 'Poppins,sans-serif' }}>{modalTitle}</h2>
                  {/* Indicateur étape pour template */}
                  {(modalMode === 'templates' || modalMode === 'template_step2') && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {[1, 2].map(i => (
                        <div key={i} className="h-1 rounded-full transition-all"
                          style={{
                            width: (modalMode === 'templates' ? i === 1 : i === 2) ? 20 : 10,
                            background: (modalMode === 'templates' ? i === 1 : i <= 2) ? '#10B981' : '#e2e8f0',
                          }} />
                      ))}
                      <span className="text-[10px] text-slate-400 font-bold">{modalMode === 'templates' ? 1 : 2}/2</span>
                    </div>
                  )}
                </div>
                {pdfFile && modalMode === 'form' && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full text-xs font-bold flex-shrink-0">
                    <Sparkles size={11} /> PDF
                  </span>
                )}
              </div>
              <button onClick={closeModal} className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 flex-shrink-0"><X size={18} /></button>
            </div>

            {/* ════ MODE CHOIX PRINCIPAL ════ */}
            {modalMode === 'choice' && (
              <div className="flex-1 px-6 py-6 space-y-3 overflow-y-auto">
                <p className="text-sm text-slate-500 mb-5">Comment souhaitez-vous créer cette session ?</p>

                {/* Option : modèle existant */}
                <button onClick={() => setModalMode('templates')}
                  className="w-full p-5 rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 hover:border-emerald-400 hover:shadow-md transition-all text-left group">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                      <CheckCircle size={22} className="text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-base" style={{ fontFamily: 'Poppins,sans-serif' }}>Utiliser un modèle existant</p>
                      <p className="text-sm text-slate-500 mt-0.5">Choisissez parmi {SESSION_TEMPLATES.length} sessions pré-configurées et ajoutez juste la date et le lieu.</p>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {['Découverte', 'HBS', 'CV', 'Entretien', 'Leadership'].map(t => (
                          <span key={t} className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{t}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>

                {/* Option : créer nouvelle */}
                <button onClick={() => setModalMode('create_choice')}
                  className="w-full p-5 rounded-2xl border-2 border-slate-200 bg-white hover:border-happi-orange hover:shadow-sm transition-all text-left group">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-happi-orange-light flex items-center justify-center flex-shrink-0 group-hover:bg-happi-orange/20 transition-colors">
                      <Plus size={22} className="text-happi-orange" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-base" style={{ fontFamily: 'Poppins,sans-serif' }}>Créer une nouvelle session</p>
                      <p className="text-sm text-slate-500 mt-0.5">Importez un PDF ou remplissez manuellement les informations de la session.</p>
                    </div>
                  </div>
                </button>
              </div>
            )}

            {/* ════ MODE MODÈLES ════ */}
            {modalMode === 'templates' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Search */}
                <div className="px-6 py-3 border-b border-slate-50">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Rechercher un modèle..."
                      value={templateSearch}
                      onChange={e => setTemplateSearch(e.target.value)}
                      className="input pl-9 text-sm"
                    />
                  </div>
                </div>
                {/* Grid de modèles */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {visibleTemplates
                      .filter(t => !templateSearch || t.nom.toLowerCase().includes(templateSearch.toLowerCase()) || t.tags.some(tag => tag.toLowerCase().includes(templateSearch.toLowerCase())))
                      .map(tpl => (
                        <div key={tpl.id} className="relative group/card">
                          <button onClick={() => applyTemplate(tpl)}
                            className="w-full p-4 rounded-2xl border-2 border-slate-100 bg-white hover:shadow-md transition-all text-left"
                            onMouseEnter={e => e.currentTarget.style.borderColor = tpl.color + '80'}
                            onMouseLeave={e => e.currentTarget.style.borderColor = ''}>
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                                style={{ background: tpl.bg }}>
                                {tpl.emoji}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-800 text-sm leading-tight truncate">{tpl.nom}</p>
                                <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: tpl.color }}>
                                  <Clock size={10} /> {tpl.duree}
                                </p>
                                <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">{tpl.description}</p>
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {tpl.tags.map(tag => (
                                    <span key={tag} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                                      style={{ background: tpl.bg, color: tpl.color }}>{tag}</span>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center justify-end mt-2">
                              <span className="text-xs font-semibold flex items-center gap-1" style={{ color: tpl.color }}>
                                Sélectionner <ChevronRight size={12} />
                              </span>
                            </div>
                          </button>
                          {/* Bouton supprimer — hover sur desktop, toujours visible sur mobile */}
                          <button
                            onClick={e => { e.stopPropagation(); deleteTemplate(tpl.id); }}
                            className="absolute top-2 right-2 md:opacity-0 md:group-hover/card:opacity-100 transition-opacity w-7 h-7 md:w-6 md:h-6 rounded-full bg-red-50 hover:bg-red-100 flex items-center justify-center"
                            title="Masquer ce modèle">
                            <X size={13} className="text-red-400" />
                          </button>
                        </div>
                      ))}
                  </div>
                  {/* Modèles masqués — restauration */}
                  {hiddenTemplates.length > 0 && (
                    <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-xs font-semibold text-slate-500 mb-2">
                        {hiddenTemplates.length} modèle{hiddenTemplates.length > 1 ? 's' : ''} masqué{hiddenTemplates.length > 1 ? 's' : ''}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {SESSION_TEMPLATES.filter(t => hiddenTemplates.includes(t.id)).map(tpl => (
                          <button key={tpl.id} onClick={() => restoreTemplate(tpl.id)}
                            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                            style={{ color: tpl.color }}>
                            <span>{tpl.emoji}</span> {tpl.nom}
                            <span className="text-slate-400 text-[10px] ml-0.5">↩ restaurer</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ════ MODE MODÈLE ÉTAPE 2 : date/heure/lieu ════ */}
            {modalMode === 'template_step2' && selectedTemplate && (
              <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto">
                <div className="px-4 md:px-6 py-5 space-y-4">
                  {/* Résumé du modèle choisi */}
                  <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: selectedTemplate.bg }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: selectedTemplate.color + '20' }}>
                      {selectedTemplate.emoji}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 text-sm truncate">{selectedTemplate.nom}</p>
                      <p className="text-xs" style={{ color: selectedTemplate.color }}>{selectedTemplate.type} · {selectedTemplate.duree}</p>
                    </div>
                    <button onClick={() => setModalMode('templates')} className="ml-auto text-xs text-slate-400 hover:text-slate-600 flex-shrink-0">Changer</button>
                  </div>

                  {/* Titre (modifiable) */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nom de la session</label>
                    <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} className="input" />
                  </div>

                  {/* Date + Heure */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
                      <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="input" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Heure</label>
                      <input type="time" value={form.heure} onChange={e => setForm(f => ({ ...f, heure: e.target.value }))} className="input" />
                    </div>
                  </div>

                  {/* Lieu */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Lieu</label>
                    <input value={form.lieu} onChange={e => setForm(f => ({ ...f, lieu: e.target.value }))} placeholder="Salle, adresse, en ligne…" className="input" />
                    {/* Quick locations */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {['Salle A', 'Salle B', 'En ligne', 'Extérieur'].map(l => (
                        <button key={l} type="button" onClick={() => setForm(f => ({ ...f, lieu: l }))}
                          className="text-xs px-2.5 py-1 rounded-full border transition-all"
                          style={{
                            borderColor: form.lieu === l ? '#FF8650' : '#e2e8f0',
                            background: form.lieu === l ? '#FFF1EB' : 'white',
                            color: form.lieu === l ? '#FF8650' : '#64748b',
                          }}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Statut */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Statut</label>
                    <select value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value }))} className="input">
                      {['à venir', 'en cours', 'terminée'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  {/* Barème */}
                  {baremes.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Barème d'évaluation <span className="text-slate-400 font-normal">(optionnel)</span></label>
                      <select value={form.baremeId} onChange={e => setForm(f => ({ ...f, baremeId: e.target.value }))} className="input">
                        <option value="">— Aucun barème —</option>
                        {baremes.map(b => (
                          <option key={b.id} value={b.id}>{b.nom} ({b.criteres.length} critères · /{b.noteMax})</option>
                        ))}
                      </select>
                      {form.baremeId && (() => {
                        const bar = baremes.find(b => b.id === form.baremeId);
                        if (!bar) return null;
                        return (
                          <div className="mt-2 p-3 rounded-xl flex items-center gap-2" style={{ background: '#FFF1EB' }}>
                            <SlidersHorizontal size={14} style={{ color: '#FF8650' }} />
                            <p className="text-xs text-slate-600">
                              <strong>{bar.criteres.length} critères</strong> · Note max <strong>/{bar.noteMax}</strong> · Total <strong>{bar.criteres.reduce((s, c) => s + c.coefficient * bar.noteMax, 0)} pts</strong>
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
              {/* Footer sticky */}
              <div className="px-4 md:px-6 py-3 md:pb-6 border-t border-slate-100 flex gap-3 flex-shrink-0">
                <button onClick={closeModal} className="btn-secondary flex-shrink-0">Annuler</button>
                <button onClick={handleCreate} disabled={!form.nom || !form.date} className="btn-primary disabled:opacity-50 flex-1 justify-center">
                  <Plus size={16} /> Créer la session
                </button>
              </div>
              </div>
            )}

            {/* ════ MODE CRÉATION (PDF / Manuel) ════ */}
            {modalMode === 'create_choice' && (
              <div className="flex-1 px-6 py-6 space-y-3 overflow-y-auto">
                <p className="text-sm text-slate-500 mb-5">Comment souhaitez-vous créer cette session ?</p>

                {/* Option PDF */}
                <button onClick={() => setModalMode('pdf')}
                  className="w-full p-5 rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 hover:border-violet-400 hover:shadow-md transition-all text-left group">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-violet-600 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                      <FileText size={22} className="text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-base" style={{ fontFamily: 'Poppins,sans-serif' }}>Importer un PDF</p>
                      <p className="text-sm text-slate-500 mt-0.5">Glissez votre support de cours ou programme. Le titre et la description seront pré-remplis automatiquement.</p>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {['Titre auto', 'Description', 'Gain de temps'].map(t => (
                          <span key={t} className="text-[10px] font-bold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">{t}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>

                {/* Option manuelle */}
                <button onClick={() => setModalMode('form')}
                  className="w-full p-5 rounded-2xl border-2 border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition-all text-left group">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 group-hover:bg-slate-200 transition-colors">
                      <Edit2 size={20} className="text-slate-600" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-base" style={{ fontFamily: 'Poppins,sans-serif' }}>Créer manuellement</p>
                      <p className="text-sm text-slate-500 mt-0.5">Remplissez les informations étape par étape.</p>
                    </div>
                  </div>
                </button>
              </div>
            )}

            {/* ════ MODE PDF ════ */}
            {modalMode === 'pdf' && (
              <div className="flex-1 px-6 py-6 overflow-y-auto">
                <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) processPdf(f); }} />

                {pdfLoading ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center">
                      <Sparkles size={28} className="text-violet-600 animate-pulse" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-slate-800">Analyse du PDF en cours…</p>
                      <p className="text-sm text-slate-400 mt-1">Extraction des informations</p>
                    </div>
                    <div className="w-48 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-1.5 rounded-full bg-violet-500 animate-pulse" style={{ width: '60%' }} />
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Zone drag & drop */}
                    <div
                      onDragOver={e => { e.preventDefault(); setPdfDrag(true); }}
                      onDragLeave={() => setPdfDrag(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all"
                      style={{
                        borderColor: pdfDrag ? '#7C3AED' : '#e2e8f0',
                        background: pdfDrag ? '#F5F3FF' : '#FAFAFA',
                      }}>
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                        style={{ background: pdfDrag ? '#EDE9FE' : '#F1F5F9' }}>
                        <Upload size={26} style={{ color: pdfDrag ? '#7C3AED' : '#94a3b8' }} />
                      </div>
                      <p className="font-semibold text-slate-700 mb-1">
                        {pdfDrag ? 'Relâchez pour importer' : 'Glissez votre PDF ici'}
                      </p>
                      <p className="text-sm text-slate-400">ou <span className="text-violet-600 font-medium">cliquez pour parcourir</span></p>
                      <p className="text-xs text-slate-300 mt-3">Fichiers PDF uniquement</p>
                    </div>

                    {pdfError && (
                      <div className="flex items-center gap-2 mt-4 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
                        <AlertCircle size={16} className="flex-shrink-0" />{pdfError}
                      </div>
                    )}

                    <p className="text-xs text-slate-400 text-center mt-6 leading-relaxed">
                      Le nom du fichier et le contenu textuel du PDF seront utilisés pour pré-remplir le formulaire.
                    </p>
                  </>
                )}
              </div>
            )}

            {/* ════ MODE FORMULAIRE MANUEL ════ */}
            {modalMode === 'form' && (
              <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto">
                <div className="p-4 md:p-6 space-y-4">
                  {/* Badge PDF si vient d'un import */}
                  {pdfFile && (
                    <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: '#F5F3FF', border: '1px solid #DDD6FE' }}>
                      <FileText size={14} className="text-violet-600 flex-shrink-0" />
                      <p className="text-xs text-violet-700 font-medium truncate">{pdfFile.name}</p>
                      <button onClick={() => { setPdfFile(null); setForm(f => ({ ...f, nom: '', description: '' })); }} className="ml-auto text-slate-400 hover:text-slate-600">
                        <X size={12} />
                      </button>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nom de la session *</label>
                    <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="Ex : Atelier découverte — Janvier 2026" className="input" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
                      <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="input" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Heure</label>
                      <input type="time" value={form.heure} onChange={e => setForm(f => ({ ...f, heure: e.target.value }))} className="input" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Lieu</label>
                    <input value={form.lieu} onChange={e => setForm(f => ({ ...f, lieu: e.target.value }))} placeholder="Salle, adresse, en ligne…" className="input" />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {['Salle A', 'Salle B', 'En ligne', 'Extérieur'].map(l => (
                        <button key={l} type="button" onClick={() => setForm(f => ({ ...f, lieu: l }))}
                          className="text-xs px-2.5 py-1 rounded-full border transition-all"
                          style={{
                            borderColor: form.lieu === l ? '#FF8650' : '#e2e8f0',
                            background: form.lieu === l ? '#FFF1EB' : 'white',
                            color: form.lieu === l ? '#FF8650' : '#64748b',
                          }}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                      <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="input">
                        {['Atelier découverte', 'Formation', 'Atelier', 'Jeu pédagogique', 'Séminaire', 'Coaching'].map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Statut</label>
                      <select value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value }))} className="input">
                        {['à venir', 'en cours', 'terminée'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                    <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      rows={3} className="input resize-none" placeholder="Objectifs, contenu, déroulé…" />
                  </div>

                  {/* Barème */}
                  {baremes.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Barème d'évaluation <span className="text-slate-400 font-normal">(optionnel)</span></label>
                      <select value={form.baremeId} onChange={e => setForm(f => ({ ...f, baremeId: e.target.value }))} className="input">
                        <option value="">— Aucun barème —</option>
                        {baremes.map(b => (
                          <option key={b.id} value={b.id}>{b.nom} ({b.criteres.length} critères · /{b.noteMax})</option>
                        ))}
                      </select>
                      {form.baremeId && (() => {
                        const bar = baremes.find(b => b.id === form.baremeId);
                        if (!bar) return null;
                        return (
                          <div className="mt-2 p-3 rounded-xl flex items-center gap-2" style={{ background: '#FFF1EB' }}>
                            <SlidersHorizontal size={14} style={{ color: '#FF8650' }} />
                            <p className="text-xs text-slate-600">
                              <strong>{bar.criteres.length} critères</strong> · Note max <strong>/{bar.noteMax}</strong> · Total <strong>{bar.criteres.reduce((s, c) => s + c.coefficient * bar.noteMax, 0)} pts</strong>
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

              </div>
              {/* Footer sticky */}
              <div className="px-4 md:px-6 py-3 md:pb-6 border-t border-slate-100 flex gap-3 flex-shrink-0">
                <button onClick={closeModal} className="btn-secondary flex-shrink-0">Annuler</button>
                <button onClick={handleCreate} disabled={!form.nom || !form.date} className="btn-primary disabled:opacity-50 flex-1 justify-center">
                  <Plus size={16} /> Créer la session
                </button>
              </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ── Confirmation suppression ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={20} className="text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Supprimer la session ?</h3>
            <p className="text-sm text-slate-500 mb-6">Cette action est irréversible.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary">Annuler</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="btn-danger">Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
