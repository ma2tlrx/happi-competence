import { useState, useEffect, useRef } from 'react';
import { initialParticipants, initialSessions, initialPresences, initialEvaluations } from '../data/initialData';
import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'happi_formateur_data';

const ADMIN_ACCOUNT = {
  id: 'admin',
  email: 'admin@happicompetence.fr',
  password: 'admin123',
  nom: 'Admin',
  prenom: 'Happi',
  organisation: 'Happi Compétence',
  role: 'formateur',
};

/* ─── HBS helper — crée des critères HBS pour une session ─── */
const makeHbs = (prefix, labels) => labels.map((label, i) => ({
  id: `${prefix}_hbs_${i + 1}`,
  label,
  section: 'HBS',
  coefficient: 1,
  noteMax: 4,
}));

const SESSION_ECHELLE = [
  { valeur: 1, label: 'Non acquis',            color: '#EF4444' },
  { valeur: 2, label: 'En difficulté',          color: '#F97316' },
  { valeur: 3, label: "En cours d'acquisition", color: '#3B82F6' },
  { valeur: 4, label: 'Acquis',                 color: '#10B981' },
  { valeur: 5, label: 'Dépassé',                color: '#7C3AED' },
];

const DEFAULT_BAREMES = [

  /* ── SESSION 1 — LA COMMUNICATION ── */
  {
    id: 'b_sess_1',
    nom: 'SESSION 1 - LA COMMUNICATION',
    description: "Relationnel, Esprit d'équipe, Compréhension + HBS",
    type: 'Session',
    noteMax: 5,
    echelle: SESSION_ECHELLE,
    criteres: [
      { id: 's1_ct1',  label: 'Écoute active',                          section: 'CT — Relationnel',         coefficient: 1 },
      { id: 's1_ct2',  label: 'Empathie',                               section: 'CT — Relationnel',         coefficient: 1 },
      { id: 's1_ct3',  label: 'Clarté et fluidité de communication', section: 'CT — Relationnel',    coefficient: 1 },
      { id: 's1_ct4',  label: 'Gestion des interactions',               section: 'CT — Relationnel',         coefficient: 1 },
      { id: 's1_ct5',  label: 'Gestion des conflits',                   section: 'CT — Relationnel',         coefficient: 1 },
      { id: 's1_ct6',  label: 'Collaboration',                          section: "CT — Esprit d'équipe", coefficient: 1 },
      { id: 's1_ct7',  label: 'Soutien aux collègues',             section: "CT — Esprit d'équipe", coefficient: 1 },
      { id: 's1_ct8',  label: 'Acceptation des différences',       section: "CT — Esprit d'équipe", coefficient: 1 },
      { id: 's1_ct9',  label: "Partage d'informations",                 section: "CT — Esprit d'équipe", coefficient: 1 },
      { id: 's1_ct10', label: 'Engagement collectif',                   section: "CT — Esprit d'équipe", coefficient: 1 },
      { id: 's1_ct11', label: 'Analyse des informations',               section: 'CT — Compréhension',   coefficient: 1 },
      { id: 's1_ct12', label: 'Interprétation des consignes',      section: 'CT — Compréhension',   coefficient: 1 },
      { id: 's1_ct13', label: 'Synthèse des éléments clés', section: 'CT — Compréhension', coefficient: 1 },
      { id: 's1_ct14', label: 'Réactivité aux explications',  section: 'CT — Compréhension',   coefficient: 1 },
      { id: 's1_ct15', label: "Identification des zones d'ombre",       section: 'CT — Compréhension',   coefficient: 1 },
      ...makeHbs('s1', ['Adaptation relationnelle', 'Coopération', "Traitement de l'information", 'Sensibilité sociale', 'Planification']),
    ],
    createdAt: new Date().toISOString().split('T')[0],
    isDefault: true,
  },

  /* ── SESSION 2 — ADAPTABILITÉ & GESTION DU STRESS ── */
  {
    id: 'b_sess_2',
    nom: 'SESSION 2 - ADAPTABILITÉ & GESTION DU STRESS',
    description: "Adaptabilité, Gestion des priorités, Gestion du stress + HBS",
    type: 'Session',
    noteMax: 5,
    echelle: SESSION_ECHELLE,
    criteres: [
      { id: 's2_ct1',  label: 'Réactivité face aux imprévus',          section: 'CT — Adaptabilité',           coefficient: 1 },
      { id: 's2_ct2',  label: 'Ouverture au changement',                    section: 'CT — Adaptabilité',           coefficient: 1 },
      { id: 's2_ct3',  label: 'Apprentissage rapide',                       section: 'CT — Adaptabilité',           coefficient: 1 },
      { id: 's2_ct4',  label: 'Capacité à sortir de sa zone de confort', section: 'CT — Adaptabilité',   coefficient: 1 },
      { id: 's2_ct5',  label: 'Flexibilité comportementale',           section: 'CT — Adaptabilité',           coefficient: 1 },
      { id: 's2_ct6',  label: 'Identification des tâches essentielles', section: 'CT — Gestion des priorités', coefficient: 1 },
      { id: 's2_ct7',  label: 'Planification efficace',                     section: 'CT — Gestion des priorités', coefficient: 1 },
      { id: 's2_ct8',  label: 'Capacité à respecter les échéances', section: 'CT — Gestion des priorités', coefficient: 1 },
      { id: 's2_ct9',  label: 'Gestion des imprévus',                  section: 'CT — Gestion des priorités', coefficient: 1 },
      { id: 's2_ct10', label: "Concentration sur l'essentiel",              section: 'CT — Gestion des priorités', coefficient: 1 },
      { id: 's2_ct11', label: 'Maîtrise émotionnelle',             section: 'CT — Gestion du stress',         coefficient: 1 },
      { id: 's2_ct12', label: 'Capacité à prendre du recul',      section: 'CT — Gestion du stress',         coefficient: 1 },
      { id: 's2_ct13', label: 'Gestion des imprévus sous pression',    section: 'CT — Gestion du stress',         coefficient: 1 },
      { id: 's2_ct14', label: 'Efficacité sous pression',              section: 'CT — Gestion du stress',         coefficient: 1 },
      { id: 's2_ct15', label: 'Stratégies de gestion du stress',       section: 'CT — Gestion du stress',         coefficient: 1 },
      ...makeHbs('s2', ['Auto-évaluation', 'Auto-régulation', 'Auto-organisation', 'Auto-mobilisation', 'Sensibilité sociale', 'Adaptation relationnelle', 'Planification', 'Arbitrage', 'Synthèse', 'Flexibilité mentale', 'Projection']),
    ],
    createdAt: new Date().toISOString().split('T')[0],
    isDefault: true,
  },

  /* ── SESSION 3 — LEADERSHIP ── */
  {
    id: 'b_sess_3',
    nom: 'SESSION 3 - LEADERSHIP',
    description: "Leadership, Force de proposition, Organisation + HBS",
    type: 'Session',
    noteMax: 5,
    echelle: SESSION_ECHELLE,
    criteres: [
      { id: 's3_ct1',  label: 'Vision et inspiration',                  section: 'CT — Leadership',            coefficient: 1 },
      { id: 's3_ct2',  label: 'Prise de décisions',                section: 'CT — Leadership',            coefficient: 1 },
      { id: 's3_ct3',  label: 'Responsabilité',                    section: 'CT — Leadership',            coefficient: 1 },
      { id: 's3_ct4',  label: 'Capacité à déléguer',section: 'CT — Leadership',            coefficient: 1 },
      { id: 's3_ct5',  label: 'Exemplarité',                       section: 'CT — Leadership',            coefficient: 1 },
      { id: 's3_ct6',  label: 'Créativité',                   section: 'CT — Force de proposition',  coefficient: 1 },
      { id: 's3_ct7',  label: 'Pertinence des suggestions',             section: 'CT — Force de proposition',  coefficient: 1 },
      { id: 's3_ct8',  label: 'Initiative',                             section: 'CT — Force de proposition',  coefficient: 1 },
      { id: 's3_ct9',  label: 'Capacité à argumenter ses idées', section: 'CT — Force de proposition', coefficient: 1 },
      { id: 's3_ct10', label: 'Persévérance',                 section: 'CT — Force de proposition',  coefficient: 1 },
      { id: 's3_ct11', label: 'Gestion du temps',                       section: 'CT — Organisation',          coefficient: 1 },
      { id: 's3_ct12', label: 'Planification des tâches',          section: 'CT — Organisation',          coefficient: 1 },
      { id: 's3_ct13', label: 'Rangement et gestion des outils',        section: 'CT — Organisation',          coefficient: 1 },
      { id: 's3_ct14', label: 'Suivi et respect des deadlines',         section: 'CT — Organisation',          coefficient: 1 },
      { id: 's3_ct15', label: 'Anticipation des besoins',               section: 'CT — Organisation',          coefficient: 1 },
      ...makeHbs('s3', ['Sensibilité sociale', 'Adaptation relationnelle', 'Coopération', 'Raisonnement logique', 'Arbitrage', 'Conceptualisation', 'Projection']),
    ],
    createdAt: new Date().toISOString().split('T')[0],
    isDefault: true,
  },

  /* ── SESSION 4 — ANALYSE DES PROBLÈMES ── */
  {
    id: 'b_sess_4',
    nom: 'SESSION 4 - ANALYSE DES PROBLÈMES',
    description: "Implication, Analyse des problèmes, Curiosité + HBS",
    type: 'Session',
    noteMax: 5,
    echelle: SESSION_ECHELLE,
    criteres: [
      { id: 's4_ct1',  label: 'Motivation',                             section: 'CT — Implication',            coefficient: 1 },
      { id: 's4_ct2',  label: 'Autonomie dans le travail',              section: 'CT — Implication',            coefficient: 1 },
      { id: 's4_ct3',  label: 'Fiabilité',                         section: 'CT — Implication',            coefficient: 1 },
      { id: 's4_ct4',  label: 'Persévérance',                 section: 'CT — Implication',            coefficient: 1 },
      { id: 's4_ct5',  label: 'Investissement personnel',               section: 'CT — Implication',            coefficient: 1 },
      { id: 's4_ct6',  label: 'Identification des causes',              section: "CT — Analyse des problèmes", coefficient: 1 },
      { id: 's4_ct7',  label: 'Évaluation des conséquences',   section: "CT — Analyse des problèmes", coefficient: 1 },
      { id: 's4_ct8',  label: 'Recherche de solutions adaptées',   section: "CT — Analyse des problèmes", coefficient: 1 },
      { id: 's4_ct9',  label: 'Prise de décision éclairée', section: "CT — Analyse des problèmes", coefficient: 1 },
      { id: 's4_ct10', label: 'Capacité à apprendre des erreurs', section: "CT — Analyse des problèmes", coefficient: 1 },
      { id: 's4_ct11', label: 'Ouverture aux nouvelles connaissances',  section: 'CT — Curiosité',         coefficient: 1 },
      { id: 's4_ct12', label: "Esprit d'exploration",                   section: 'CT — Curiosité',         coefficient: 1 },
      { id: 's4_ct13', label: "Volonté d'expérimenter",        section: 'CT — Curiosité',         coefficient: 1 },
      { id: 's4_ct14', label: 'Questionnement actif',                   section: 'CT — Curiosité',         coefficient: 1 },
      { id: 's4_ct15', label: 'Veille et autoformation',                section: 'CT — Curiosité',         coefficient: 1 },
      ...makeHbs('s4', ['Auto-évaluation', 'Auto-organisation', 'Auto-mobilisation', 'Coopération', 'Raisonnement logique', 'Arbitrage', "Traitement de l'information", 'Conceptualisation', 'Projection', 'Approche globale']),
    ],
    createdAt: new Date().toISOString().split('T')[0],
    isDefault: true,
  },

  /* ── SESSION 5 — AUTONOMIE & COMPÉTITIVITÉ ── */
  {
    id: 'b_sess_5',
    nom: 'SESSION 5 - AUTONOMIE & COMPÉTITIVITÉ',
    description: "Autonomie, Respect des délais, Polyvalence + HBS",
    type: 'Session',
    noteMax: 5,
    echelle: SESSION_ECHELLE,
    criteres: [
      { id: 's5_ct1',  label: 'Capacité à travailler sans supervision',   section: 'CT — Autonomie',           coefficient: 1 },
      { id: 's5_ct2',  label: "Prise d'initiatives",                        section: 'CT — Autonomie',           coefficient: 1 },
      { id: 's5_ct3',  label: 'Auto-organisation',                          section: 'CT — Autonomie',           coefficient: 1 },
      { id: 's5_ct4',  label: 'Autodiscipline',                             section: 'CT — Autonomie',           coefficient: 1 },
      { id: 's5_ct5',  label: 'Résolution des problèmes par soi-même', section: 'CT — Autonomie', coefficient: 1 },
      { id: 's5_ct6',  label: 'Planification des tâches',              section: 'CT — Respect des délais', coefficient: 1 },
      { id: 's5_ct7',  label: "Efficacité dans l'exécution",      section: 'CT — Respect des délais', coefficient: 1 },
      { id: 's5_ct8',  label: 'Anticipation des retards',                   section: 'CT — Respect des délais', coefficient: 1 },
      { id: 's5_ct9',  label: 'Capacité à travailler sous pression', section: 'CT — Respect des délais', coefficient: 1 },
      { id: 's5_ct10', label: 'Fiabilité',                             section: 'CT — Respect des délais', coefficient: 1 },
      { id: 's5_ct11', label: 'Capacité à apprendre rapidement',  section: 'CT — Polyvalence',         coefficient: 1 },
      { id: 's5_ct12', label: 'Adaptabilité aux différents contextes', section: 'CT — Polyvalence',    coefficient: 1 },
      { id: 's5_ct13', label: 'Compétences variées',              section: 'CT — Polyvalence',         coefficient: 1 },
      { id: 's5_ct14', label: 'Efficacité dans plusieurs rôles', section: 'CT — Polyvalence',          coefficient: 1 },
      { id: 's5_ct15', label: 'Résilience face aux changements de mission', section: 'CT — Polyvalence',   coefficient: 1 },
      ...makeHbs('s5', ['Auto-évaluation', 'Auto-régulation', 'Auto-organisation', 'Auto-mobilisation', 'Planification', "Traitement de l'information", 'Synthèse', 'Approche globale']),
    ],
    createdAt: new Date().toISOString().split('T')[0],
    isDefault: true,
  },
];

