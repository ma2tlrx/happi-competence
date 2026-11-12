import { join } from 'node:path';

import { Document, Image, Page, Text, View } from '@react-pdf/renderer';
import type { Style } from '@react-pdf/stylesheet';
import type { ReactNode } from 'react';

import { writingMention } from '@/lib/report/ai-disclosure';
import { BEHAVIOUR_THEMES, PRIORITIES, type ReportContent, type ReportOptions, type ReportSection } from '@/lib/report/content';
import type { ReportData, ReportFramework, ReportSkill } from '@/lib/report/model';
import { formatDate, formatScore } from '@/lib/utils';

import { DimensionMatrix, DistributionBar, DistributionLegend, LevelMeter, Radar, statusText } from './charts';
import { C, CONTENT_WIDTH, registerReportFonts, s } from './theme';

export type ReportDocumentProps = {
  data: ReportData;
  content: ReportContent | null;
  options: ReportOptions;
  meta: { version: number; status: 'draft' | 'final'; finalizedAt: string | null; contentSource: 'ai' | 'ai_edited' | 'manual' | null };
  root?: string;
};

const TO_WRITE = 'À rédiger.';

/** Paragraphes séparés par une ligne vide. */
function Paragraphs({ text, style }: { text: string | null | undefined; style?: Style }) {
  const blocks = (text ?? '').split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  if (blocks.length === 0) return <Text style={[s.p, s.placeholder]}>{TO_WRITE}</Text>;
  return (
    <>
      {blocks.map((block, index) => (
        <Text key={index} style={[s.p, style ?? {}]}>
          {block}
        </Text>
      ))}
    </>
  );
}

