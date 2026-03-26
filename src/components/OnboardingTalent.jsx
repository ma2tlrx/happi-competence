/**
 * Formulaire d'étude du programme HaPPi
 * Reproduit la structure du formulaire original (image fournie)
 * 6 pages / étapes
 */
import { useState } from 'react';
import { ChevronRight, ChevronLeft, Check, SkipForward, Sparkles } from 'lucide-react';

const HBS_STATEMENTS = [
  { key: "Bon relationnel",        label: "J'ai de bonnes relations avec les autres" },
  { key: "Esprit d'équipe",        label: "J'aime et je sais travailler en équipe" },
  { key: "Compréhension",          label: "Je comprends facilement les consignes et les situations" },
  { key: "Adaptabilité",           label: "Je m'adapte facilement aux changements" },
  { key: "Gestion des priorités",  label: "Je sais bien organiser et gérer mes priorités" },
  { key: "Gestion du stress",      label: "Je gère bien mon stress en toutes circonstances" },
  { key: "Leadership",             label: "Je suis capable de diriger, d'entraîner un groupe" },
  { key: "Force de proposition",   label: "Je propose régulièrement des idées et des solutions" },
  { key: "Organisation",           label: "Je suis organisé(e) et méthodique dans mon travail" },
  { key: "Implication",            label: "Je suis pleinement impliqué(e) dans ce que je fais" },
  { key: "Analyse des problèmes",  label: "J'analyse bien les problèmes avant d'agir" },
  { key: "Curiosité",              label: "Je suis curieux(se) et j'aime apprendre de nouvelles choses" },
  { key: "Autonomie",              label: "Je travaille de façon autonome sans avoir besoin d'être guidé(e)" },
  { key: "Respect des délais",     label: "Je respecte les délais et les échéances qui me sont fixés" },
  { key: "Polyvalence",            label: "Je suis polyvalent(e) et capable de m'adapter à des tâches variées" },
];

const SCALE_LABELS = ['', "Pas du tout d'accord", "Plutôt pas d'accord", 'Neutre', "Plutôt d'accord", "Tout à fait d'accord"];

const TOTAL_STEPS = 6;

