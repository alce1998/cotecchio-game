/** Design: Notte in Osteria — macchina a stati locale, rigorosa nelle regole e nelle prese. */
import { cardPoint, createDeck, discardedFor, legalCards, sortHand, trickWinner } from "./rules";
import { GameCard, GameState, PlayerState } from "./types";

const CPU_NAMES = ["Tu", "Maestro", "Sergio", "Carlaccio", "Roscio", "Ciop", "Enzo", "Leonardo", "Adolfo", "Lino", "O'Matto", "Felciotto", "CriCri", "Alessandra", "GiovaneMaestro"];
const TRICK_ORDER = [3, 2, 1, 10, 9, 8, 7, 6, 5, 4];

function trickStrength(card: GameCard) {
  return TRICK_ORDER.indexOf(card.rank);
}

function isPelliccione(card: GameCard) {
  return card.suit === "bastoni" && card.rank === 1;
}

function opponentsCards(game: GameState, playerId: number) {
  return game.players.filter((player) => player.id !== playerId).flatMap((player) => player.hand);
}

function cardWinsCurrentTrick(game: GameState, playerId: number, card: GameCard) {
  if (!game.leadSuit || card.suit !== game.leadSuit) return false;
  const bestOnTable = game.trick.filter((item) => item.card.suit === game.leadSuit).sort((a, b) => trickStrength(a.card) - trickStrength(b.card))[0];
  return !bestOnTable || trickStrength(card) < trickStrength(bestOnTable.card);
}

function hasHigherOpponentCard(card: GameCard, opponents: GameCard[]) {
  return opponents.some((other) => other.suit === card.suit && trickStrength(other) < trickStrength(card));
}

function discardPriority(card: GameCard, opponents: GameCard[]) {
  const rankDanger = 10 - trickStrength(card);
  const futureTakeRisk = hasHigherOpponentCard(card, opponents) ? 0 : 65;
  // A parità di condizioni la CPU libera prima le carte che possono intrappolarla.
  const suitHierarchy = isPelliccione(card)
    ? 1_000
    : card.suit === "bastoni" && [2, 3].includes(card.rank)
      ? 820
      : [1, 2, 3].includes(card.rank)
        ? 620
        : 0;
  return suitHierarchy + rankDanger * 4 + cardPoint(card) * 80 + futureTakeRisk;
}

function trickValueWith(game: GameState, card: GameCard) {
  return game.trick.reduce((sum, item) => sum + cardPoint(item.card), cardPoint(card));
}

function pelliccioneStillHidden(game: GameState) {
  return ![...game.trick, ...game.lastTrick]
    .some(({ card }) => isPelliccione(card))
    && game.players.some((player) => player.hand.some((card) => isPelliccione(card)));
}

function isPreferredTake(game: GameState, playerId: number, card: GameCard) {
  if (!game.leadSuit || !cardWinsCurrentTrick(game, playerId, card)) return false;
  const currentTakeValue = trickValueWith(game, card);
  const closesTrick = game.trick.length === game.playerCount - 1;
  const controlledBastoniTake = closesTrick
    && card.suit === "bastoni"
    && [2, 3].includes(card.rank)
    && pelliccioneStillHidden(game);

  // Una presa sotto il punto pieno non consegna un punto immediato: alleggerisce
  // la mano e conserva carte basse come vie di fuga nella parte finale.
  const dangerousBastoni = card.suit === "bastoni" && [2, 3].includes(card.rank);
  const lowCostTake = !dangerousBastoni && currentTakeValue < 1 && !game.trick.some(({ card: onTable }) => isPelliccione(onTable));
  return lowCostTake || controlledBastoniTake;
}

function isSafeParafalloOpening(card: GameCard, opponents: GameCard[]) {
  return !isPelliccione(card)
    && ![2, 3].includes(card.rank)
    && opponents.some((other) => other.suit === card.suit)
    && hasHigherOpponentCard(card, opponents);
}

function parafalloOpeningScore(game: GameState, playerId: number, card: GameCard) {
  const suitLength = game.players[playerId].hand.filter((candidate) => candidate.suit === card.suit).length;
  const shortSuitBonus = suitLength === 1 ? 140 : suitLength === 2 ? 55 : 0;
  return cpuTakeRisk(game, playerId, card) - shortSuitBonus;
}

