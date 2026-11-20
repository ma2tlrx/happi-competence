'use client';

import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input } from '@/components/ui/form';
import { joinQuiz } from '@/lib/jeux/client-quiz';
import { loginUrl } from '@/lib/jeux/client-http';
import { CODE_LENGTH, NICKNAME_MAX, nicknameError, normalizeCode, undercoverApi } from '@/lib/jeux/client-undercover';

import { GameHeading, GameStage } from './shared/game-shell';
import { LiveRegion } from './shared/live-region';

type Target = { type: 'undercover'; gameId: string } | { type: 'quiz' };

/**
 * Accès à une partie par un compte connecté : code (saisi ou fourni par le QR code), détection du type de jeu, puis pseudo
 * (proposé : prénom + initiale du nom). Un animateur (formateur, administrateur) joue en partie d'essai : aucun résultat enregistré.
 * Les contrôles réels (rôle, inscription, limitation du nombre d'essais) sont faits par le serveur.
 */
export function JoinForm({ initialCode, defaultNickname, animator }: { initialCode: string; defaultNickname: string; animator: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [target, setTarget] = useState<Target | null>(null);
  const [nickname, setNickname] = useState(defaultNickname);
  const [error, setError] = useState<{ field: 'code' | 'nickname'; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const autoChecked = useRef(false);

  async function checkCode(value: string) {
    if (value.length !== CODE_LENGTH) {
      setError({ field: 'code', message: `Le code comporte ${CODE_LENGTH} caractères (lettres et chiffres).` });
      return;
    }
    setBusy(true);
    setError(null);
    const result = await undercoverApi.lookup(value);
    setBusy(false);
    if (result.ok) {
      setTarget({ type: 'undercover', gameId: result.data.game.gameId });
      return;
    }
    if (result.status === 404) {
      // Pas une partie Undercover : on poursuit avec le quiz, dont le code est vérifié au moment de rejoindre.
      setTarget({ type: 'quiz' });
      return;
    }
    if (result.status === 401) {
      goToLogin();
      return;
    }
    setError({ field: 'code', message: result.status === 409 ? 'Cette partie a déjà commencé : vous ne pouvez plus la rejoindre.' : result.error });
  }

  /** Session expirée : retour à la connexion, qui ramène ici avec le même code. */
  function goToLogin() {
    window.location.assign(loginUrl(`/jouer?code=${code}`));
  }

  // Arrivée par QR code : le code est déjà connu, on passe directement au pseudo.
  useEffect(() => {
    if (autoChecked.current || initialCode.length !== CODE_LENGTH) return;
    autoChecked.current = true;
    void checkCode(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule vérification, au chargement, avec le code reçu
  }, [initialCode]);

  function submitCode(event: FormEvent) {
    event.preventDefault();
    void checkCode(code);
  }

  async function submitNickname(event: FormEvent) {
    event.preventDefault();
    if (!target) return;
    const problem = nicknameError(nickname);
    if (problem) {
      setError({ field: 'nickname', message: problem });
      return;
    }
    const pseudo = nickname.trim();
    // Plein écran sur téléphone : demandé ici, car il exige un geste de l'utilisateur.
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      // Refusé ou non pris en charge : on continue sans.
    }
    setBusy(true);
    setError(null);
    if (target.type === 'undercover') {
      const joined = await undercoverApi.join(target.gameId, pseudo, animator);
      if (joined.ok) {
        router.push(`/jouer/undercover/${target.gameId}?playerId=${encodeURIComponent(joined.data.playerId)}`);
        return;
      }
      setBusy(false);
      if (joined.status === 401) goToLogin();
      else
        setError({
          field: 'nickname',
          message: joined.status === 409 ? 'Impossible de rejoindre : la partie a commencé, elle est complète ou ce pseudo est déjà pris.' : joined.error,
        });
      return;
    }
    const result = await joinQuiz(code, pseudo, animator);
    if (result.ok) {
      router.push(`/jouer/quiz/${result.data.sessionId}?playerId=${encodeURIComponent(result.data.playerId)}`);
      return;
    }
    setBusy(false);
    if (result.status === 401) {
      goToLogin();
      return;
    }
    if (result.status === 404) {
      setTarget(null);
      setError({ field: 'code', message: 'Aucune partie ne correspond à ce code. Vérifiez-le auprès de l’animateur.' });
    } else {
      setError({ field: 'nickname', message: result.error });
    }
  }

  const step = target ? 'nickname' : 'code';
  return (
    <GameStage className="my-auto py-6">
      <GameHeading
        eyebrow="Jeux HAPPI"
        title={step === 'code' ? 'Rejoindre une partie' : 'Choisissez votre pseudo'}
        className="mb-6"
      />
      <div className="rounded-xl bg-white p-5 text-ink shadow-lg sm:p-6">
        {step === 'code' ? (
          <form onSubmit={submitCode} noValidate className="flex flex-col gap-4">
            <Field label="Code de la partie" hint="Six caractères, affichés sur l’écran de l’animateur." error={error?.field === 'code' ? error.message : null}>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  value={code}
                  onChange={(event) => {
                    setCode(normalizeCode(event.target.value));
                    setError(null);
                  }}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  inputMode="text"
                  autoComplete="off"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={CODE_LENGTH}
                  autoFocus
                  placeholder="ABC123"
                  className="h-14 text-center font-mono text-2xl tracking-[0.3em] uppercase"
                />
              )}
            </Field>
            <Button type="submit" size="lg" loading={busy} disabled={code.length < CODE_LENGTH}>
              Continuer
              <ArrowRight aria-hidden />
            </Button>
          </form>
        ) : (
          <form onSubmit={submitNickname} noValidate className="flex flex-col gap-4">
            <p className="text-sm text-ink-muted">
              Partie <span className="font-mono font-semibold tracking-widest text-ink">{code}</span>
              {target?.type === 'undercover' ? ' · Fourmi Caché' : ' · Quiz'}
            </p>
            <Field
              label="Votre pseudo"
              hint="Visible des autres joueurs, 2 à 20 caractères. Évitez votre nom complet, un e-mail ou un numéro de téléphone."
              error={error?.field === 'nickname' ? error.message : null}
            >
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  value={nickname}
                  onChange={(event) => {
                    setNickname(event.target.value);
                    setError(null);
                  }}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  autoComplete="nickname"
                  maxLength={NICKNAME_MAX}
                  autoFocus
                  placeholder="Votre pseudo"
                  className="h-14 text-lg"
                />
              )}
            </Field>
            {animator ? (
              <Checkbox
                label="Partie d’essai"
                description="Vous essayez le jeu en tant qu’animateur : aucun résultat n’est enregistré."
                checked
                disabled
                readOnly
              />
            ) : (
              <p className="text-sm text-ink-muted">Votre résultat sera conservé dans « Mes jeux », sans votre pseudo.</p>
            )}
            <Button type="submit" size="lg" loading={busy}>
              Rejoindre la partie
              <ArrowRight aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={() => {
                setTarget(null);
                setError(null);
              }}
            >
              <ArrowLeft aria-hidden />
              Changer de code
            </Button>
          </form>
        )}
      </div>
      <LiveRegion message={error?.message ?? (step === 'nickname' ? 'Partie trouvée. Saisissez votre pseudo.' : '')} assertive={Boolean(error)} />
    </GameStage>
  );
}
