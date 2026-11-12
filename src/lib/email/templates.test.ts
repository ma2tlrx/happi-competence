import { describe, expect, it } from 'vitest';

import { maskEmail, scrubError } from './mask';
import { emailOrigin } from './origin';
import { detectProvider, parseFrom } from './provider';
import { absoluteLink, EMAIL_TEMPLATES, renderEmail, type SessionEmailData } from './templates';

const origin = 'https://happi.example';
const session: SessionEmailData = {
  firstName: 'Inès',
  sessionNumber: 2,
  sessionTitle: 'Coopérer en équipe',
  programName: 'Parcours HAPPI',
  groupName: 'Groupe <Nord>',
  date: '2026-11-12',
  startTime: '09:00:00',
  endTime: '12:00:00',
  location: 'Salle 3, Béziers',
  summary: 'Jeu coopératif et débriefing.',
  objectives: ['Écouter', 'Proposer'],
  link: '/participant/parcours',
};

describe('modèles d’e-mail', () => {
  it('rend la convocation avec date, heure, lieu et programme, en HTML et en texte', () => {
    const email = renderEmail('session_convocation', session, origin);
    expect(email.subject).toBe('Convocation : séance 2 le jeudi 12 novembre 2026');
    expect(email.html).toContain('<html lang="fr">');
    expect(email.html).toContain('de 9 h 00 à 12 h 00');
    expect(email.html).toContain('Salle 3, Béziers');
    expect(email.html).toContain('Objectifs de la séance');
    expect(email.html).toContain('https://happi.example/participant/parcours');
    expect(email.text).toContain('Lieu : Salle 3, Béziers');
    expect(email.text).toContain('Bonjour Inès,');
  });

  it('échappe les données et n’affiche « À apporter » que si l’information existe', () => {
    const email = renderEmail('session_convocation', session, origin);
    expect(email.html).toContain('Groupe &lt;Nord&gt;');
    expect(email.html).not.toContain('<Nord>');
    expect(email.html).not.toContain('À apporter');
    expect(renderEmail('session_convocation', { ...session, bring: ['Une pièce d’identité'] }, origin).html).toContain('À apporter');
  });

  it('n’exige aucune image distante', () => {
    for (const template of EMAIL_TEMPLATES) {
      const { html } = renderEmail(template, session as never, origin);
      expect(html).not.toMatch(/<img/i);
      expect(html).toContain('role="presentation"');
    }
  });

  it('rend le rappel, la modification, l’annulation, le bilan et l’invitation', () => {
    expect(renderEmail('session_reminder', session, origin).subject).toContain('demain');
    expect(renderEmail('session_reminder', session, origin).text).toContain('désactiver les rappels');
    expect(renderEmail('session_updated', session, origin).html).toContain('ont changé');
    expect(renderEmail('session_cancelled', session, origin).subject).toBe('Séance 2 du jeudi 12 novembre 2026 annulée');
    expect(renderEmail('report_available', { firstName: 'Inès' }, origin).text).toContain('https://happi.example/participant/bilan');
    const invitation = renderEmail('participant_invitation', { firstName: 'Inès', programName: 'HAPPI' }, origin);
    expect(invitation.text).toContain('https://happi.example/inscription');
  });

  it('gère une séance sans horaire ni lieu', () => {
    const email = renderEmail('session_convocation', { sessionNumber: 1 }, origin);
    expect(email.text).toContain('Horaire : horaire à préciser');
    expect(email.text).toContain('Bonjour,');
  });

  it('refuse les liens externes ou ambigus', () => {
    expect(absoluteLink(origin, '//evil.example/x')).toBe('https://happi.example/');
    expect(absoluteLink(origin, 'https://evil.example')).toBe('https://happi.example/');
    expect(absoluteLink(`${origin}/`, '/a')).toBe('https://happi.example/a');
  });
});

describe('masquage', () => {
  it('masque les adresses', () => {
    expect(maskEmail('jeanne.dupont@exemple.fr')).toBe('j…t@e…e.fr');
    expect(maskEmail('a@b.io')).toBe('a…@b….io');
    expect(maskEmail(null)).toBe('—');
    expect(maskEmail('jeanne.dupont@exemple.fr')).not.toContain('dupont');
  });

  it('retire les adresses des messages d’erreur et les tronque', () => {
    const message = scrubError(new Error('Recipient jeanne.dupont@exemple.fr rejected'));
    expect(message).not.toContain('jeanne.dupont');
    expect(message).toContain('j…t@e…e.fr');
    expect(scrubError('x'.repeat(900)).length).toBe(500);
  });
});

describe('configuration', () => {
  it('passe en mode journal sans fournisseur', () => {
    expect(detectProvider({})).toMatchObject({ kind: 'journal', configured: false });
    expect(detectProvider({ EMAIL_PROVIDER: 'poste' })).toMatchObject({ kind: 'journal', configured: false });
  });

  it('détecte chaque fournisseur et ses manques', () => {
    expect(detectProvider({ EMAIL_PROVIDER: 'smtp', SMTP_URL: 'smtp://localhost:54325' })).toMatchObject({ kind: 'smtp', configured: true });
    expect(detectProvider({ EMAIL_PROVIDER: 'smtp' })).toMatchObject({ kind: 'smtp', configured: false });
    expect(detectProvider({ EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'k' })).toMatchObject({ kind: 'brevo', configured: false });
    expect(detectProvider({ EMAIL_PROVIDER: 'Brevo', BREVO_API_KEY: 'k', EMAIL_FROM: 'HAPPI <no-reply@happi.fr>' })).toMatchObject({ kind: 'brevo', configured: true });
    expect(detectProvider({ EMAIL_PROVIDER: 'resend', EMAIL_FROM: 'no-reply@happi.fr' })).toMatchObject({ kind: 'resend', configured: false });
  });

  it('ne met jamais de secret dans le message de configuration', () => {
    const config = detectProvider({ EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'xkeysib-secret' });
    expect(JSON.stringify(config)).not.toContain('xkeysib-secret');
  });

  it('lit l’expéditeur', () => {
    expect(parseFrom('HAPPI Compétence <no-reply@happi.fr>')).toEqual({ name: 'HAPPI Compétence', email: 'no-reply@happi.fr' });
    expect(parseFrom('no-reply@happi.fr')).toEqual({ name: 'HAPPI Compétence', email: 'no-reply@happi.fr' });
    expect(parseFrom('pas une adresse')).toBeNull();
  });

  it('choisit l’origine des liens', () => {
    expect(emailOrigin(null, { NEXT_PUBLIC_SITE_URL: 'https://happi.fr/' })).toBe('https://happi.fr');
    expect(emailOrigin(null, { VERCEL_PROJECT_PRODUCTION_URL: 'happi.vercel.app' })).toBe('https://happi.vercel.app');
    expect(emailOrigin('http://localhost:3106', {})).toBe('http://localhost:3106');
  });
});