/** Valore crescente: più alto significa maggiore rischio di aggiudicarsi punti indesiderati. */
export function cpuTakeRisk(game: GameState, playerId: number, card: GameCard) {
  const opponents = opponentsCards(game, playerId);
  const opponentsInSuit = opponents.filter((other) => other.suit === card.suit).length;
  const higherStillOut = hasHigherOpponentCard(card, opponents);
  const rankDanger = 10 - trickStrength(card);
  let risk = rankDanger * 5 + cardPoint(card) * 85;

  if (isPelliccione(card)) risk += 700;
  if (!game.leadSuit) {
    if ([2, 3].includes(card.rank)) risk += 160;
    if (!opponentsInSuit) risk += 240;
    if (!higherStillOut) risk += 130;
  } else if (card.suit === game.leadSuit && cardWinsCurrentTrick(game, playerId, card)) {
    risk += 220;
    if (!higherStillOut) risk += 170;
  }
  return risk;
}

function isAttemptingCappotto(game: GameState, playerId: number) {
  const self = game.players[playerId];
  const completedTricks = game.players.reduce((sum, player) => sum + player.tricks, 0);
  const remainingTricks = Math.max(...game.players.map((player) => player.hand.length));
  const estimatedTotal = completedTricks + remainingTricks;
  const lateEnough = completedTricks >= Math.max(3, Math.ceil(estimatedTotal * 0.65));
  return lateEnough && self.tricks === completedTricks && self.tricks > 0;
}

function isHigherThanAll(card: GameCard, rivals: GameCard[]) {
  return rivals.filter((rival) => rival.suit === card.suit).every((rival) => trickStrength(card) < trickStrength(rival));
}

/** Condizione sufficiente, volutamente prudente: ogni carta residua del dichiarante è superiore alle carte esterne del proprio seme. */
export function canCloseInHand(game: GameState, playerId: number) {
  if (game.phase !== "playing" || game.turn !== playerId) return false;
  const own = game.players[playerId]?.hand ?? [];
  if (!own.length) return false;
  const rivals = [
    ...game.players.filter((player) => player.id !== playerId).flatMap((player) => player.hand),
    ...game.trick.filter((item) => item.playerId !== playerId).map((item) => item.card),
  ];
  if (game.leadSuit) {
    const legal = legalCards(own, game.leadSuit);
    if (!legal.some((card) => card.suit === game.leadSuit && isHigherThanAll(card, rivals))) return false;
  }
  return own.every((card) => isHigherThanAll(card, rivals));
}

function shuffled<T>(items: T[]) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }
  return next;
}

function cloneGame(game: GameState): GameState {
  return {
    ...game,
    players: game.players.map((player) => ({ ...player, hand: [...player.hand] })),
    trick: [...game.trick],
    lastTrick: [...game.lastTrick],
    discarded: [...game.discarded],
    roundAwards: [...game.roundAwards],
    roundAbbuono: [...game.roundAbbuono],
    closedInHandBy: game.closedInHandBy ?? null,
  };
}

export function createGame(playerCount: number, scoreLimit: number, previousScores?: number[], roundIndex = 1): GameState {
  const deck = createDeck();
  if (playerCount < 3 || playerCount > deck.length) throw new Error("Il tavolo richiede da 3 a 40 partecipanti.");
  const declaredDiscarded = discardedFor(playerCount, deck);
  const excluded = new Set(declaredDiscarded.map((card) => card.id));
  const shuffledAvailable = shuffled(deck.filter((card) => !excluded.has(card.id)));
  const cardsEach = Math.floor(shuffledAvailable.length / playerCount);
  const available = shuffledAvailable.slice(0, cardsEach * playerCount);
  const discarded = [...declaredDiscarded, ...shuffledAvailable.slice(cardsEach * playerCount)];
  const players: PlayerState[] = Array.from({ length: playerCount }, (_, id) => ({
    id,
    name: CPU_NAMES[id] ?? `Giocatore ${id + 1}`,
    hand: sortHand(available.slice(id * cardsEach, (id + 1) * cardsEach)),
    score: previousScores?.[id] ?? 0,
    roundPointsRaw: 0,
    tricks: 0,
  }));
  // I posti aumentano in senso orario sul tavolo: per giocare in senso
  // antiorario il primo giocatore della smazzata successiva arretra di un posto.
  const leader = (playerCount - ((roundIndex - 1) % playerCount)) % playerCount;
  return {
    players,
    playerCount,
    scoreLimit,
    turn: leader,
    leader,
    leadSuit: null,
    trick: [],
    lastTrick: [],
    discarded,
    roundIndex,
    phase: "playing",
    roundAwards: Array(playerCount).fill(0),
    roundAbbuono: Array(playerCount).fill(0),
    closedInHandBy: null,
  };
}

