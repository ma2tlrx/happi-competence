/**
 * Calculs d'affichage d'une partie Undercover, à partir de l'état public renvoyé par le serveur.
 * Fonctions pures (aucune règle de jeu : celles-ci, dont le départage des votes, vivent côté serveur).
 */
import type { PublicGame, PublicPlayer, RoundResult } from './client-undercover';

/** Joueurs encore en jeu (l'animateur ne joue pas). */
export function activePlayers(game: PublicGame): PublicPlayer[] {
  return Object.values(game.players).filter((player) => !player.isEliminated && !player.isHost);
}

/** Ordre de parole sans les joueurs éliminés. */
export function activeSpeakingOrder(game: PublicGame): string[] {
  return game.speakingOrder.filter((id) => game.players[id] && !game.players[id].isEliminated);
}

export function currentSpeaker(game: PublicGame): PublicPlayer | null {
  const id = activeSpeakingOrder(game)[game.currentSpeakerIndex];
  return id ? (game.players[id] ?? null) : null;
}

export function isLastSpeaker(game: PublicGame): boolean {
  return game.currentSpeakerIndex >= activeSpeakingOrder(game).length - 1;
}

export type TallyLine = { targetId: string; nickname: string; count: number };

/** Décompte des voix d'une manche, du plus voté au moins voté (ordre alphabétique à égalité). */
export function tallyVotes(game: PublicGame, round: Pick<RoundResult, 'votes'>): TallyLine[] {
  const counts = new Map<string, number>();
  for (const targetId of Object.values(round.votes)) counts.set(targetId, (counts.get(targetId) ?? 0) + 1);
  return [...counts.entries()]
    .map(([targetId, count]) => ({ targetId, nickname: game.players[targetId]?.nickname ?? 'Joueur inconnu', count }))
    .sort((a, b) => b.count - a.count || a.nickname.localeCompare(b.nickname, 'fr'));
}

/**
 * Identifiant du tour de vote en cours : change à chaque manche et à chaque vote de départage,
 * ce qui remet à zéro le « j'ai déjà voté » d'un joueur sans état supplémentaire.
 */
export function voteKey(game: PublicGame): string {
  return `${game.currentRound}:${(game.tiebreakPlayerIds ?? []).join(',')}`;
}

export function pluralFr(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count > 1 ? plural : singular}`;
}