const defaultData = {
  user: ADMIN_ACCOUNT,          // currently-logged-in user object
  users: [ADMIN_ACCOUNT],       // all registered formateur accounts
  talentPasswords: {},          // { participantId: 'password' } for talent accounts
  baremes: DEFAULT_BAREMES,
  participants: initialParticipants,
  sessions: initialSessions,
  presences: initialPresences,
  evaluations: initialEvaluations,
  hiddenTemplates: [],          // IDs des modèles masqués/supprimés
  isLoggedIn: false,
};

/* ─── Migrate / validate a parsed data object ─────────────────────────── */
function migrateData(parsed) {
  const firstP = parsed.participants?.[0];
  const hasOldCompetences = firstP && (
    'Bon relationnel' in (firstP.competences || {}) ||
    'Adaptabilité'    in (firstP.competences || {}) ||
    ('Sensibilité sociale' in (firstP.competences || {}))
  );
  const missingHbs        = firstP && !firstP.hbs;
  const missingCTFormat   = firstP && firstP.competences && !('Rigueur' in (firstP.competences || {}));
  const missingHbsJeu     = firstP && !('hbsJeu'      in firstP);
  const missingCtAutoEval = firstP && !('ctAutoEval'  in firstP);

  if (hasOldCompetences || missingHbs || missingCTFormat || missingHbsJeu || missingCtAutoEval) {
    return {
      ...defaultData,
      isLoggedIn:      parsed.isLoggedIn,
      user:            parsed.user,
      users:           parsed.users           || defaultData.users,
      talentPasswords: parsed.talentPasswords || {},
    };
  }

  if (!parsed.participants || parsed.participants.length === 0) parsed.participants = initialParticipants;
  if (!parsed.sessions    || parsed.sessions.length    === 0) parsed.sessions    = initialSessions;
  if (!parsed.presences)   parsed.presences   = initialPresences;
  if (!parsed.evaluations) parsed.evaluations = initialEvaluations;

  if (!parsed.users || parsed.users.length === 0) parsed.users = defaultData.users;
  if (!parsed.talentPasswords) parsed.talentPasswords = {};
  if (!parsed.baremes || !parsed.baremes.some(b => b.id === 'b_sess_1')) {
    parsed.baremes = DEFAULT_BAREMES;
  }

  const sess1 = parsed.sessions?.find(s => s.id === 'sess_1');
  const hasNewStepContent = sess1?.steps?.[0]?.content?.includes('Objectifs de la session');
  if (!parsed.sessions || !parsed.sessions.some(s => s.id === 'sess_1') || !hasNewStepContent) {
    parsed.sessions    = defaultData.sessions;
    parsed.presences   = defaultData.presences;
    parsed.evaluations = defaultData.evaluations;
  }

  return parsed;
}

