import { CalendarCheck, ChevronRight, Flag, Users, type LucideIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';

import { GroupCard } from '@/components/organisme/group-card';
import { PendingSurveysCard } from '@/components/satisfaction/pending-card';
import { Card } from '@/components/ui/primitives';
import { hasPermission, requireRole } from '@/lib/auth/session';
import { MILESTONE_TIERS, milestoneProgress, type MilestoneId } from '@/lib/engagement/milestones';
import { arrangeGroups } from '@/lib/organisme/groups';
import { loadMyGroups, type GroupSummary } from '@/lib/organisme/load';
import { loadMySurveys } from '@/lib/satisfaction/load';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Mes groupes' };

function GroupGrid({ groups }: { groups: GroupSummary[] }) {
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {groups.map((group) => (
        <li key={group.id} className="grid">
          <GroupCard group={group} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Espace organisme, accueil unique : les groupes de la structure. Une carte par groupe (avancement, présence,
 * prochaine séance, personnes à relancer) mène à la page du groupe. Les groupes terminés sont repliés.
 */
export default async function OrganizationDashboard() {
  const user = await requireRole('organisme');
  const supabase = await createClient();
  const access = { attendance: hasPermission(user, 'org.attendance.read'), evaluations: hasPermission(user, 'org.evaluations.read') };
  const [{ groups, stats }, surveys] = await Promise.all([loadMyGroups(supabase, access), loadMySurveys(supabase)]);
  const arranged = arrangeGroups(groups);
  const milestones: { id: MilestoneId; label: string; icon: LucideIcon; value: number }[] = [
    { id: 'personnes', label: 'personnes accompagnées', icon: Users, value: stats.people },
    { id: 'sessions', label: 'séances réalisées', icon: CalendarCheck, value: stats.completedSessions },
    { id: 'parcours', label: 'parcours menés à terme', icon: Flag, value: stats.completedJourneys },
  ];

  return (
    <>
      <header className="pixel-grid mb-6 rounded-xl bg-petrol-900 p-5 text-white sm:p-7">
        <h1 className="font-display text-[1.625rem] leading-tight font-semibold text-white sm:text-[1.875rem]">{user.organization?.name ?? 'Mes groupes'}</h1>
        <p className="mt-1.5 max-w-2xl text-white/75">Ouvrez un groupe pour voir les résultats de chaque membre et relancer les personnes absentes.</p>
        <ul aria-label="Les jalons de votre structure" className="mt-5 flex flex-wrap gap-2">
          {milestones.map((item) => {
            const reached = milestoneProgress(item.value, MILESTONE_TIERS[item.id]).reached > 0;
            return (
              <li key={item.id} className="flex items-center gap-2.5 rounded-lg bg-white/[0.06] py-1.5 pr-3.5 pl-1.5 ring-1 ring-white/10">
                <span aria-hidden className={cn('pixel-corners flex size-8 items-center justify-center', reached ? 'bg-orange-500 text-petrol-950' : 'bg-white/10 text-white/65')}>
                  <item.icon className="size-4" />
                </span>
                <span className="text-sm text-white/75">
                  <span className="font-display text-lg font-semibold text-white tabular-nums">{item.value}</span> {item.label}
                </span>
              </li>
            );
          })}
        </ul>
      </header>

      {/* Enquête « prescripteur » en fin de programme (obligation Qualiopi) : la carte n'apparaît que si une réponse est attendue. */}
      {surveys.some((survey) => !survey.answered) ? (
        <div className="mb-6">
          <PendingSurveysCard surveys={surveys} basePath="/organisme/satisfaction" />
        </div>
      ) : null}

      {groups.length === 0 ? (
        <Card className="flex flex-col items-center px-6 py-12 text-center">
          <Image src="/brand/happi-mascotte-3d.webp" alt="" width={84} height={140} className="h-28 w-auto" />
          <h2 className="mt-4 font-display text-lg font-semibold text-ink">Aucun groupe pour l’instant</h2>
          <p className="mt-1 max-w-md text-sm text-ink-muted">Vos groupes apparaîtront ici dès qu’un formateur y inscrira une personne de votre structure.</p>
        </Card>
      ) : (
        <div className="space-y-8">
          {arranged.current.length ? (
            <section aria-labelledby="groupes-en-cours">
              <h2 id="groupes-en-cours" className="mb-3 font-display text-lg font-semibold text-ink">
                En cours ({arranged.current.length})
              </h2>
              <GroupGrid groups={arranged.current} />
            </section>
          ) : null}
          {arranged.upcoming.length ? (
            <section aria-labelledby="groupes-a-venir">
              <h2 id="groupes-a-venir" className="mb-3 font-display text-lg font-semibold text-ink">
                À venir ({arranged.upcoming.length})
              </h2>
              <GroupGrid groups={arranged.upcoming} />
            </section>
          ) : null}
          {arranged.current.length + arranged.upcoming.length === 0 ? <p className="text-ink-muted">Aucun groupe en cours ni à venir.</p> : null}
          {arranged.finished.length ? (
            <details className="group/finished">
              <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-md font-display text-lg font-semibold text-ink hover:text-petrol-700 [&::-webkit-details-marker]:hidden">
                <ChevronRight className="size-5 transition-transform group-open/finished:rotate-90" aria-hidden />
                Groupes terminés ({arranged.finished.length})
              </summary>
              <div className="mt-3">
                <GroupGrid groups={arranged.finished} />
              </div>
            </details>
          ) : null}
        </div>
      )}
    </>
  );
}
