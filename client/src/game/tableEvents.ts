import { cardPoint } from "./rules";
import type { GameCard, PlayedCard } from "./types";

export type TableEffect = "pelliccione" | "cappotto" | "finale";

export function isPelliccione(card: GameCard) {
  return card.suit === "bastoni" && card.rank === 1;
}

export function pelliccioneEventKey(roundIndex: number, trick: PlayedCard[]) {
  const played = trick.find(({ card }) => isPelliccione(card));
  return played ? `${roundIndex}-${played.playerId}-${played.card.id}` : null;
}

export function trickPointTotal(trick: PlayedCard[]) {
  return trick.reduce((sum, { card }) => sum + cardPoint(card), 0);
}

export function roundEffect(phase: "playing" | "resolving" | "roundEnd" | "matchEnd", awards: number[]): TableEffect | null {
  if (phase === "matchEnd") return awards.includes(-16) ? "cappotto" : "finale";
  if (phase === "roundEnd" && awards.includes(-16)) return "cappotto";
  return null;
}
