import { Bell, CheckCheck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';

import { Button } from '@/components/ui/button';
import { Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { cn, formatRelative, safeInternalPath } from '@/lib/utils';

export const metadata: Metadata = { title: 'Notifications' };

async function markAllRead() {
  'use server';
  const user = await requireUser();
  const supabase = await createClient();
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null);
  revalidatePath('/', 'layout');
}

export default async function NotificationsPage() {
  await requireUser();
  const supabase = await createClient();
  const { data: notifications } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100);
  const unread = notifications?.filter((notification) => !notification.read_at).length ?? 0;

  return (
    <>
      <PageHeader
        title="Notifications"
        description={unread > 0 ? `${unread} non lue${unread > 1 ? 's' : ''}` : 'Vous êtes à jour.'}
        actions={
          unread > 0 ? (
            <form action={markAllRead}>
              <Button type="submit" variant="outline">
                <CheckCheck aria-hidden />
                Tout marquer comme lu
              </Button>
            </form>
          ) : null
        }
      />
      <Card>
        {notifications && notifications.length > 0 ? (
          <ul className="divide-y divide-line">
            {notifications.map((notification) => {
              const content = (
                <div className="flex gap-4 px-5 py-4 sm:px-6">
                  <span className={cn('mt-2 size-2 shrink-0 rounded-full', notification.read_at ? 'bg-transparent' : 'bg-orange-500')} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-[0.9375rem]', notification.read_at ? 'text-ink-muted' : 'font-semibold text-ink')}>
                      {notification.title}
                      {!notification.read_at ? <span className="sr-only"> (non lue)</span> : null}
                    </p>
                    {notification.body ? <p className="mt-0.5 text-sm text-ink-muted">{notification.body}</p> : null}
                    <p className="mt-1 text-xs text-ink-subtle">{formatRelative(notification.created_at)}</p>
                  </div>
                </div>
              );
              return (
                <li key={notification.id}>
                  {notification.link ? (
                    <Link href={safeInternalPath(notification.link)} className="block transition-colors hover:bg-petrol-50/50">
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={Bell} title="Aucune notification" description="Les validations d’évaluation, les changements de groupe et les décisions vous concernant apparaîtront ici." />
        )}
      </Card>
    </>
  );
}