/* ─── Load initial data from localStorage ────────────────────────────── */
function loadLocalData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return migrateData(JSON.parse(stored));
  } catch (e) {
    console.error('Failed to load from localStorage', e);
  }
  return defaultData;
}

/* ─── Push data to Supabase (fire-and-forget) ────────────────────────── */
async function pushToSupabase(data) {
  if (!supabase) return;
  try {
    await supabase.from('app_data').upsert(
      { org_id: 'default', data, updated_at: new Date().toISOString() },
      { onConflict: 'org_id' }
    );
  } catch (e) {
    console.warn('Supabase sync failed (push):', e);
  }
}

export function useStore() {
  const [data, setData] = useState(loadLocalData);
  const syncedRef = useRef(false); // has Supabase data been fetched once?

  /* ── On mount: pull latest data from Supabase ─────────────────────── */
  useEffect(() => {
    if (!supabase || syncedRef.current) return;
    syncedRef.current = true;

    supabase.from('app_data').select('data').eq('org_id', 'default').single()
      .then(({ data: row, error }) => {
        if (error || !row?.data) {
          // No remote data yet — push local data to bootstrap Supabase
          setData(prev => { pushToSupabase(prev); return prev; });
          return;
        }
        const migrated = migrateData(row.data);
        setData(migrated);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated)); } catch (_) {}
      })
      .catch(e => console.warn('Supabase sync failed (pull):', e));
  }, []);

  /* ── Persist every state change to localStorage + Supabase ─────────── */
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {
      console.error('Failed to save to localStorage', e);
    }
    pushToSupabase(data);
  }, [data]);

  const update = (updater) => {
    setData(prev => typeof updater === 'function' ? updater(prev) : { ...prev, ...updater });
  };

  return { data, update };
}
