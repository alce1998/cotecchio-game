/** Design: Notte in Osteria — regole pure e trasparenti, come un tavolo da circolo. */
import { GameCard, PlayedCard, Rank, Suit, SUITS } from "./types";

export const SUIT_LABEL: Record<Suit, string> = {
  denari: "Denari",
  coppe: "Coppe",
  bastoni: "Bastoni",
  spade: "Spade",
};

export const RANK_LABEL: Record<Rank, string> = {
  1: "Asso",
  2: "Due",
  3: "Tre",
  4: "Quattro",
  5: "Cinque",
  6: "Sei",
  7: "Sette",
  8: "Fante",
  9: "Cavallo",
  10: "Re",
};

const hierarchy: Rank[] = [3, 2, 1, 10, 9, 8, 7, 6, 5, 4];

export function createDeck(): GameCard[] {
  return SUITS.flatMap((suit) =>
    Array.from({ length: 10 }, (_, index) => {
      const rank = (index + 1) as Rank;
      return { id: `${suit}-${rank}`, suit, rank };
    }),
  );
}

export function cardLabel(card: GameCard) {
  return `${RANK_LABEL[card.rank]} di ${SUIT_LABEL[card.suit]}`;
}

export function cardPoint(card: GameCard) {
  if (card.suit === "bastoni" && card.rank === 1) return 6;
  if (card.rank === 1) return 1;
  if ([2, 3, 8, 9, 10].includes(card.rank)) return 1 / 3;
  return 0;
}

export function legalCards(hand: GameCard[], leadSuit: Suit | null) {
  if (!leadSuit) return hand;
  const matching = hand.filter((card) => card.suit === leadSuit);
  return matching.length ? matching : hand;
}

export function trickWinner(trick: PlayedCard[], leadSuit: Suit) {
  const inSuit = trick.filter(({ card }) => card.suit === leadSuit);
  return inSuit.reduce((best, item) =>
    hierarchy.indexOf(item.card.rank) < hierarchy.indexOf(best.card.rank) ? item : best,
  ).playerId;
}

export function discardedFor(playerCount: number, deck: GameCard[]) {
  const fours = deck.filter((card) => card.rank === 4);
  if (playerCount === 3) return [fours[0]];
  if (playerCount === 6) return fours;
  if (playerCount === 7) return [...fours, deck.find((card) => card.rank === 5)!];
  return [];
}

export function sortHand(hand: GameCard[]) {
  return [...hand].sort((a, b) => {
    const suitDelta = SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
    return suitDelta || hierarchy.indexOf(a.rank) - hierarchy.indexOf(b.rank);
  });
}

