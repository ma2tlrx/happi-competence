import { useState } from 'react';
import { Briefcase, Target, ChevronRight, ChevronLeft, Check, Sparkles } from 'lucide-react';

const TOTAL_STEPS = 2;

/* ── Shared UI ──────────────────────────────────────────────── */
function ProgressBar({ step }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <div key={i} className="flex-1">
          <div className="h-2 rounded-full transition-all duration-300"
            style={{ background: i < step ? '#FF8650' : i === step ? '#FFD4BC' : '#F1F5F9' }} />
        </div>
      ))}
    </div>
  );
}

function RadioGroup({ options, value, onChange, cols = 1 }) {
  return (
    <div className={`grid gap-2 ${cols === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
      {options.map(opt => {
        const active = value === opt;
        return (
          <button key={opt} type="button" onClick={() => onChange(opt)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm font-medium text-left transition-all"
            style={{
              borderColor: active ? '#FF8650' : '#E2E8F0',
              background:  active ? '#FFF1EB' : 'white',
              color:       active ? '#FF8650' : '#475569',
            }}>
            <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
              style={{ borderColor: active ? '#FF8650' : '#CBD5E1', background: active ? '#FF8650' : 'white' }}>
              {active && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function CheckboxGroup({ options, value = [], onChange }) {
  const toggle = (opt) => onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt]);
  return (
    <div className="grid grid-cols-1 gap-2">
      {options.map(opt => {
        const active = value.includes(opt);
        return (
          <button key={opt} type="button" onClick={() => toggle(opt)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm font-medium text-left transition-all"
            style={{
              borderColor: active ? '#FF8650' : '#E2E8F0',
              background:  active ? '#FFF1EB' : 'white',
              color:       active ? '#FF8650' : '#475569',
            }}>
            <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
              style={{ background: active ? '#FF8650' : 'white', border: active ? 'none' : '2px solid #CBD5E1' }}>
              {active && <Check size={10} className="text-white" />}
            </div>
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function StepHeader({ icon: Icon, title, subtitle, step }) {
  return (
    <div className="flex items-start gap-4 mb-6">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: '#FF8650', boxShadow: '0 4px 14px rgba(255,134,80,0.35)' }}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: '#FF8650' }}>Étape {step}/{TOTAL_STEPS}</p>
        <h2 className="text-xl font-bold text-happi-teal leading-tight" style={{ fontFamily: 'Poppins,sans-serif' }}>{title}</h2>
        <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   STEP 1 — Profil professionnel
══════════════════════════════════════════════════════════════ */
const DOMAINES_FORMATEUR = [
  'Insertion professionnelle',
  'Orientation & coaching',
  'Développement des compétences',
  'Formation technique',
  'Management & leadership',
  'Numérique & digital',
  'Autre',
];

function Step1({ form, set }) {
  return (
    <>
      <StepHeader icon={Briefcase} step={1} title="Profil professionnel" subtitle="Votre expertise en tant que formateur" />
      <div className="space-y-5">
        <div>
          <p className="text-sm font-semibold text-happi-teal mb-2">Votre titre / poste <span className="font-normal text-slate-400">(optionnel)</span></p>
          <input type="text" value={form.titre || ''} onChange={e => set('titre', e.target.value)}
            placeholder="Ex : Formateur, Conseiller en insertion…" className="input" />
        </div>

        <div>
          <p className="text-sm font-semibold text-happi-teal mb-2">Vos domaines d'intervention <span className="font-normal text-slate-400">(plusieurs choix)</span></p>
          <CheckboxGroup options={DOMAINES_FORMATEUR} value={form.domaines || []} onChange={v => set('domaines', v)} />
        </div>

        <div>
          <p className="text-sm font-semibold text-happi-teal mb-2">Années d'expérience en formation *</p>
          <RadioGroup value={form.experience} onChange={v => set('experience', v)}
            options={['Moins de 2 ans', '2 à 5 ans', '6 à 10 ans', 'Plus de 10 ans']} />
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   STEP 2 — Objectifs
══════════════════════════════════════════════════════════════ */
function Step2({ form, set }) {
  return (
    <>
      <StepHeader icon={Target} step={2} title="Vos objectifs" subtitle="Comment pouvons-nous vous aider ?" />
      <div className="space-y-5">
        <div>
          <p className="text-sm font-semibold text-happi-teal mb-2">Votre objectif principal sur la plateforme *</p>
          <RadioGroup value={form.objectif} onChange={v => set('objectif', v)}
            options={[
              'Suivre la progression de mes participants',
              'Gérer mes sessions de formation',
              'Évaluer et mesurer les compétences',
              'Générer des bilans professionnels',
              'Tout à la fois',
            ]} />
        </div>

        <div>
          <p className="text-sm font-semibold text-happi-teal mb-2">Comment avez-vous entendu parler de la plateforme ? <span className="font-normal text-slate-400">(optionnel)</span></p>
          <RadioGroup value={form.source} onChange={v => set('source', v)}
            options={['Un collègue / partenaire', 'Réseaux sociaux', 'Moteur de recherche', 'Happi Compétence directement', 'Autre']} />
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN EXPORT
══════════════════════════════════════════════════════════════ */
export default function OnboardingFormateur({ user, onComplete }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    titre:      '',
    domaines:   [],
    experience: '',
    objectif:   '',
    source:     '',
  });

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));

  const canProceed = [
    form.experience,   // Step 1
    form.objectif,     // Step 2
  ][step];

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1) setStep(s => s + 1);
    else onComplete({ ...user, profilFormateur: form });
  };

  const steps = [Step1, Step2];
  const StepComp = steps[step];

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg,#102C32 0%,#1A3F48 50%,#102C32 100%)' }}>
      <div className="flex items-start justify-center min-h-screen p-4 py-8">
        <div className="w-full max-w-lg">
          {/* Top bar */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#FF8650' }}>
              <Sparkles size={16} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-white text-sm leading-tight" style={{ fontFamily: 'Poppins,sans-serif' }}>Happi Compétence</p>
              <p className="text-[10px]" style={{ color: '#8AABB0' }}>Configuration du compte formateur</p>
            </div>
          </div>

          {/* Welcome */}
          {step === 0 && (
            <div className="rounded-2xl p-5 mb-5" style={{ background: 'rgba(255,134,80,0.12)', border: '1px solid rgba(255,134,80,0.25)' }}>
              <p className="text-sm font-semibold text-white mb-1">
                Bienvenue {user?.prenom || ''} ! 🎉
              </p>
              <p className="text-xs" style={{ color: '#8AABB0', lineHeight: 1.6 }}>
                Votre compte a été créé. Répondez à <strong className="text-white">2 questions rapides</strong> pour personnaliser votre expérience.
              </p>
            </div>
          )}

          {/* Card */}
          <div className="bg-white rounded-3xl p-6" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <ProgressBar step={step} />
            <StepComp form={form} set={set} />

            {/* Navigation */}
            <div className="flex items-center gap-3 mt-8">
              {step > 0 && (
                <button onClick={() => setStep(s => s - 1)}
                  className="flex items-center gap-2 px-5 py-3 rounded-full text-sm font-semibold"
                  style={{ background: '#F1F5F9', color: '#64748b' }}>
                  <ChevronLeft size={16} />Retour
                </button>
              )}
              <button onClick={handleNext} disabled={!canProceed}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-full text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background:  canProceed ? '#FF8650' : '#ccc',
                  boxShadow:   canProceed ? '0 4px 20px rgba(255,134,80,0.4)' : 'none',
                  fontFamily: 'DM Sans,sans-serif',
                }}>
                {step === TOTAL_STEPS - 1
                  ? <><Check size={16} /> Accéder à la plateforme</>
                  : <>Suivant <ChevronRight size={16} /></>}
              </button>
            </div>
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