/** Restituisce l’abbuono individuale, applicabile solo ai giocatori col punteggio minimo. */
export function abbuonoIndividuale(playerCount: number, tiedPlayers: number) {
  const table: Record<number, Record<number, number>> = {
    3: { 1: 2, 2: 1 },
    4: { 1: 4, 2: 2, 3: 1, 4: 1 },
    5: { 1: 4, 2: 2, 3: 1, 4: 1, 5: 1 },
    6: { 1: 6, 2: 3, 3: 2, 4: 1, 5: 1, 6: 1 },
    7: { 2: 3, 3: 2, 4: 1, 5: 1 },
    8: { 3: 3, 4: 2, 5: 1, 6: 1 },
  };
  return table[playerCount]?.[tiedPlayers] ?? 0;
}

export function nextDeal(game: GameState) {
  return createGame(
    game.playerCount,
    game.scoreLimit,
    game.players.map((player) => player.score),
    game.roundIndex + 1,
  );
}

export function playCard(game: GameState, playerId: number, cardId: string) {
  if (game.phase !== "playing" || game.turn !== playerId) return game;
  const next = cloneGame(game);
  const player = next.players[playerId];
  const card = player.hand.find((candidate) => candidate.id === cardId);
  if (!card || !legalCards(player.hand, next.leadSuit).some((candidate) => candidate.id === cardId)) return game;
  player.hand = player.hand.filter((candidate) => candidate.id !== cardId);
  if (!next.trick.length) next.leadSuit = card.suit;
  next.trick.push({ playerId, card });
  next.turn = (playerId - 1 + next.playerCount) % next.playerCount;
  if (next.trick.length === next.playerCount) next.phase = "resolving";
  return next;
}

export function chooseCpuCard(game: GameState, playerId: number) {
  const choices = legalCards(game.players[playerId].hand, game.leadSuit);
  if (!choices.length) return null;
  const opponents = opponentsCards(game, playerId);

  if (isAttemptingCappotto(game, playerId)) {
    return [...choices].sort((a, b) => cpuTakeRisk(game, playerId, b) - cpuTakeRisk(game, playerId, a) || a.id.localeCompare(b.id))[0];
  }

  const followsSuit = Boolean(game.leadSuit && choices.some((card) => card.suit === game.leadSuit));
  if (game.leadSuit && !followsSuit) {
    return [...choices].sort((a, b) => discardPriority(b, opponents) - discardPriority(a, opponents) || a.id.localeCompare(b.id))[0];
  }

  if (!game.leadSuit) {
    const parafalloChoices = choices.filter((card) => isSafeParafalloOpening(card, opponents));
    if (parafalloChoices.length) {
      return [...parafalloChoices].sort((a, b) => parafalloOpeningScore(game, playerId, a) - parafalloOpeningScore(game, playerId, b) || a.id.localeCompare(b.id))[0];
    }
  }

  if (game.leadSuit) {
    const preferredTakes = choices.filter((card) => isPreferredTake(game, playerId, card));
    if (preferredTakes.length) {
      return [...preferredTakes].sort((a, b) => trickValueWith(game, a) - trickValueWith(game, b) || cpuTakeRisk(game, playerId, a) - cpuTakeRisk(game, playerId, b) || a.id.localeCompare(b.id))[0];
    }
    const losingChoices = choices.filter((card) => !cardWinsCurrentTrick(game, playerId, card));
    if (losingChoices.length) {
      return [...losingChoices].sort((a, b) => cpuTakeRisk(game, playerId, b) - cpuTakeRisk(game, playerId, a) || a.id.localeCompare(b.id))[0];
    }
  }

  return [...choices].sort((a, b) => cpuTakeRisk(game, playerId, a) - cpuTakeRisk(game, playerId, b) || a.id.localeCompare(b.id))[0];
}

export function autoPlay(game: GameState, playerId: number) {
  const choice = chooseCpuCard(game, playerId);
  return choice ? playCard(game, playerId, choice.id) : game;
}