/* ── Shared UI ─────────────────────────────────────────────────── */
function ProgressBar({ step }) {
  return (
    <div>
      <div className="flex gap-1.5 mb-1">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div key={i} className="flex-1 h-1.5 rounded-full transition-all duration-300"
            style={{ background: i < step ? '#FF8650' : i === step ? '#FFD4BC' : '#F1F5F9' }} />
        ))}
      </div>
      <p className="text-right text-[10px] text-slate-400">Étape {step + 1}/{TOTAL_STEPS}</p>
    </div>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <div className="mb-5 pb-4 border-b border-slate-100">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-2" style={{ background: '#FFF1EB', color: '#FF8650' }}>
        <Sparkles size={11} /> Formulaire HaPPi
      </div>
      <h2 className="text-lg font-bold text-happi-teal" style={{ fontFamily: 'Poppins,sans-serif' }}>{title}</h2>
      {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function Radio({ options, value, onChange, cols = 1 }) {
  return (
    <div className={`grid gap-2 ${cols === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
      {options.map(opt => {
        const lbl = typeof opt === 'string' ? opt : opt.label;
        const val = typeof opt === 'string' ? opt : opt.value;
        const on  = value === val;
        return (
          <button key={val} type="button" onClick={() => onChange(val)}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 text-sm font-medium text-left transition-all"
            style={{ borderColor: on ? '#FF8650' : '#E2E8F0', background: on ? '#FFF1EB' : 'white', color: on ? '#FF8650' : '#475569' }}>
            <div className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
              style={{ borderColor: on ? '#FF8650' : '#CBD5E1', background: on ? '#FF8650' : 'white' }}>
              {on && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
            {lbl}
          </button>
        );
      })}
    </div>
  );
}

function Checkbox({ options, value = [], onChange, cols = 1 }) {
  const toggle = (o) => onChange(value.includes(o) ? value.filter(v => v !== o) : [...value, o]);
  return (
    <div className={`grid gap-2 ${cols === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
      {options.map(opt => {
        const on = value.includes(opt);
        return (
          <button key={opt} type="button" onClick={() => toggle(opt)}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 text-sm font-medium text-left transition-all"
            style={{ borderColor: on ? '#FF8650' : '#E2E8F0', background: on ? '#FFF1EB' : 'white', color: on ? '#FF8650' : '#475569' }}>
            <div className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center"
              style={{ background: on ? '#FF8650' : 'white', border: on ? 'none' : '2px solid #CBD5E1' }}>
              {on && <Check size={10} className="text-white" />}
            </div>
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function Q({ label, required, children }) {
  return (
    <div className="mb-5">
      <p className="text-sm font-semibold text-happi-teal mb-2">
        {label}{required && <span className="text-orange-400 ml-0.5">*</span>}
      </p>
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PAGE 1 — Informations personnelles
══════════════════════════════════════════════════════════════ */
function Page1({ f, s }) {
  return (
    <>
      <SectionTitle title="Informations personnelles" subtitle="Quelques informations sur toi" />

      <Q label="Quel est ton âge ?" required>
        <Radio cols={2} value={f.age} onChange={v => s('age', v)}
          options={['15 - 17 ans', '18 - 21 ans', '22 - 24 ans', '25 ans et plus']} />
      </Q>

      <Q label="Quelle est ta situation actuelle ?" required>
        <Radio value={f.situation} onChange={v => s('situation', v)}
          options={['Lycéen(ne)', 'Étudiant(e)', 'En formation / apprentissage', "Demandeur(se) d'emploi", 'Salarié(e)', 'Autre']} />
      </Q>

      <Q label="Dans quelle ville habites-tu ?" required>
        <Radio value={f.residence} onChange={v => s('residence', v)}
          options={['Béziers', 'Villages alentours', 'Autre ville']} />
        {(f.residence === 'Villages alentours' || f.residence === 'Autre ville') && (
          <input type="text" value={f.village || ''} onChange={e => s('village', e.target.value)}
            placeholder="Précise ta ville / ton village" className="input mt-2 text-sm" />
        )}
      </Q>

      <Q label="Ton numéro de téléphone">
        <input type="tel" value={f.telephone || ''} onChange={e => s('telephone', e.target.value)}
          placeholder="06 00 00 00 00" className="input text-sm" />
      </Q>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   PAGE 2 — Parcours académique
══════════════════════════════════════════════════════════════ */
const NIVEAUX = [
  'Sans diplôme', 'CAP', 'BEP', 'Bac général', 'Bac technologique',
  'Bac professionnel', 'DAEU', 'BTS / DUT (Bac+2)', 'Licence (Bac+3)',
  'Maîtrise (Bac+4)', 'Master / DEA / DESS (Bac+5)', 'Bac+6 et plus / Doctorat', 'Autre',
];

function Page2({ f, s }) {
  return (
    <>
      <SectionTitle title="Parcours académique" subtitle="Ton niveau d'études et ta formation" />

      <Q label="Quel est ton niveau d'études ?" required>
        <Radio value={f.niveauEtudes} onChange={v => s('niveauEtudes', v)} options={NIVEAUX} />
      </Q>

      <Q label="Dans quel domaine as-tu étudié ?">
        <input type="text" value={f.domainesEtudes || ''} onChange={e => s('domainesEtudes', e.target.value)}
          placeholder="Ex : Commerce, Informatique, Santé…" className="input text-sm" />
      </Q>

      <Q label="Dans quel établissement ? (lycée, université…)">
        <input type="text" value={f.etablissement || ''} onChange={e => s('etablissement', e.target.value)}
          placeholder="Nom de l'établissement" className="input text-sm" />
      </Q>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   PAGE 3 — Bénévolat & expériences
══════════════════════════════════════════════════════════════ */
const DOMAINES_BENEVOLE = [
  'Sport / Loisirs', 'Éducation / Formation', 'Social / Humanitaire',
  'Culture / Art', 'Environnement', 'Santé', 'Religion / Spiritualité',
  'Politique / Citoyenneté', 'Autre',
];

function Page3({ f, s }) {
  const hasBenevole = f.benevole === 'Oui, régulièrement' || f.benevole === 'Oui, ponctuellement';
  return (
    <>
      <SectionTitle title="Bénévolat & expériences" subtitle="Tes engagements et expériences professionnelles" />

      <Q label="Est-ce que tu pratiques une activité bénévole ?" required>
        <Radio value={f.benevole} onChange={v => s('benevole', v)}
          options={['Oui, régulièrement', 'Oui, ponctuellement', 'Non, jamais']} />
      </Q>

      {hasBenevole && (
        <Q label="Dans quel(s) domaine(s) ?">
          <Checkbox options={DOMAINES_BENEVOLE} value={f.domaineBenevole || []}
            onChange={v => s('domaineBenevole', v)} />
        </Q>
      )}

      <Q label="As-tu une expérience professionnelle ?" required>
        <Radio value={f.experiences} onChange={v => s('experiences', v)}
          options={['Oui, dans le même domaine que mes études', 'Oui, dans un autre domaine', 'Non, aucune expérience']} />
      </Q>

      {f.experiences && f.experiences !== 'Non, aucune expérience' && (
        <Q label="Décris brièvement ton expérience">
          <textarea value={f.descriptionExp || ''} onChange={e => s('descriptionExp', e.target.value)}
            rows={3} placeholder="Poste occupé, durée, entreprise…" className="input resize-none text-sm" />
        </Q>
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   PAGE 4 — Ambitions professionnelles
══════════════════════════════════════════════════════════════ */
const SECTEURS = [
  'Commerce & vente', 'Informatique & numérique', 'Santé & social',
  'Sécurité & défense', 'Art & design', 'Hôtellerie & restauration',
  'BTP & artisanat', 'Sport & animation', 'Finance & gestion',
  'Éducation & formation', 'Transport & logistique', 'Industrie & production', 'Autre',
];

function Page4({ f, s }) {
  return (
    <>
      <SectionTitle title="Ambitions professionnelles" subtitle="Tes projets et aspirations" />

      <Q label="Quels secteurs professionnels t'attirent ?" required>
        <Checkbox cols={2} options={SECTEURS} value={f.secteurs || []} onChange={v => s('secteurs', v)} />
      </Q>

      <Q label="Décris tes ambitions professionnelles">
        <textarea value={f.ambitions || ''} onChange={e => s('ambitions', e.target.value)}
          rows={3} placeholder="Quel métier souhaites-tu exercer ? Quels sont tes projets ?"
          className="input resize-none text-sm" />
      </Q>

      <Q label="Dans 2 ans, tu souhaites…" required>
        <Radio value={f.projetFutur} onChange={v => s('projetFutur', v)}
          options={[
            'Être en emploi dans mon domaine cible',
            'Poursuivre mes études ou une formation',
            'Créer ma propre activité / entreprise',
            "Intégrer une formation en alternance",
            "Je ne sais pas encore",
          ]} />
      </Q>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   PAGE 5 — Aptitudes personnelles (mini-scale, 4 items)
══════════════════════════════════════════════════════════════ */
const APTITUDES = [
  { key: 'aptPonctualite',   label: 'Ponctualité' },
  { key: 'aptMotivation',    label: 'Motivation / Investissement' },
  { key: 'aptCommunication', label: 'Communication' },
  { key: 'aptInitiative',    label: 'Prise d\'initiative' },
];

function RatingRow({ label, value, onChange }) {
  return (
    <div className="py-3 border-b border-slate-50 last:border-0">
      <p className="text-sm font-medium text-happi-teal mb-2">{label}</p>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" onClick={() => onChange(value === n ? null : n)}
            className="flex-1 py-2 rounded-xl text-sm font-bold transition-all border-2"
            style={{
              background:  value === n ? '#FF8650' : '#f8fafc',
              color:       value === n ? 'white'   : '#94a3b8',
              borderColor: value === n ? '#FF8650' : '#e2e8f0',
              boxShadow:   value === n ? '0 2px 8px rgba(255,134,80,0.3)' : 'none',
            }}>
            {n}
          </button>
        ))}
      </div>
      {value != null && (
        <p className="text-[10px] mt-1" style={{ color: '#FF8650' }}>{SCALE_LABELS[value]}</p>
      )}
    </div>
  );
}

function Page5({ f, s }) {
  return (
    <>
      <SectionTitle title="Aptitudes personnelles" subtitle="Note-toi sur les aptitudes suivantes (1 = Très faible → 5 = Excellent)" />

      <div className="flex justify-between text-[10px] text-slate-400 mb-2 px-0.5">
        <span>1 = Très faible</span>
        <span>3 = Moyen</span>
        <span>5 = Excellent</span>
      </div>

      {APTITUDES.map(({ key, label }) => (
        <RatingRow key={key} label={label} value={f[key] ?? null}
          onChange={v => s(key, v)} />
      ))}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   PAGE 6 — Auto-évaluation des compétences (HBS, 15 items)
══════════════════════════════════════════════════════════════ */
function Page6({ f, s }) {
  const hbs = f.hbs || Array(15).fill(null);
  const setHbs = (idx, val) => {
    const next = [...hbs];
    next[idx] = next[idx] === val ? null : val;
    s('hbs', next);
  };
  const filled = hbs.filter(v => v != null).length;

  return (
    <>
      <SectionTitle title="Auto-évaluation des compétences" subtitle="Pour chaque affirmation, indique dans quelle mesure elle te correspond (1 = Pas du tout d'accord → 5 = Tout à fait d'accord)" />

      {/* Progress */}
      <div className="h-1.5 bg-slate-100 rounded-full mb-1">
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${(filled / 15) * 100}%`, background: '#FF8650' }} />
      </div>
      <p className="text-[10px] text-slate-400 mb-4 text-right">{filled}/15 évaluées</p>

      {/* Scale header */}
      <div className="grid grid-cols-6 gap-1 mb-2 text-[10px] text-slate-400 text-center">
        <div className="text-left col-span-1" />
        {[1, 2, 3, 4, 5].map(n => (
          <div key={n} className="font-semibold">{n}</div>
        ))}
      </div>

      <div className="space-y-1">
        {HBS_STATEMENTS.map(({ key, label }, idx) => (
          <div key={key} className="rounded-xl p-2.5 transition-all"
            style={{ background: hbs[idx] != null ? '#FFF8F5' : 'white', border: `1px solid ${hbs[idx] != null ? '#FFD4BC' : '#F1F5F9'}` }}>
            <p className="text-xs font-medium text-happi-teal mb-2">{label}</p>
            <div className="grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button" onClick={() => setHbs(idx, n)}
                  className="py-1.5 rounded-lg text-xs font-bold transition-all border-2"
                  style={{
                    background:  hbs[idx] === n ? '#FF8650' : '#f8fafc',
                    color:       hbs[idx] === n ? 'white'   : '#94a3b8',
                    borderColor: hbs[idx] === n ? '#FF8650' : '#e2e8f0',
                  }}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 rounded-xl" style={{ background: '#FFF1EB' }}>
        <p className="text-xs text-slate-500">
          Ces informations permettent à ton formateur de mieux comprendre ton profil et de personnaliser ton accompagnement.
        </p>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN EXPORT
══════════════════════════════════════════════════════════════ */
export default function OnboardingTalent({ participant, onComplete, onSkip }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    // Page 1
    age:           participant?.age        || '',
    situation:     participant?.situation  || '',
    residence:     participant?.residence  || '',
    village:       participant?.village    || '',
    telephone:     participant?.telephone  || '',
    // Page 2
    niveauEtudes:  participant?.niveauEtudes   || '',
    domainesEtudes:participant?.domainesEtudes || '',
    etablissement: participant?.etablissement  || '',
    // Page 3
    benevole:      participant?.benevole     || '',
    domaineBenevole: participant?.domaineBenevole || [],
    experiences:   participant?.experiences  || '',
    descriptionExp:participant?.descriptionExp || '',
    // Page 4
    secteurs:      participant?.secteurs    || [],
    ambitions:     participant?.ambitions   || '',
    projetFutur:   participant?.projetFutur || '',
    // Page 5
    aptPonctualite:   participant?.aptPonctualite   ?? null,
    aptMotivation:    participant?.aptMotivation    ?? null,
    aptCommunication: participant?.aptCommunication ?? null,
    aptInitiative:    participant?.aptInitiative    ?? null,
    // Page 6
    hbs: participant?.hbs || Array(15).fill(null),
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Validation par étape (champs requis)
  const canProceed = [
    !!form.age && !!form.situation && !!form.residence,          // Page 1
    !!form.niveauEtudes,                                          // Page 2
    !!form.benevole && !!form.experiences,                        // Page 3
    !!form.projetFutur,                                           // Page 4
    true,                                                         // Page 5 — optionnel
    true,                                                         // Page 6 — optionnel
  ][step];

  const pages = [Page1, Page2, Page3, Page4, Page5, Page6];
  const Page  = pages[step];

  const handleFinish = () => onComplete(form);

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg,#102C32 0%,#1A3F48 50%,#102C32 100%)' }}>
      <div className="flex justify-center min-h-screen p-4 py-8">
        <div className="w-full max-w-lg">

          {/* Top bar */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#FF8650' }}>
                <Sparkles size={15} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-white text-sm leading-tight" style={{ fontFamily: 'Poppins,sans-serif' }}>Formulaire HaPPi</p>
                <p className="text-[10px]" style={{ color: '#8AABB0' }}>Étude du programme</p>
              </div>
            </div>
            <button onClick={onSkip} className="flex items-center gap-1 text-xs transition-colors" style={{ color: '#8AABB0' }}>
              <SkipForward size={12} /> Passer
            </button>
          </div>

          {/* Welcome banner (step 0 only) */}
          {step === 0 && (
            <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(255,134,80,0.12)', border: '1px solid rgba(255,134,80,0.25)' }}>
              <p className="text-sm font-semibold text-white mb-1">Bienvenue dans le programme HaPPi 🎉</p>
              <p className="text-xs leading-relaxed" style={{ color: '#8AABB0' }}>
                Ce formulaire nous aide à mieux te connaître pour personnaliser ton parcours. Il prend environ <strong className="text-white">5 minutes</strong>.
              </p>
            </div>
          )}

          {/* Card */}
          <div className="bg-white rounded-3xl p-6" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <ProgressBar step={step} />
            <div className="mt-5">
              <Page f={form} s={set} />
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-3 pt-4 mt-2 border-t border-slate-100">
              {step > 0 && (
                <button onClick={() => setStep(s => s - 1)}
                  className="flex items-center gap-2 px-5 py-3 rounded-full text-sm font-semibold"
                  style={{ background: '#F1F5F9', color: '#64748b' }}>
                  <ChevronLeft size={16} /> Retour
                </button>
              )}
              <button onClick={() => step < TOTAL_STEPS - 1 ? setStep(s => s + 1) : handleFinish()}
                disabled={!canProceed}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-full text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background:  canProceed ? '#FF8650' : '#ccc',
                  boxShadow:   canProceed ? '0 4px 20px rgba(255,134,80,0.4)' : 'none',
                  fontFamily: 'DM Sans,sans-serif',
                }}>
                {step === TOTAL_STEPS - 1
                  ? <><Check size={16} /> Terminer le formulaire</>
                  : <>Suivant <ChevronRight size={16} /></>}
              </button>
            </div>

            {step >= TOTAL_STEPS - 2 && (
              <p className="text-center text-[10px] text-slate-400 mt-3">
                {step === TOTAL_STEPS - 1 ? "L'auto-évaluation est optionnelle." : "Les aptitudes sont optionnelles."}
              </p>
            )}
          </div>

          {/* Dots */}
          <div className="flex items-center justify-center gap-2 mt-5">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <div key={i} className="rounded-full transition-all duration-300"
                style={{
                  width:  i === step ? 20 : 8,
                  height: 8,
                  background: i === step ? '#FF8650' : i < step ? 'rgba(255,134,80,0.5)' : 'rgba(255,255,255,0.2)',
                }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
