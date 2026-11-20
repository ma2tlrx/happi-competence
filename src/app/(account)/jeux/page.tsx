import { ArrowRight, Bug, CircleHelp, Smartphone } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { RecentSessions } from '@/components/jeux/recent-sessions';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, Notice, PageHeader } from '@/components/ui/primitives';
import { requireGamesAccess } from '@/lib/jeux/page-access';

export const metadata: Metadata = { title: 'Jeux d’animation' };

export default async function GamesHubPage() {
  await requireGamesAccess();
  return (
    <>
      <PageHeader
        title="Jeux d’animation"
        description="Animez vos séances avec des jeux en direct : les participants rejoignent depuis leur téléphone, connectés à leur compte HAPPI, avec un code ou un QR code."
        actions={
          <Button asChild variant="outline">
            <Link href="/jouer">
              <Smartphone aria-hidden />
              Essayer en tant que joueur
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader title="Quiz" description="Des questions chronométrées, un classement en direct. Créez vos quiz, puis lancez une partie." />
          <CardBody className="mt-auto flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/jeux/quiz">
                <CircleHelp aria-hidden />
                Bibliothèque de quiz
              </Link>
            </Button>
          </CardBody>
        </Card>
        <Card className="flex flex-col">
          <CardHeader title="Undercover (Fourmi Caché)" description="Un jeu de mots et de bluff : chacun reçoit un mot en secret, sauf l’Espion. À partir de 4 joueurs pour l’inclure." />
          <CardBody className="mt-auto flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/jeux/undercover">
                <Bug aria-hidden />
                Créer une partie
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/jeux/undercover#configurations">Mes configurations</Link>
            </Button>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Parties récentes"
          description="Vos dernières parties de quiz."
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/jeux/quiz">
                Tous les quiz
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          }
        />
        <div className="mt-3">
          <RecentSessions />
        </div>
      </Card>

      <Notice className="mt-6" title="Des outils d’animation, pas des évaluations">
        Le résultat de chaque participant (rang, score) est conservé dans son espace « Mes jeux » et sur sa fiche, hors bilan. Il n’alimente ni les évaluations, ni les
        passeports, ni les statistiques d’impact ; le pseudo choisi n’est pas conservé. Les parties d’essai (animateurs) n’enregistrent rien, et les parties
        Undercover en cours sont effacées au bout de quelques heures.
      </Notice>
    </>
  );
}