function Bullets({ items, empty }: { items: ReactNode[]; empty?: string }) {
  if (items.length === 0) return <Text style={[s.p, s.placeholder]}>{empty ?? TO_WRITE}</Text>;
  return (
    <View>
      {items.map((item, index) => (
        <View key={index} style={s.bullet} wrap={false}>
          <View style={s.bulletMark} />
          <Text style={{ flex: 1 }}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

/** Ouverture de section : numéro, titre, chapeau. Toujours suivie d'un peu de contenu sur la même page. */
function SectionOpener({ number, title, lead }: { number: string; title: string; lead?: string }) {
  return (
    <View minPresenceAhead={120} style={{ marginBottom: 14 }}>
      <Text style={s.kicker}>{number}</Text>
      <Text style={s.h1}>{title}</Text>
      {lead ? <Text style={s.lead}>{lead}</Text> : null}
      <View style={s.rule} />
    </View>
  );
}

function H2({ children }: { children: ReactNode }) {
  return (
    <View minPresenceAhead={70}>
      <Text style={s.h2}>{children}</Text>
    </View>
  );
}

export function Frame({ data, meta, children }: { data: ReportData; meta: ReportDocumentProps['meta']; children: ReactNode }) {
  const name = `${data.participant.firstName} ${data.participant.lastName}`;
  return (
    <Page size="A4" style={s.page} wrap>
      <View style={s.header} fixed>
        <Text>
          HAPPI · Bilan des compétences{meta.status === 'draft' ? '  ' : ''}
          {meta.status === 'draft' ? <Text style={s.draft}>BROUILLON</Text> : null}
        </Text>
        <Text>{name}</Text>
      </View>
      {children}
      <View style={s.footer} fixed>
        <Text>
          Version {meta.version} · {meta.status === 'final' ? `validée le ${formatDate(meta.finalizedAt)}` : 'non validée'} · Document personnel et confidentiel
        </Text>
        <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </Page>
  );
}

function skillName(data: ReportData, code: string) {
  for (const framework of data.frameworks) {
    const skill = framework.skills.find((item) => item.code === code);
    if (skill) return { skill, framework };
  }
  return null;
}

// ── Couverture ───────────────────────────────────────────────────────────────
export function Cover({ data, options, meta, root }: Omit<ReportDocumentProps, 'content'> & { root: string }) {
  const structure = options.structureName || data.organization;
  const facts: [string, string][] = [
    ['Date du bilan', formatDate(meta.status === 'final' ? meta.finalizedAt : data.generatedAt)],
    ['Structure accompagnatrice', structure ?? 'Non renseignée'],
    ['Programme', data.program ? `${data.program.name}${data.group ? ` · ${data.group.name}` : ''}` : 'Aucun groupe actif'],
    ['Sessions suivies', `${data.counts.sessionsAttended} sur ${data.counts.sessionsPlanned}`],
    ['Jeux et activités au programme', String(data.counts.activities)],
    ['Situations évaluées', `${data.counts.sessionsEvaluated} session${data.counts.sessionsEvaluated > 1 ? 's' : ''}`],
    ['Observations des formateurs', String(data.counts.observations)],
  ];
  // Transparence sur l'usage de l'IA (règlement européen sur l'IA, art. 50).
  const mention = writingMention(meta.contentSource);
  if (mention) facts.push(['Rédaction', mention]);
  return (
    <Page size="A4" style={{ fontFamily: 'DM Sans', color: C.ink, fontSize: 9.5 }}>
      <View style={{ paddingHorizontal: 50, paddingTop: 52, flex: 1 }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- composant PDF, pas d'attribut alt */}
        <Image src={join(root, 'public', 'brand', 'happi-logotype-petrole.png')} style={{ width: 92, height: 35 }} />
        <View style={{ marginTop: 120 }}>
          <Text style={{ fontFamily: 'Poppins', fontWeight: 600, fontSize: 10, letterSpacing: 2.4, color: C.orange700 }}>BILAN DES COMPÉTENCES</Text>
          <Text style={{ fontFamily: 'Poppins', fontWeight: 600, fontSize: 32, lineHeight: 1.15, marginTop: 10 }}>
            {data.participant.firstName} {data.participant.lastName}
          </Text>
          <Text style={{ fontSize: 12, color: C.muted, marginTop: 10, maxWidth: 380, lineHeight: 1.5 }}>
            Compétences transversales et habiletés socio-cognitives observées en situation de jeu.
          </Text>
          <View style={[s.rule, { marginTop: 22 }]} />
        </View>
        <View style={{ marginTop: 44, borderTopWidth: 0.75, borderTopColor: C.line }}>
          {facts.map(([label, value]) => (
            <View key={label} style={{ flexDirection: 'row', paddingVertical: 7, borderBottomWidth: 0.75, borderBottomColor: C.line }}>
              <Text style={{ width: 190, color: C.muted }}>{label}</Text>
              <Text style={{ flex: 1, fontWeight: 500 }}>{value}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={{ backgroundColor: C.petrol, paddingHorizontal: 50, paddingVertical: 26, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1, paddingRight: 24 }}>
          <Text style={{ color: C.white, fontFamily: 'Poppins', fontWeight: 500, fontSize: 11 }}>L’avenir se joue ici.</Text>
          <Text style={{ color: C.petrol200, fontSize: 8, marginTop: 6, lineHeight: 1.5 }}>
            Ce bilan décrit des comportements observés pendant le programme HAPPI. Ce n’est ni un test psychologique, ni un diagnostic, ni une décision sur
            l’aptitude professionnelle d’une personne.
          </Text>
        </View>
        <Text style={{ color: meta.status === 'final' ? C.petrol200 : C.orange, fontSize: 8, fontWeight: 700 }}>
          {meta.status === 'final' ? `Version ${meta.version}` : `BROUILLON · version ${meta.version}`}
        </Text>
      </View>
    </Page>
  );
}

// ── 0. Introduction et parcours ──────────────────────────────────────────────
export function Introduction({ data, content }: { data: ReportData; content: ReportContent | null }) {
  return (
    <>
      <SectionOpener number="00 · INTRODUCTION" title="Votre bilan HAPPI" />
      <Paragraphs text={content?.introduction} />

      <H2>Votre parcours d’évaluation</H2>
      {data.sessions.length === 0 ? (
        <Text style={s.placeholder}>Aucun groupe actif : les sessions suivies ne peuvent pas être présentées.</Text>
      ) : (
        <View style={{ borderTopWidth: 0.75, borderTopColor: C.line }}>
          {data.sessions.map((session) => (
            <View key={session.number} style={{ flexDirection: 'row', paddingVertical: 7, borderBottomWidth: 0.75, borderBottomColor: C.line }} wrap={false}>
              <Text style={{ width: 26, fontFamily: 'Poppins', fontWeight: 600, fontSize: 12, color: session.attended ? C.petrol : C.petrol200 }}>{session.number}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: 500 }}>{session.title}</Text>
                <Text style={s.small}>{session.activities.length ? session.activities.join(' · ') : session.attended ? 'Activités non renseignées' : '—'}</Text>
              </View>
              <Text style={{ width: 120, textAlign: 'right', fontSize: 8, color: session.evaluated ? C.petrol : C.subtle }}>
                {session.evaluated ? 'Suivie · évaluée' : session.attended ? 'Suivie · non évaluée' : session.attendance ? 'Absent' : 'Pas encore réalisée'}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={[s.box, { marginTop: 18 }]} wrap={false}>
        <Text style={s.h3}>Comment lire ce bilan</Text>
        <Text style={[s.small, { marginTop: 6 }]}>
          Les niveaux sont attribués par les formateurs à partir de ce qu’ils ont observé pendant les sessions. Chaque référentiel a sa propre échelle :
          les deux ne se comparent pas directement.
        </Text>
        {data.frameworks.map((framework) => (
          <Text key={framework.code} style={[s.small, { marginTop: 4 }]}>
            <Text style={{ fontWeight: 700, color: C.ink }}>{framework.name} : </Text>
            {framework.levels.map((level) => level.label).join(' · ')} (du premier au plus haut niveau).
          </Text>
        ))}
        <View style={{ flexDirection: 'row', marginTop: 10 }}>
          {[
            ['Observée en plusieurs sessions', 'repère établi'],
            ['1 observation · à confirmer', 'premier repère'],
            ['Non observée', 'pas d’information, pas un niveau faible'],
          ].map(([title, text]) => (
            <View key={title} style={{ flex: 1, paddingRight: 8 }}>
              <Text style={{ fontSize: 8, fontWeight: 700 }}>{title}</Text>
              <Text style={s.small}>{text}</Text>
            </View>
          ))}
        </View>
      </View>
    </>
  );
}

// ── 1. Profil général ───────────────────────────────────────────────────────
const SHAPE_LABEL = { homogeneous: 'Niveaux proches les uns des autres', contrasted: 'Niveaux contrastés', undetermined: 'Trop peu d’observations pour dégager une tendance' };

function NamedList({ data, codes, empty }: { data: ReportData; codes: string[]; empty: string }) {
  const items = codes
    .map((code) => skillName(data, code))
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .map(({ skill }) => `${skill.name} — ${skill.levelLabel ?? ''}${skill.status === 'single' ? ' (à confirmer)' : ''}`);
  return <Bullets items={items} empty={empty} />;
}

export function Profile({ data, content }: { data: ReportData; content: ReportContent | null }) {
  return (
    <View>
      <SectionOpener
        number="01 · PROFIL GÉNÉRAL"
        title="Votre profil en un coup d’œil"
        lead="Une synthèse par référentiel. Aucun score global n’est calculé : les deux référentiels n’ont pas la même échelle."
      />
      <Paragraphs text={content?.profile.summary} />

      <View style={{ flexDirection: 'row', marginTop: 8 }}>
        {data.frameworks.map((framework, index) => (
          <View key={framework.code} style={[s.panel, { flex: 1, marginLeft: index ? 10 : 0 }]} wrap={false}>
            <Text style={s.label}>{framework.shortName}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 4 }}>
              <Text style={{ fontFamily: 'Poppins', fontWeight: 600, fontSize: 24, lineHeight: 1 }}>{framework.observedCount}</Text>
              <Text style={{ color: C.muted, marginLeft: 4, marginBottom: 2 }}>/ {framework.totalCount} observées</Text>
            </View>
            <Text style={[s.small, { marginTop: 2, marginBottom: 8 }]}>
              dont {framework.repeatedCount} en plusieurs sessions · {SHAPE_LABEL[framework.shape]}
            </Text>
            <DistributionBar framework={framework} width={(CONTENT_WIDTH - 10) / 2 - 26} />
            <DistributionLegend framework={framework} />
          </View>
        ))}
      </View>

      {data.frameworks.map((framework) => {
        const reading = content?.frameworks.find((item) => item.code === framework.code);
        return (
          <View key={framework.code}>
            <H2>{framework.name}</H2>
            {framework.observedCount === 0 ? (
              <Text style={s.placeholder}>Aucune compétence de ce référentiel n’a encore été observée.</Text>
            ) : (
              <>
                {reading ? <Paragraphs text={reading.summary} /> : null}
                <View style={{ flexDirection: 'row' }} wrap={false}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={[s.h3, { marginBottom: 6 }]}>Les plus mobilisées</Text>
                    <NamedList data={data} codes={framework.highlights.strengths} empty="Pas encore assez d’observations." />
                  </View>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={[s.h3, { marginBottom: 6 }]}>À développer</Text>
                    <NamedList
                      data={data}
                      codes={framework.highlights.toDevelop}
                      empty={framework.shape === 'homogeneous' ? 'Niveaux proches : aucune compétence ne se détache vers le bas.' : 'Pas encore assez d’observations.'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.h3, { marginBottom: 6 }]}>En progression</Text>
                    <NamedList data={data} codes={framework.highlights.progressions} empty="Pas encore mesurable (une seule observation par compétence)." />
                  </View>
                </View>
              </>
            )}
          </View>
        );
      })}

      <View wrap={false}>
        <Text style={s.h2}>Caractéristiques observées</Text>
        <Bullets items={content?.profile.traits ?? []} />
      </View>
    </View>
  );
}

// ── 2. Cartographie ──────────────────────────────────────────────────────────
function SkillLine({ skill, framework }: { skill: ReportSkill; framework: ReportFramework }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 3.5, borderBottomWidth: 0.5, borderBottomColor: C.line }} wrap={false}>
      <Text style={{ width: 150, color: skill.status === 'not_observed' ? C.subtle : C.ink }}>{skill.name}</Text>
      <LevelMeter value={skill.levelValue} min={framework.scaleMin} max={framework.scaleMax} width={100} />
      <Text style={{ width: 140, paddingLeft: 10, fontSize: 8.5, fontWeight: skill.levelLabel ? 500 : 400, color: skill.levelLabel ? C.ink : C.subtle }}>
        {skill.value === null ? '—' : `${formatScore(skill.value)}/${framework.scaleMax} · ${skill.levelLabel}`}
      </Text>
      <Text style={{ flex: 1, textAlign: 'right', fontSize: 7.5, color: skill.status === 'single' ? C.orange700 : C.subtle }}>
        {statusText(skill)}
        {skill.self ? ` · auto-év. ${skill.self.label ?? ''}` : ''}
      </Text>
    </View>
  );
}

export function SkillMap({ data }: { data: ReportData }) {
  return (
    <View>
      <SectionOpener
        number="02 · CARTOGRAPHIE"
        title="Cartographie des compétences"
        lead="Toutes les compétences des deux référentiels, avec le niveau retenu, sa famille et le nombre d’observations qui le fondent."
      />
      {data.frameworks.map((framework, index) => (
        <View key={framework.code} break={index > 0}>
          <H2>{framework.name}</H2>
          <Text style={s.small}>
            Échelle, du premier au plus haut niveau : {framework.levels.map((level) => level.label).join(' · ')} · règle de synthèse : {framework.rules.aggregationLabel.toLowerCase()}
            {framework.isProvisional ? ` · référentiel provisoire (${framework.versionLabel})` : ''}.
          </Text>
          {framework.observedCount >= 3 ? (
            <View style={{ alignItems: 'center', marginVertical: 6 }} wrap={false}>
              <Radar framework={framework} size={230} />
              <View style={{ flexDirection: 'row' }}>
                <Text style={[s.small, { color: C.observed }]}>■ Niveau observé par les formateurs</Text>
                {framework.selfComparable ? <Text style={[s.small, { color: C.orange700, marginLeft: 12 }]}>- - Auto-évaluation initiale</Text> : null}
                <Text style={[s.small, { marginLeft: 12 }]}>Compétence non observée : au centre, sans point</Text>
              </View>
            </View>
          ) : null}
          {framework.categories.map((category) => (
            <View key={category.code} style={{ marginTop: 8 }} wrap={false}>
              <Text style={[s.label, { marginBottom: 2 }]}>{category.name}</Text>
              {framework.skills
                .filter((skill) => skill.categoryCode === category.code)
                .map((skill) => (
                  <SkillLine key={skill.code} skill={skill} framework={framework} />
                ))}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

// ── 3. Façon d'agir en situation de jeu ──────────────────────────────────────
export function Behaviour({ data, content, options, hidden, number }: { data: ReportData; content: ReportContent | null; options: ReportOptions; hidden: Set<ReportSection>; number: string }) {
  const hbs = data.frameworks.find((framework) => framework.code === 'sociocognitive');
  return (
    <View>
      <SectionOpener
        number={`${number} · EN SITUATION DE JEU`}
        title="Votre façon d’agir en situation"
        lead="Ce que les formateurs ont observé pendant les jeux, les débats et les débriefings. Seuls les aspects réellement observés sont décrits."
      />
      <Paragraphs text={content?.behaviour.summary} />
      {content?.behaviour.themes.length ? (
        <View style={{ marginTop: 4 }}>
          {content.behaviour.themes.map((item, index) => (
            <View key={index} style={{ flexDirection: 'row', paddingVertical: 7, borderTopWidth: 0.5, borderTopColor: C.line }} wrap={false}>
              <View style={{ width: 150, paddingRight: 10 }}>
                <Text style={{ fontWeight: 700 }}>{BEHAVIOUR_THEMES[item.theme]}</Text>
                <Text style={s.small}>Session{item.sessions.length > 1 ? 's' : ''} {item.sessions.join(', ')}</Text>
              </View>
              <Text style={{ flex: 1 }}>{item.text}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {hbs && hbs.observedCount > 0 ? (
        <View wrap={false}>
          <H2>Les habiletés par dimension</H2>
          <Text style={[s.small, { marginBottom: 8 }]}>
            Nombre d’habiletés socio-cognitives de chaque dimension, par niveau atteint. Lecture : plus le disque est grand, plus il y a d’habiletés à ce
            niveau ; ce n’est pas un type de personnalité.
          </Text>
          <DimensionMatrix framework={hbs} width={CONTENT_WIDTH} />
        </View>
      ) : null}

      {!hidden.has('feedback') && data.feedback.length ? (
        <View>
          <H2>Commentaires des formateurs, session par session</H2>
          {data.feedback.map((item) => (
            <View key={item.session} style={{ borderLeftWidth: 2, borderLeftColor: C.orange, paddingLeft: 10, marginBottom: 10 }} wrap={false}>
              <Text style={{ fontWeight: 700 }}>
                Session {item.session} · {item.title}
                <Text style={{ fontWeight: 400, color: C.muted }}>{item.date ? ` · ${formatDate(item.date)}` : ''}</Text>
              </Text>
              {item.observation ? <Text>{item.observation}</Text> : null}
              {item.advice ? <Text style={{ color: C.muted }}>Conseil : {item.advice}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}

      {options.extraObservations ? (
        <View style={[s.box, { marginTop: 10 }]} wrap={false}>
          <Text style={s.h3}>Observations complémentaires du formateur</Text>
          <Text style={{ marginTop: 6 }}>{options.extraObservations}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ── 4 et 5. Fiches détaillées ────────────────────────────────────────────────
function SkillSheet({ skill, framework, text }: { skill: ReportSkill; framework: ReportFramework; text: ReportContent['skills'][number] | undefined }) {
  const definition = skill.description;
  // Une fiche tient sur une page ; au-delà (textes très longs), elle peut se poursuivre page suivante plutôt que d'être tronquée.
  const length = [text?.observed, text?.strengths, text?.progress, text?.professional, definition, skill.levelDescriptor, ...skill.observations.map((o) => o.comment)]
    .filter(Boolean)
    .join('').length;
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: C.petrol, paddingTop: 10, marginBottom: 18 }} wrap={length > 2600} minPresenceAhead={length > 2600 ? 160 : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={s.label}>{skill.categoryName ?? framework.shortName}</Text>
          <Text style={[s.h3, { fontSize: 13, marginTop: 2 }]}>{skill.name}</Text>
        </View>
        <View style={{ width: 150, alignItems: 'flex-end' }}>
          <LevelMeter value={skill.levelValue} min={framework.scaleMin} max={framework.scaleMax} width={120} height={7} />
          <Text style={{ fontWeight: 700, marginTop: 4 }}>
            {skill.value === null ? '' : `${formatScore(skill.value)}/${framework.scaleMax} · `}
            {skill.levelLabel}
          </Text>
          <Text style={{ fontSize: 7.5, color: skill.status === 'single' ? C.orange700 : C.subtle }}>{statusText(skill)}</Text>
        </View>
      </View>
      {definition ? <Text style={[s.small, { marginTop: 6 }]}>{definition}</Text> : null}
      {skill.levelDescriptor ? (
        <Text style={[s.small, { marginTop: 3 }]}>
          <Text style={{ fontWeight: 700 }}>Niveau « {skill.levelLabel} » : </Text>
          {skill.levelDescriptor}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 7 }}>
        {skill.observations.map((observation) => (
          <Text key={observation.session} style={[s.chip, { backgroundColor: C.petrol50, color: C.petrol, marginRight: 4, marginBottom: 3 }]}>
            Session {observation.session} · {formatScore(observation.value)}/{framework.scaleMax} {observation.levelLabel}
          </Text>
        ))}
        {skill.self ? (
          <Text style={[s.chip, { backgroundColor: C.orange100, color: C.orange700, marginBottom: 3 }]}>Auto-évaluation initiale · {skill.self.label}</Text>
        ) : null}
      </View>
      {skill.observations
        .filter((observation) => observation.comment)
        .map((observation) => (
          <Text key={`c${observation.session}`} style={[s.small, { fontStyle: 'italic', marginTop: 2 }]}>
            « {observation.comment} » — formateur, session {observation.session}
          </Text>
        ))}
      <View style={{ flexDirection: 'row', marginTop: 8 }}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={[s.label, { marginBottom: 2 }]}>Ce qui a été observé</Text>
          <Text style={text?.observed ? {} : s.placeholder}>{text?.observed || TO_WRITE}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.label, { marginBottom: 2 }]}>Points d’appui</Text>
          <Text style={text?.strengths ? {} : s.placeholder}>{text?.strengths || TO_WRITE}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', marginTop: 8 }}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={[s.label, { marginBottom: 2 }]}>Axes de progression</Text>
          <Text style={text?.progress ? {} : s.placeholder}>{text?.progress || TO_WRITE}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.label, { marginBottom: 2 }]}>Dans un contexte professionnel</Text>
          <Text style={text?.professional ? {} : s.placeholder}>{text?.professional || TO_WRITE}</Text>
        </View>
      </View>
    </View>
  );
}

export function Details({ framework, number, content }: { framework: ReportFramework; number: string; content: ReportContent | null }) {
  const observed = framework.skills.filter((skill) => skill.status !== 'not_observed');
  const unobserved = framework.skills.filter((skill) => skill.status === 'not_observed');
  return (
    <View>
      <SectionOpener
        number={number}
        title={`${framework.name} en détail`}
        lead={framework.description ?? undefined}
      />
      {observed.length === 0 ? <Text style={s.placeholder}>Aucune compétence de ce référentiel n’a encore été observée.</Text> : null}
      {observed.map((skill) => (
        <SkillSheet key={skill.code} skill={skill} framework={framework} text={content?.skills.find((item) => item.code === skill.code)} />
      ))}
      {unobserved.length ? (
        <View style={s.box} wrap={false}>
          <Text style={s.h3}>Non observées pendant le parcours</Text>
          <Text style={[s.small, { marginTop: 4 }]}>
            {unobserved.map((skill) => skill.name).join(' · ')}. Ces compétences n’ont pas été mises en jeu ou observées pendant les sessions évaluées :
            cela ne dit rien du niveau de la personne.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ── 6. Recommandations ───────────────────────────────────────────────────────
export function Recommendations({ data, content, number }: { data: ReportData; content: ReportContent | null; number: string }) {
  const groups = (Object.keys(PRIORITIES) as (keyof typeof PRIORITIES)[]).map((priority) => ({
    priority,
    items: (content?.recommendations ?? []).filter((item) => item.priority === priority),
  }));
  return (
    <View>
      <SectionOpener number={`${number} · RECOMMANDATIONS`} title="Pistes de développement" lead="Des actions concrètes, à mener en formation, en stage ou au quotidien, à partir de ce qui a été observé." />
      {content?.recommendations.length ? null : <Text style={s.placeholder}>{TO_WRITE}</Text>}
      {groups
        .filter((group) => group.items.length)
        .map((group) => (
          <View key={group.priority}>
            {group.items.map((item, index) => {
              const found = skillName(data, item.skillCode);
              return (
                // Le titre du groupe reste attaché à sa première recommandation.
                <View key={index} wrap={false}>
                  {index === 0 ? <Text style={s.h2}>{PRIORITIES[group.priority]}</Text> : null}
                  <View style={[s.panel, { marginBottom: 10 }]}>
                    <Text style={s.h3}>{found?.skill.name ?? item.skillCode}</Text>
                    {[
                      ['Pourquoi', item.why],
                      ['Action', item.action],
                      ['Mise en situation', item.exercise],
                      ['Ce que cela travaille', item.worksOn],
                      ['Objectif', item.goal],
                    ].map(([label, value]) => (
                      <View key={label} style={{ flexDirection: 'row', marginTop: 4 }}>
                        <Text style={{ width: 110, fontSize: 8, fontWeight: 700, color: C.muted }}>{label}</Text>
                        <Text style={{ flex: 1 }}>{value}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        ))}
    </View>
  );
}

// ── 7. Synthèse finale ───────────────────────────────────────────────────────
export function Conclusion({ content, number, spaced }: { content: ReportContent | null; number: string; spaced?: boolean }) {
  return (
    <View style={spaced ? { marginTop: 28 } : undefined}>
      {/* Le titre ne reste jamais seul en bas de page : il part avec le premier paragraphe. */}
      <View wrap={false}>
        <SectionOpener number={`${number} · SYNTHÈSE`} title="Synthèse finale" />
        <Paragraphs text={(content?.conclusion ?? '').split(/\n\s*\n/)[0]} />
      </View>
      {(content?.conclusion ?? '').split(/\n\s*\n/).length > 1 ? <Paragraphs text={(content?.conclusion ?? '').split(/\n\s*\n/).slice(1).join('\n\n')} /> : null}
      <View style={{ backgroundColor: C.petrol, borderRadius: 4, padding: 20, marginTop: 14 }} wrap={false}>
        <Text style={{ color: C.white, fontFamily: 'Poppins', fontWeight: 500, fontSize: 13, lineHeight: 1.45 }}>{content?.closing || TO_WRITE}</Text>
        <Text style={{ color: C.petrol200, fontSize: 8, marginTop: 10 }}>HAPPI · L’avenir se joue ici.</Text>
      </View>
    </View>
  );
}

// ── 8. Méthodologie et limites ───────────────────────────────────────────────
export function Methodology({ data, content, meta, number }: { data: ReportData; content: ReportContent | null; meta: ReportDocumentProps['meta']; number: string }) {
  const writing =
    meta.contentSource === 'ai'
      ? 'Le texte de ce bilan a été rédigé avec l’aide d’une intelligence artificielle à partir des seuls résultats et commentaires présentés ici, puis relu par l’équipe HAPPI avant validation. L’IA n’a produit aucun niveau ni aucune observation.'
      : meta.contentSource === 'ai_edited'
        ? 'Le texte de ce bilan a été préparé avec l’aide d’une intelligence artificielle à partir des seuls résultats présentés ici, puis relu et corrigé par l’équipe HAPPI. L’IA n’a produit aucun niveau ni aucune observation.'
        : 'Le texte de ce bilan a été rédigé par l’équipe HAPPI à partir des résultats présentés ici.';
  return (
    <View>
      <SectionOpener number={`${number} · MÉTHODE`} title="Méthodologie et limites" />
      <H2>Le programme</H2>
      <Text style={s.p}>
        HAPPI accompagne de petits groupes au fil de sessions de trois heures. Chaque session associe un apport sur un thème, des débats, des jeux vidéo
        coopératifs ou compétitifs et un débriefing collectif. Le jeu sert de mise en situation : il fait apparaître des comportements concrets
        (s’organiser, coopérer, décider, persévérer) que les formateurs observent.
      </Text>
      <H2>Les données utilisées</H2>
      <Bullets
        items={[
          `Les évaluations de session validées par les formateurs (${data.counts.sessionsEvaluated}), soit ${data.counts.observations} observations de compétences, chacune datée et rattachée à une session.`,
          'Les commentaires que les formateurs ont choisi de partager avec le participant. Les notes internes des formateurs ne sont jamais utilisées.',
          data.selfAssessment
            ? 'L’auto-évaluation initiale du participant, présentée à part : elle exprime sa perception, pas une observation.'
            : 'L’auto-évaluation initiale n’a pas été complétée : elle n’apparaît pas dans ce bilan.',
          'La liste des jeux et activités provient du déroulé pédagogique des sessions suivies.',
        ]}
      />
      <H2>Comment les niveaux sont établis</H2>
      <Text style={s.p}>
        Il n’y a pas de score calculé automatiquement par les jeux : chaque niveau est attribué par un formateur, sur l’échelle officielle du
        référentiel. Quand une compétence est observée plusieurs fois, la valeur retenue suit la règle du référentiel :
      </Text>
      <Bullets items={data.frameworks.map((framework) => `${framework.name} : ${framework.rules.aggregationLabel.toLowerCase()} ; échelle ${framework.levels.map((level) => level.label).join(', ')}.`)} />
      <Text style={s.p}>
        Une compétence observée une seule fois est signalée « à confirmer ». Une compétence non observée n’a pas de niveau : elle n’est jamais comptée
        comme un niveau faible. Les deux référentiels ont des échelles différentes : aucun score global ne les additionne. Les compétences « les plus
        mobilisées » et « à développer » sont repérées à partir d’au moins quatre compétences observées dans un référentiel.
      </Text>
      <H2>Rédaction</H2>
      {writingMention(meta.contentSource) ? <Text style={[s.p, { fontWeight: 700 }]}>{writingMention(meta.contentSource)}.</Text> : null}
      <Text style={s.p}>{writing}</Text>
      <H2>Limites de ce bilan</H2>
      <Paragraphs text={content?.limits} />
      {data.missing.length || content?.dataWarnings.length ? (
        <View style={s.box} wrap={false}>
          <Text style={s.h3}>Données manquantes ou insuffisantes</Text>
          <View style={{ marginTop: 6 }}>
            <Bullets items={[...data.missing, ...(content?.dataWarnings ?? [])]} />
          </View>
        </View>
      ) : null}
      <Text style={[s.small, { marginTop: 14 }]}>
        Un bilan HAPPI est un outil d’identification et de valorisation des compétences. Il ne constitue ni un diagnostic psychologique, ni une
        évaluation de la personnalité, ni une décision automatique sur l’aptitude professionnelle d’une personne. Il décrit des comportements observés
        à un moment donné, dans un cadre précis, et gagne à être relu avec la personne et son accompagnateur. Bilan établi le {formatDate(data.generatedAt)}{' '}
        (règles {data.engineVersion}).
      </Text>
    </View>
  );
}

export function ReportDocument({ data, content, options, meta, root = process.cwd() }: ReportDocumentProps) {
  registerReportFonts(root);
  const hidden = new Set(options.hiddenSections);
  const ct = data.frameworks.find((framework) => framework.code === 'transversal');
  const hbs = data.frameworks.find((framework) => framework.code === 'sociocognitive');
  // Numérotation continue : une section masquée ne laisse pas de trou.
  // Les sections sans matière sont omises plutôt que remplies.
  const showBehaviour =
    !hidden.has('behaviour') &&
    Boolean(content?.behaviour.summary || content?.behaviour.themes.length || hbs?.observedCount || data.feedback.length || options.extraObservations);
  const showCt = Boolean(ct && ct.observedCount > 0 && !hidden.has('transversal'));
  const showHbs = Boolean(hbs && hbs.observedCount > 0 && !hidden.has('sociocognitive'));
  let index = 2;
  const next = () => String(++index).padStart(2, '0');
  const numbers = {
    behaviour: showBehaviour ? next() : '',
    transversal: showCt ? next() : '',
    sociocognitive: showHbs ? next() : '',
    recommendations: hidden.has('recommendations') ? '' : next(),
    conclusion: next(),
    methodology: next(),
  };
  return (
    <Document
      title={`Bilan des compétences — ${data.participant.firstName} ${data.participant.lastName}`}
      author="HAPPI Compétence"
      subject="Bilan des compétences HAPPI"
      language="fr-FR"
    >
      <Cover data={data} options={options} meta={meta} root={root} />
      {/* Une page (ou une suite de pages) par section : chaque section commence en haut de page. */}
      <Frame data={data} meta={meta}>
        <Introduction data={data} content={content} />
      </Frame>
      <Frame data={data} meta={meta}>
        <Profile data={data} content={content} />
      </Frame>
      <Frame data={data} meta={meta}>
        <SkillMap data={data} />
      </Frame>
      {!showBehaviour ? null : (
        <Frame data={data} meta={meta}>
          <Behaviour data={data} content={content} options={options} hidden={hidden} number={numbers.behaviour} />
        </Frame>
      )}
      {ct && showCt ? (
        <Frame data={data} meta={meta}>
          <Details framework={ct} number={`${numbers.transversal} · COMPÉTENCES TRANSVERSALES`} content={content} />
        </Frame>
      ) : null}
      {hbs && showHbs ? (
        <Frame data={data} meta={meta}>
          <Details framework={hbs} number={`${numbers.sociocognitive} · HABILETÉS SOCIO-COGNITIVES`} content={content} />
        </Frame>
      ) : null}
      <Frame data={data} meta={meta}>
        {hidden.has('recommendations') ? null : <Recommendations data={data} content={content} number={numbers.recommendations} />}
        <Conclusion content={content} number={numbers.conclusion} spaced={!hidden.has('recommendations')} />
      </Frame>
      <Frame data={data} meta={meta}>
        <Methodology data={data} content={content} meta={meta} number={numbers.methodology} />
      </Frame>
    </Document>
  );
}
