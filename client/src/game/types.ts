/** Design: Notte in Osteria — dominio del Cotecchio indipendente dal rendering. */
export const SUITS = ["denari", "coppe", "bastoni", "spade"] as const;
export type Suit = (typeof SUITS)[number];
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface GameCard {
  id: string;
  suit: Suit;
  rank: Rank;
}

export interface PlayedCard {
  playerId: number;
  card: GameCard;
}

export interface PlayerState {
  id: number;
  name: string;
  hand: GameCard[];
  score: number;
  roundPointsRaw: number;
  tricks: number;
}

export type GamePhase = "playing" | "resolving" | "roundEnd" | "matchEnd";

export interface GameState {
  players: PlayerState[];
  playerCount: number;
  scoreLimit: number;
  turn: number;
  leader: number;
  leadSuit: Suit | null;
  trick: PlayedCard[];
  lastTrick: PlayedCard[];
  discarded: GameCard[];
  roundIndex: number;
  phase: GamePhase;
  roundAwards: number[];
  roundAbbuono: number[];
  closedInHandBy?: number | null;
}