function finishRound(next: GameState, winnerId: number) {
  const awards = next.players.map((player, id) => (id === winnerId ? 0 : Math.floor(player.roundPointsRaw)));
  const lastAward = 16 - awards.reduce((sum, award) => sum + award, 0);
  if (lastAward === 16) {
    next.players.forEach((player, id) => {
      const award = id === winnerId ? -16 : 16;
      player.score += award;
      awards[id] = award;
    });
  } else {
    awards[winnerId] = lastAward;
    const lowest = Math.min(...awards);
    const lowestPlayers = awards
      .map((award, id) => (award === lowest ? id : -1))
      .filter((id) => id >= 0);
    const individualAbbuono = abbuonoIndividuale(next.playerCount, lowestPlayers.length);
    const roundAbbuono = Array(next.playerCount).fill(0);
    lowestPlayers.forEach((id) => {
      awards[id] -= individualAbbuono;
      roundAbbuono[id] = individualAbbuono;
    });
    next.roundAbbuono = roundAbbuono;
    next.players.forEach((player, id) => {
      player.score += awards[id];
    });
  }
  next.roundAwards = awards;
  next.phase = next.players.some((player) => player.score > next.scoreLimit) ? "matchEnd" : "roundEnd";
  return next;
}

export function closeInHand(game: GameState, playerId: number) {
  if (game.phase !== "playing" || game.turn !== playerId) return game;
  const next = cloneGame(game);
  const completedTricks = next.players.reduce((sum, player) => sum + player.tricks, 0);
  const remainingCards = [...next.trick.map((item) => item.card), ...next.players.flatMap((player) => player.hand)];
  const remainingTricks = remainingCards.length / next.playerCount;
  next.players[playerId].roundPointsRaw += remainingCards.reduce((sum, card) => sum + cardPoint(card), 0);
  next.players[playerId].tricks += remainingTricks;
  next.players.forEach((player) => { player.hand = []; });
  next.lastTrick = [...next.trick];
  next.trick = [];
  next.leadSuit = null;
  next.leader = playerId;
  next.turn = playerId;
  next.closedInHandBy = playerId;
  const opponentHasWholePoint = next.players.some((player, id) => id !== playerId && Math.floor(player.roundPointsRaw) >= 1);
  if (!opponentHasWholePoint) {
    const awards = next.players.map((_, id) => (id === playerId ? 16 : 0));
    next.roundAwards = awards;
    next.roundAbbuono = Array(next.playerCount).fill(0);
    next.players.forEach((player, id) => { player.score += awards[id]; });
    next.phase = next.players.some((player) => player.score > next.scoreLimit) ? "matchEnd" : "roundEnd";
    return next;
  }
  return finishRound(next, playerId);
}

export function resolveTrick(game: GameState) {
  if (game.phase !== "resolving" || !game.leadSuit) return game;
  const next = cloneGame(game);
  const leadSuit = next.leadSuit;
  if (!leadSuit) return game;
  const winnerId = trickWinner(next.trick, leadSuit);
  const value = next.trick.reduce((sum, item) => sum + cardPoint(item.card), 0);
  next.players[winnerId].roundPointsRaw += value;
  next.players[winnerId].tricks += 1;
  next.lastTrick = [...next.trick];
  next.trick = [];
  next.leader = winnerId;
  next.turn = winnerId;
  next.leadSuit = null;

  if (!next.players.every((player) => player.hand.length === 0)) {
    next.phase = "playing";
    return next;
  }
  return finishRound(next, winnerId);
}

export function matchRanking(game: GameState) {
  const ladder: Record<number, number[]> = {
    3: [10, 5, 0],
    4: [10, 6, 4, 0],
    5: [10, 7, 5, 3, 0],
    6: [10, 8, 6, 4, 2, 0],
    7: [10, 8, 6, 4, 4, 2, 0],
    8: [10, 8, 7, 6, 4, 3, 2, 0],
  };
  const fallbackPoints = game.players.map((_, index) => Math.max(0, 10 - index));
  return [...game.players]
    .sort((a, b) => a.score - b.score || a.id - b.id)
    .map((player, index) => ({ ...player, place: index + 1, leaguePoints: ladder[game.playerCount]?.[index] ?? fallbackPoints[index] }));
}

export function isLegalForHuman(game: GameState, card: GameCard) {
  return game.phase === "playing" && game.turn === 0 && legalCards(game.players[0].hand, game.leadSuit).some((item) => item.id === card.id);
}
