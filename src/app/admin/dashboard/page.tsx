import { Building2, CalendarDays, ClipboardCheck, GraduationCap, Inbox, KeyRound, Layers, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Card, CardBody, CardHeader, PageHeader, StatTile } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { attendanceRate } from '@/lib/evaluation-engine';
import { createClient } from '@/lib/supabase/server';
import { AUDIT_ACTION_LABELS as ACTION_LABELS } from '@/lib/audit-labels';
import { formatPercent, formatRelative, isoDaysAgo } from '@/lib/utils';

export const metadata: Metadata = { title: 'Administration' };


export default async function AdminDashboard() {
  await requireRole('admin');
  const supabase = await createClient();
  const since = isoDaysAgo(30);
  const count = (table: 'participants' | 'organizations' | 'programs' | 'groups' | 'sessions') => supabase.from(table).select('id', { count: 'exact', head: true });
  const [participants, organizations, pendingOrgs, trainers, programs, groups, sessions, completed, attendance, evaluations, signIns, newAccounts, messages, requests, activity] = await Promise.all([
    count('participants'),
    count('organizations'),
    supabase.from('organizations').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'formateur').eq('status', 'active'),
    count('programs'),
    count('groups'),
    count('sessions'),
    supabase.from('sessions').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
    supabase.from('attendance').select('status'),
    supabase.from('evaluations').select('id', { count: 'exact', head: true }).eq('status', 'validated'),
    supabase.from('audit_logs').select('id', { count: 'exact', head: true }).eq('action', 'auth.signed_in').gte('occurred_at', since),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', since),
    supabase.from('contact_messages').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    supabase.from('data_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('audit_logs').select('id, occurred_at, action, actor_role').neq('action', 'auth.signed_in').order('occurred_at', { ascending: false }).limit(8),
  ]);
  const rows = attendance.data ?? [];

  return (
    <>
      <PageHeader title="Administration" description="Vue globale de la plateforme HAPPI." />
      {(pendingOrgs.count ?? 0) + (messages.count ?? 0) + (requests.count ?? 0) > 0 ? (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {[
            { href: '/admin/organismes?statut=pending', icon: Building2, label: 'Organismes à valider', value: pendingOrgs.count ?? 0 },
            { href: '/admin/parametres#messages', icon: Inbox, label: 'Messages non lus', value: messages.count ?? 0 },
            { href: '/admin/parametres#rgpd', icon: KeyRound, label: 'Demandes RGPD en attente', value: requests.count ?? 0 },
          ]
            .filter((item) => item.value > 0)
            .map((item) => (
              <Link key={item.href} href={item.href} className="flex items-center gap-4 rounded-lg border border-orange-200 bg-orange-50 p-4 hover:border-orange-300">
                <item.icon className="size-5 text-orange-700" aria-hidden />
                <span className="flex-1 font-semibold">{item.label}</span>
                <span className="font-display text-xl font-semibold">{item.value}</span>
              </Link>
            ))}
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label="Participants" value={participants.count ?? 0} icon={Users} />
        <StatTile label="Organismes" value={organizations.count ?? 0} icon={Building2} />
        <StatTile label="Formateurs actifs" value={trainers.count ?? 0} icon={GraduationCap} />
        <StatTile label="Programmes" value={programs.count ?? 0} icon={Layers} />
        <StatTile label="Groupes" value={groups.count ?? 0} icon={Users} />
        <StatTile label="Sessions" value={sessions.count ?? 0} detail={`${completed.count ?? 0} réalisées`} icon={CalendarDays} />
        <StatTile label="Taux de présence" value={formatPercent(attendanceRate(rows.map((r) => r.status)))} detail={`${rows.length} présences saisies`} icon={ClipboardCheck} />
        <StatTile label="Évaluations validées" value={evaluations.count ?? 0} icon={ClipboardCheck} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Utilisation sur 30 jours" />
          <CardBody>
            <dl className="grid grid-cols-2 gap-4">
              <div><dt className="text-sm text-ink-muted">Connexions</dt><dd className="font-display text-2xl font-semibold">{signIns.count ?? 0}</dd></div>
              <div><dt className="text-sm text-ink-muted">Nouveaux comptes</dt><dd className="font-display text-2xl font-semibold">{newAccounts.count ?? 0}</dd></div>
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Activité récente" action={<Link href="/admin/journal-activite" className="text-sm font-semibold text-petrol-700">Journal complet</Link>} />
          <CardBody className="pt-3">
            <ul className="divide-y divide-line">
              {(activity.data ?? []).map((entry) => (
                <li key={entry.id} className="flex justify-between gap-3 py-2 text-[0.9375rem]">
                  <span>{ACTION_LABELS[entry.action] ?? entry.action}</span>
                  <span className="shrink-0 text-sm text-ink-subtle">{formatRelative(entry.occurred_at)}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
