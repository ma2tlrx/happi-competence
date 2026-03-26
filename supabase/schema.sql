-- ══════════════════════════════════════════════════════════════════
-- HAPPI COMPÉTENCE — Schéma Supabase
-- Coller dans : Supabase → SQL Editor → New Query → Run
-- ══════════════════════════════════════════════════════════════════

-- Formatreurs (comptes admin)
CREATE TABLE formateurs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  nom         TEXT,
  prenom      TEXT,
  organisation TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Participants (talents)
CREATE TABLE participants (
  id               TEXT PRIMARY KEY,  -- ex: "p1", "p2"
  nom              TEXT,
  prenom           TEXT,
  email            TEXT,
  telephone        TEXT,
  age              TEXT,
  residence        TEXT,
  niveau_etudes    TEXT,
  domaines_etudes  TEXT,
  ambitions        TEXT,
  competences      JSONB DEFAULT '{}',
  hbs_jeu          JSONB DEFAULT '[]',
  ct_auto_eval     JSONB,
  talent_password  TEXT,
  date_inscription DATE,
  tags             JSONB DEFAULT '[]',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions
CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,
  nom         TEXT NOT NULL,
  date        DATE,
  heure       TEXT,
  lieu        TEXT,
  type        TEXT,
  statut      TEXT DEFAULT 'à venir',
  description TEXT,
  bareme_id   TEXT,
  steps       JSONB DEFAULT '[]',
  competences JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Participants inscrits à une session
CREATE TABLE session_participants (
  session_id     TEXT REFERENCES sessions(id) ON DELETE CASCADE,
  participant_id TEXT REFERENCES participants(id) ON DELETE CASCADE,
  PRIMARY KEY (session_id, participant_id)
);

-- Présences
CREATE TABLE presences (
  session_id     TEXT REFERENCES sessions(id) ON DELETE CASCADE,
  participant_id TEXT REFERENCES participants(id) ON DELETE CASCADE,
  statut         TEXT CHECK (statut IN ('présent', 'absent', 'retard')),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (session_id, participant_id)
);

-- Évaluations formateur
CREATE TABLE evaluations (
  session_id     TEXT REFERENCES sessions(id) ON DELETE CASCADE,
  participant_id TEXT REFERENCES participants(id) ON DELETE CASCADE,
  ct_checked     JSONB DEFAULT '{}',
  hbs_scores     JSONB DEFAULT '{}',
  ct_avg         FLOAT,
  hbs_avg        FLOAT,
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (session_id, participant_id)
);

-- Barèmes
CREATE TABLE baremes (
  id          TEXT PRIMARY KEY,
  nom         TEXT NOT NULL,
  description TEXT,
  type        TEXT,
  note_max    INT,
  echelle     JSONB DEFAULT '[]',
  criteres    JSONB DEFAULT '[]',
  is_default  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Row Level Security (RLS) ──────────────────────────────────────
ALTER TABLE participants        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE presences           ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE baremes             ENABLE ROW LEVEL SECURITY;

-- Politique simple : accès authentifié uniquement (à affiner selon les rôles)
CREATE POLICY "Authenticated users" ON participants        FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users" ON sessions            FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users" ON session_participants FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users" ON presences           FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users" ON evaluations         FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users" ON baremes             FOR ALL USING (auth.role() = 'authenticated');
