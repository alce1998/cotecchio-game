import { and, asc, eq, gt, inArray, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { gameMatchResults, gameMatches, gameRoomMediaStates, gameRoomMessages, gameRoomPlayers, gameRoomWebrtcSignals, gameRooms, users } from "../drizzle/schema";
import { autoPlay, closeInHand, createGame, matchRanking, nextDeal, playCard, resolveTrick } from "../client/src/game/engine";
import type { GameState, PlayedCard } from "../client/src/game/types";
import { getDb } from "./db";

const TURN_MS = 30_000;
const TRICK_REVEAL_MS = 2_000;
const READY_WAIT_MS = 180_000;
const HEARTBEAT_TIMEOUT_MS = 45_000;
export const ONLINE_SCORE_LIMIT = 100;

type RoomRow = typeof gameRooms.$inferSelect;
type PlayerRow = typeof gameRoomPlayers.$inferSelect;
type DepartureVote = "continue" | "end";
type DepartureVotes = Record<string, DepartureVote>;

export function canContinueAfterDeparture(activePlayerCount: number) {
  return activePlayerCount >= 3;
}

export function shouldStartOnlineRoom(activePlayerCount: number, everyoneReady: boolean, deadlineElapsed: boolean) {
  return activePlayerCount >= 3 && (everyoneReady || deadlineElapsed);
}

export function departureDecision(remainingUserIds: number[], votes: DepartureVotes) {
  if (remainingUserIds.length < 3) return "end" as const;
  if (remainingUserIds.some((userId) => votes[String(userId)] === "continue")) return "continue" as const;
  if (remainingUserIds.length > 0 && remainingUserIds.every((userId) => votes[String(userId)] === "end")) return "end" as const;
  return "pending" as const;
}

async function database() {
  const db = await getDb();
  if (!db) throw new Error("Il servizio di partita non è disponibile.");
  return db;
}

async function roomById(roomId: string) {
  const db = await database();
  const [room] = await db.select().from(gameRooms).where(eq(gameRooms.id, roomId)).limit(1);
  if (!room) throw new Error("Sala non trovata.");
  return room;
}

async function activePlayers(roomId: string) {
  const db = await database();
  return db.select().from(gameRoomPlayers).where(and(eq(gameRoomPlayers.roomId, roomId), isNull(gameRoomPlayers.leftAt))).orderBy(asc(gameRoomPlayers.seat));
}

function decodeState(room: RoomRow) {
  if (!room.gameState) throw new Error("La partita non è ancora iniziata.");
  return JSON.parse(room.gameState) as GameState;
}

function decodeDepartureVotes(room: RoomRow): DepartureVotes {
  if (!room.departureVotes) return {};
  try { return JSON.parse(room.departureVotes) as DepartureVotes; } catch { return {}; }
}

export function withDisplayOrder(game: GameState, ownSeat: number, namesBySeat?: Map<number, string>): GameState {
  // Per ogni partecipante il proprio posto è in basso. I posti crescenti sono
  // visualizzati in senso orario, così quello antiorario resta alla sua destra.
  const seats = Array.from({ length: game.players.length }, (_, displaySeat) => (ownSeat + displaySeat) % game.players.length);
  const mapped = new Map(seats.map((seat, displaySeat) => [seat, displaySeat]));
  const mapPlayed = ({ playerId, card }: PlayedCard) => ({ playerId: mapped.get(playerId) ?? playerId, card });
  return {
    ...game,
    players: seats.map((seat, displaySeat) => {
      const player = game.players[seat];
      return {
        ...player,
        id: displaySeat,
        name: namesBySeat?.get(seat) ?? player.name,
        hand: seat === ownSeat ? player.hand : player.hand.map((_, index) => ({ id: `coperta-${seat}-${index}`, suit: "denari", rank: 4 as const })),
      };
    }),
    turn: mapped.get(game.turn) ?? game.turn,
    leader: mapped.get(game.leader) ?? game.leader,
    trick: game.trick.map(mapPlayed),
    lastTrick: game.lastTrick.map(mapPlayed),
    roundAwards: seats.map((seat) => game.roundAwards[seat]),
    roundAbbuono: seats.map((seat) => game.roundAbbuono[seat]),
  };
}

async function displayedPlayers(rows: PlayerRow[]) {
  const db = await database();
  if (!rows.length) return [];
  const records = await db.select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, rows.map((row) => row.userId)));
  const profile = new Map(records.map((user) => [user.id, { name: user.name?.trim() || "Giocatore", avatarUrl: user.avatarUrl }]));
  return rows.map((row) => ({ seat: row.seat, name: profile.get(row.userId)?.name ?? "Giocatore", avatarUrl: profile.get(row.userId)?.avatarUrl ?? null, ready: row.ready, userId: row.userId, pausedUntil: row.pausedUntil }));
}

async function recordForfeit(room: RoomRow, player: PlayerRow) {
  if (!room.matchId || !room.gameState) return;
  const game = decodeState(room);
  const worstScore = Math.max(room.scoreLimit + 16, ...game.players.map((entry) => entry.score));
  const db = await database();
  await db.insert(gameMatchResults).values({ matchId: room.matchId, userId: player.userId, placement: game.players.length, finalScore: worstScore, leaguePoints: 0 }).onDuplicateKeyUpdate({ set: { placement: game.players.length, finalScore: worstScore, leaguePoints: 0 } });
}

async function recordDepartureZero(room: RoomRow, player: PlayerRow) {
  if (!room.matchId) return;
  const db = await database();
  await db.insert(gameMatchResults).values({ matchId: room.matchId, userId: player.userId, placement: 0, finalScore: 0, leaguePoints: 0 }).onDuplicateKeyUpdate({ set: { placement: 0, finalScore: 0, leaguePoints: 0 } });
}

async function cancelUnrecordedMatch(room: RoomRow) {
  const db = await database();
  if (room.matchId) {
    await db.delete(gameMatchResults).where(eq(gameMatchResults.matchId, room.matchId));
    await db.delete(gameMatches).where(eq(gameMatches.id, room.matchId));
  }
  await db.update(gameRooms).set({ status: "cancelled", matchId: null, gameState: null, turnDeadlineAt: null, departureUserId: null, departureVotes: null, departureOpenedAt: null, version: room.version + 1 }).where(eq(gameRooms.id, room.id));
  return roomById(room.id);
}

async function restartAfterConsentedDeparture(room: RoomRow, remaining: PlayerRow[]) {
  const db = await database();
  const previous = decodeState(room);
  const oldScores = remaining.map((player) => previous.players[player.seat]?.score ?? 0);
  for (let seat = 0; seat < remaining.length; seat += 1) await db.update(gameRoomPlayers).set({ seat, ready: true, pausedUntil: null }).where(eq(gameRoomPlayers.id, remaining[seat].id));
  const roster = await displayedPlayers(remaining.map((player, seat) => ({ ...player, seat })));
  const resumed = createGame(remaining.length, room.scoreLimit, oldScores, previous.roundIndex + 1);
  resumed.players = resumed.players.map((player, seat) => ({ ...player, name: roster[seat]?.name ?? `Giocatore ${seat + 1}` }));
  await db.update(gameRooms).set({ playerCount: remaining.length, gameState: JSON.stringify(resumed), turnDeadlineAt: new Date(Date.now() + TURN_MS), departureUserId: null, departureVotes: null, departureOpenedAt: null, version: room.version + 1 }).where(eq(gameRooms.id, room.id));
  return roomById(room.id);
}

async function continueAfterDeparture(room: RoomRow, remaining: PlayerRow[]) {
  const db = await database();
  if (!canContinueAfterDeparture(remaining.length)) {
    if (room.matchId) await db.update(gameMatches).set({ status: "abandoned", finalState: room.gameState, finishedAt: new Date() }).where(eq(gameMatches.id, room.matchId));
    await db.update(gameRooms).set({ status: "cancelled", turnDeadlineAt: null, version: room.version + 1 }).where(eq(gameRooms.id, room.id));
    return roomById(room.id);
  }
  const previous = decodeState(room);
  const oldScores = remaining.map((player) => previous.players[player.seat]?.score ?? 0);
  for (let seat = 0; seat < remaining.length; seat += 1) await db.update(gameRoomPlayers).set({ seat, ready: true, pausedUntil: null }).where(eq(gameRoomPlayers.id, remaining[seat].id));
  const roster = await displayedPlayers(remaining.map((player, seat) => ({ ...player, seat })));
  const resumed = createGame(remaining.length, room.scoreLimit, oldScores, previous.roundIndex + 1);
  resumed.players = resumed.players.map((player, seat) => ({ ...player, name: roster[seat]?.name ?? `Giocatore ${seat + 1}` }));
  await db.update(gameRooms).set({ playerCount: remaining.length, gameState: JSON.stringify(resumed), turnDeadlineAt: new Date(Date.now() + TURN_MS), version: room.version + 1 }).where(eq(gameRooms.id, room.id));
  return roomById(room.id);
}

async function reconcilePresence(room: RoomRow) {
  if (room.departureUserId) return room;
  const db = await database();
  const rows = await activePlayers(room.id);
  const stale = rows.filter((player) => Date.now() - player.lastSeenAt.getTime() > HEARTBEAT_TIMEOUT_MS);
  if (!stale.length) return room;
  for (const player of stale) {
    await recordForfeit(room, player);
    await db.update(gameRoomPlayers).set({ leftAt: new Date() }).where(eq(gameRoomPlayers.id, player.id));
  }
  const remaining = await activePlayers(room.id);
  if (room.status !== "playing") {
    if (!remaining.length) await db.update(gameRooms).set({ status: "cancelled", version: room.version + 1 }).where(eq(gameRooms.id, room.id));
    return roomById(room.id);
  }
  return continueAfterDeparture(room, remaining);
}

async function startIfReady(room: RoomRow, rows: PlayerRow[]) {
  const deadlineElapsed = Boolean(room.readyDeadlineAt && room.readyDeadlineAt.getTime() <= Date.now());
  if (room.status !== "waiting" || !shouldStartOnlineRoom(rows.length, rows.every((row) => row.ready), deadlineElapsed)) return room;
  const roster = await displayedPlayers(rows);
  const game = createGame(rows.length, room.scoreLimit);
  game.players = game.players.map((player, seat) => ({ ...player, name: roster.find((entry) => entry.seat === seat)?.name ?? `Giocatore ${seat + 1}` }));
  const now = new Date();
  const matchId = nanoid(12);
  const db = await database();
  await db.insert(gameMatches).values({ id: matchId, roomId: room.id, playerCount: rows.length, scoreLimit: room.scoreLimit });
  await db.update(gameRooms).set({ matchId, playerCount: rows.length, status: "playing", gameState: JSON.stringify(game), turnDeadlineAt: new Date(now.getTime() + TURN_MS), version: room.version + 1 }).where(eq(gameRooms.id, room.id));
  return roomById(room.id);
}

async function persistFinishedMatch(room: RoomRow, game: GameState) {
  if (game.phase !== "matchEnd" || room.status === "finished" || !room.matchId) return room;
  const db = await database();
  const rows = await activePlayers(room.id);
  const ranking = matchRanking(game);
  for (const result of ranking) {
    const player = rows.find((row) => row.seat === result.id);
    if (!player) continue;
    await db.insert(gameMatchResults).values({ matchId: room.matchId, userId: player.userId, placement: result.place, finalScore: result.score, leaguePoints: result.leaguePoints }).onDuplicateKeyUpdate({ set: { placement: result.place, finalScore: result.score, leaguePoints: result.leaguePoints } });
  }
  await db.update(gameMatches).set({ status: "finished", finalState: JSON.stringify(game), finishedAt: new Date() }).where(eq(gameMatches.id, room.matchId));
  await db.update(gameRooms).set({ status: "finished", gameState: JSON.stringify(game), turnDeadlineAt: null, version: room.version + 1 }).where(eq(gameRooms.id, room.id));
  return roomById(room.id);
}

async function advanceExpiredTurn(room: RoomRow) {
  if (room.status !== "playing" || room.departureUserId || !room.turnDeadlineAt || room.turnDeadlineAt.getTime() > Date.now()) return room;
  const pending = decodeState(room);
  const active = await activePlayers(room.id);
  const currentPlayer = active.find((player) => player.seat === pending.turn);
  if (currentPlayer?.pausedUntil && currentPlayer.pausedUntil.getTime() <= Date.now()) {
    const db = await database();
    await db.update(gameRoomPlayers).set({ pausedUntil: null }).where(eq(gameRoomPlayers.id, currentPlayer.id));
    await db.update(gameRooms).set({ turnDeadlineAt: new Date(Date.now() + TURN_MS), version: room.version + 1 }).where(eq(gameRooms.id, room.id));
    return roomById(room.id);
  }
  let game = decodeState(room);
  if (game.phase === "resolving") {
    // L'ultima carta resta sul tavolo per due secondi prima di assegnare la presa.
    game = resolveTrick(game);
  } else {
    game = autoPlay(game, game.turn);
  }
  const deadline = game.phase === "resolving"
    ? new Date(Date.now() + TRICK_REVEAL_MS)
    : game.phase === "playing"
      ? new Date(Date.now() + TURN_MS)
      : null;
  const db = await database();
  await db.update(gameRooms).set({ gameState: JSON.stringify(game), turnDeadlineAt: deadline, version: room.version + 1 }).where(eq(gameRooms.id, room.id));
  return persistFinishedMatch(await roomById(room.id), game);
}

async function membership(roomId: string, userId: number) {
  const rows = await activePlayers(roomId);
  const player = rows.find((row) => row.userId === userId);
  if (!player) throw new Error("Non fai parte di questa sala.");
  return { rows, player };
}

export async function joinMatchmaking(userId: number, _requestedScoreLimit: number) {
  const scoreLimit = ONLINE_SCORE_LIMIT;
  const db = await database();
  const candidates = await db.select().from(gameRooms).where(and(eq(gameRooms.status, "waiting"), eq(gameRooms.visibility, "public"), eq(gameRooms.scoreLimit, scoreLimit))).orderBy(asc(gameRooms.createdAt));
  for (const candidate of candidates) {
    const rows = await activePlayers(candidate.id);
    if (rows.some((row) => row.userId === userId)) return snapshot(candidate.id, userId);
    await db.insert(gameRoomPlayers).values({ roomId: candidate.id, userId, seat: rows.length });
    return snapshot(candidate.id, userId);
  }
  const id = nanoid(12);
  await db.insert(gameRooms).values({ id, ownerUserId: userId, visibility: "public", playerCount: 3, scoreLimit, readyDeadlineAt: new Date(Date.now() + READY_WAIT_MS) });
  await db.insert(gameRoomPlayers).values({ roomId: id, userId, seat: 0 });
  return snapshot(id, userId);
}

export function normalizedInviteCode(code: string) {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

export function isPublicMatchmakingRoom(visibility: "public" | "private", status: string) {
  return visibility === "public" && status === "waiting";
}

export function privateJoinValidation(room: { visibility: "public" | "private"; status: string; activePlayers: number } | null, code: string) {
  if (normalizedInviteCode(code).length < 6) return "invalid-code" as const;
  if (!room || room.visibility !== "private" || room.status !== "waiting") return "unavailable" as const;
  return "accepted" as const;
}

async function nextInviteCode() {
  const db = await database();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = `COTE${nanoid(7).toUpperCase().replace(/[^A-Z0-9]/g, "A")}`;
    const existing = await db.select({ id: gameRooms.id }).from(gameRooms).where(eq(gameRooms.inviteCode, code)).limit(1);
    if (!existing.length) return code;
  }
  throw new Error("Non riesco a generare un codice univoco. Riprova.");
}

export async function createPrivateRoom(userId: number, _requestedScoreLimit: number) {
  const scoreLimit = ONLINE_SCORE_LIMIT;
  const db = await database();
  const id = nanoid(12);
  const inviteCode = await nextInviteCode();
  await db.insert(gameRooms).values({ id, ownerUserId: userId, visibility: "private", inviteCode, playerCount: 3, scoreLimit, readyDeadlineAt: new Date(Date.now() + READY_WAIT_MS) });
  await db.insert(gameRoomPlayers).values({ roomId: id, userId, seat: 0 });
  return snapshot(id, userId);
}

export async function joinPrivateByCode(userId: number, rawCode: string) {
  const code = normalizedInviteCode(rawCode);
  if (privateJoinValidation(null, code) === "invalid-code") throw new Error("Inserisci un codice sala valido.");
  const db = await database();
  const [room] = await db.select().from(gameRooms).where(and(eq(gameRooms.inviteCode, code), eq(gameRooms.visibility, "private"), eq(gameRooms.status, "waiting"))).limit(1);
  if (!room) throw new Error("Codice non valido o sala non più disponibile.");
  const rows = await activePlayers(room.id);
  const validation = privateJoinValidation({ visibility: room.visibility, status: room.status, activePlayers: rows.length }, code);
  if (validation !== "accepted") throw new Error("Codice non valido o sala non più disponibile.");
  if (rows.some((row) => row.userId === userId)) return snapshot(room.id, userId);
  await db.insert(gameRoomPlayers).values({ roomId: room.id, userId, seat: rows.length });
  return snapshot(room.id, userId);
}

export async function snapshot(roomId: string, userId: number) {
  const db = await database();
  await db.update(gameRoomPlayers).set({ lastSeenAt: new Date() }).where(and(eq(gameRoomPlayers.roomId, roomId), eq(gameRoomPlayers.userId, userId), isNull(gameRoomPlayers.leftAt)));
  let room = await reconcilePresence(await roomById(roomId));
  const { rows, player } = await membership(roomId, userId);
  await db.update(gameRoomPlayers).set({ lastSeenAt: new Date() }).where(eq(gameRoomPlayers.id, player.id));
  room = await startIfReady(room, rows);
  room = await advanceExpiredTurn(room);
  const updatedRows = await activePlayers(roomId);
  const roster = await displayedPlayers(updatedRows);
  const viewer = updatedRows.find((row) => row.userId === userId);
  const departureVotes = decodeDepartureVotes(room);
  const departingUser = room.departureUserId ? (await db.select({ name: users.name }).from(users).where(eq(users.id, room.departureUserId)).limit(1))[0] : null;
  return {
    room: { id: room.id, playerCount: room.playerCount, activePlayerCount: updatedRows.length, scoreLimit: room.scoreLimit, status: room.status, visibility: room.visibility, inviteCode: room.inviteCode, version: room.version, turnDeadlineAt: room.turnDeadlineAt, readyDeadlineAt: room.readyDeadlineAt },
    players: roster,
    game: room.gameState && viewer ? withDisplayOrder(decodeState(room), viewer.seat, new Map(roster.map((entry) => [entry.seat, entry.name]))) : null,
    departure: room.departureUserId ? { userId: room.departureUserId, playerName: departingUser?.name?.trim() || "Un giocatore", votes: departureVotes, canContinue: canContinueAfterDeparture(updatedRows.length) } : null,
  };
}

export async function setReady(roomId: string, userId: number) {
  const { player } = await membership(roomId, userId);
  const db = await database();
  await db.update(gameRoomPlayers).set({ ready: true, lastSeenAt: new Date() }).where(eq(gameRoomPlayers.id, player.id));
  return snapshot(roomId, userId);
}

export async function playOnlineCard(roomId: string, userId: number, cardId: string) {
  let room = await advanceExpiredTurn(await roomById(roomId));
  const { player } = await membership(roomId, userId);
  if (room.status !== "playing") throw new Error("La partita non è ancora al tavolo.");
  if (room.departureUserId) throw new Error("La partita è in attesa della decisione dopo un abbandono.");
  let game = decodeState(room);
  if (game.turn !== player.seat) throw new Error("Non è il tuo turno.");
  game = playCard(game, player.seat, cardId);
  // Non risolvere immediatamente: tutti devono vedere l'ultima carta giocata.
  const deadline = game.phase === "resolving"
    ? new Date(Date.now() + TRICK_REVEAL_MS)
    : game.phase === "playing"
      ? new Date(Date.now() + TURN_MS)
      : null;
  const db = await database();
  await db.update(gameRooms).set({ gameState: JSON.stringify(game), turnDeadlineAt: deadline, version: room.version + 1 }).where(eq(gameRooms.id, roomId));
  await persistFinishedMatch(await roomById(roomId), game);
  return snapshot(roomId, userId);
}

export async function closeOnlineInHand(roomId: string, userId: number) {
  const room = await advanceExpiredTurn(await roomById(roomId));
  const { player } = await membership(roomId, userId);
  if (room.status !== "playing") throw new Error("La partita non è ancora al tavolo.");
  if (room.departureUserId) throw new Error("La partita è in attesa della decisione dopo un abbandono.");
  const game = decodeState(room);
  if (game.turn !== player.seat) throw new Error("Puoi chiudere in mano solo nel tuo turno.");
  const closed = closeInHand(game, player.seat);
  if (closed === game) throw new Error("Puoi dichiarare chiuso in mano solo nel tuo turno.");
  const db = await database();
  await db.update(gameRooms).set({ gameState: JSON.stringify(closed), turnDeadlineAt: null, version: room.version + 1 }).where(eq(gameRooms.id, roomId));
  await persistFinishedMatch(await roomById(roomId), closed);
  return snapshot(roomId, userId);
}

export async function useOnlinePause(roomId: string, userId: number) {
  const room = await roomById(roomId);
  const { player } = await membership(roomId, userId);
  if (room.status !== "playing" || player.pauseUsed) throw new Error("La pausa non è disponibile.");
  if (room.departureUserId) throw new Error("La partita è in attesa della decisione dopo un abbandono.");
  const game = decodeState(room);
  if (game.turn !== player.seat) throw new Error("La pausa è disponibile solo nel proprio turno.");
  const pausedUntil = new Date(Date.now() + 60_000);
  const db = await database();
  await db.update(gameRoomPlayers).set({ pauseUsed: true, pausedUntil }).where(eq(gameRoomPlayers.id, player.id));
  await db.update(gameRooms).set({ turnDeadlineAt: pausedUntil, version: room.version + 1 }).where(eq(gameRooms.id, roomId));
  return snapshot(roomId, userId);
}

export async function resumeOnlinePause(roomId: string, userId: number) {
  const room = await roomById(roomId);
  const { player } = await membership(roomId, userId);
  if (room.status !== "playing" || !player.pausedUntil) throw new Error("Nessuna pausa attiva.");
  const game = decodeState(room);
  if (game.turn !== player.seat) throw new Error("La pausa non appartiene al turno corrente.");
  const db = await database();
  await db.update(gameRoomPlayers).set({ pausedUntil: null }).where(eq(gameRoomPlayers.id, player.id));
  await db.update(gameRooms).set({ turnDeadlineAt: new Date(Date.now() + TURN_MS), version: room.version + 1 }).where(eq(gameRooms.id, roomId));
  return snapshot(roomId, userId);
}

export async function leaveOnlineRoom(roomId: string, userId: number) {
  const room = await roomById(roomId);
  const { player } = await membership(roomId, userId);
  const db = await database();
  await db.update(gameRoomPlayers).set({ leftAt: new Date() }).where(eq(gameRoomPlayers.id, player.id));
  const remaining = await activePlayers(roomId);
  if (room.status === "waiting") {
    if (!remaining.length) await db.update(gameRooms).set({ status: "cancelled", version: room.version + 1 }).where(eq(gameRooms.id, roomId));
    return { success: true, status: "waiting" as const };
  }
  if (room.departureUserId) {
    if (!canContinueAfterDeparture(remaining.length)) {
      await cancelUnrecordedMatch(room);
      return { success: true, status: "cancelled" as const };
    }
    return { success: true, status: "pending" as const };
  }
  if (!canContinueAfterDeparture(remaining.length)) {
    await cancelUnrecordedMatch(room);
    return { success: true, status: "cancelled" as const };
  }
  await db.update(gameRooms).set({ departureUserId: userId, departureVotes: JSON.stringify({}), departureOpenedAt: new Date(), turnDeadlineAt: null, version: room.version + 1 }).where(eq(gameRooms.id, room.id));
  return { success: true, status: "pending" as const };
}

export async function voteAfterDeparture(roomId: string, userId: number, vote: DepartureVote) {
  const room = await roomById(roomId);
  const { rows } = await membership(roomId, userId);
  if (!room.departureUserId) throw new Error("Nessun abbandono in attesa di decisione.");
  const votes = { ...decodeDepartureVotes(room), [String(userId)]: vote };
  const decision = departureDecision(rows.map((player) => player.userId), votes);
  const db = await database();
  await db.update(gameRooms).set({ departureVotes: JSON.stringify(votes), version: room.version + 1 }).where(eq(gameRooms.id, room.id));
  if (decision === "end") {
    await cancelUnrecordedMatch(await roomById(roomId));
    return { status: "cancelled" as const };
  }
  if (decision === "continue") {
    const departed = await db.select().from(gameRoomPlayers).where(and(eq(gameRoomPlayers.roomId, roomId), eq(gameRoomPlayers.userId, room.departureUserId))).limit(1);
    if (departed[0]) await recordDepartureZero(room, departed[0]);
    await restartAfterConsentedDeparture(await roomById(roomId), rows);
    return { status: "continued" as const };
  }
  return { status: "pending" as const };
}

export async function nextOnlineDeal(roomId: string, userId: number) {
  const room = await roomById(roomId);
  await membership(roomId, userId);
  const game = decodeState(room);
  if (game.phase !== "roundEnd") throw new Error("La smazzata non è conclusa.");
  const next = nextDeal(game);
  const db = await database();
  await db.update(gameRooms).set({ gameState: JSON.stringify(next), turnDeadlineAt: new Date(Date.now() + TURN_MS), version: room.version + 1 }).where(eq(gameRooms.id, roomId));
  return snapshot(roomId, userId);
}

export async function roomChat(roomId: string, userId: number) {
  await membership(roomId, userId);
  const db = await database();
  const messages = await db.select().from(gameRoomMessages).where(eq(gameRoomMessages.roomId, roomId)).orderBy(asc(gameRoomMessages.id)).limit(80);
  if (!messages.length) return [];
  const authors = await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, messages.map((message) => message.userId)));
  const names = new Map(authors.map((author) => [author.id, author.name?.trim() || "Giocatore"]));
  return messages.map((message) => ({ id: message.id, body: message.body, userId: message.userId, author: names.get(message.userId) ?? "Giocatore", createdAt: message.createdAt }));
}

export function normalizedRoomMessage(rawBody: string) {
  return rawBody.trim().replace(/\s+/g, " ");
}

export async function postRoomChat(roomId: string, userId: number, rawBody: string) {
  await membership(roomId, userId);
  const body = normalizedRoomMessage(rawBody);
  if (!body) throw new Error("Scrivi un messaggio prima di inviare.");
  if (body.length > 600) throw new Error("Il messaggio supera i 600 caratteri.");
  const db = await database();
  await db.insert(gameRoomMessages).values({ roomId, userId, body });
  return roomChat(roomId, userId);
}

export async function roomMediaStates(roomId: string, userId: number) {
  const { rows } = await membership(roomId, userId);
  const db = await database();
  const states = await db.select().from(gameRoomMediaStates).where(eq(gameRoomMediaStates.roomId, roomId));
  const byUser = new Map(states.map((state) => [state.userId, state]));
  return rows.map((player) => ({ userId: player.userId, audioEnabled: byUser.get(player.userId)?.audioEnabled ?? false, videoEnabled: byUser.get(player.userId)?.videoEnabled ?? false }));
}

export async function setRoomMediaState(roomId: string, userId: number, audioEnabled: boolean, videoEnabled: boolean) {
  await membership(roomId, userId);
  const db = await database();
  await db.insert(gameRoomMediaStates).values({ roomId, userId, audioEnabled, videoEnabled }).onDuplicateKeyUpdate({ set: { audioEnabled, videoEnabled } });
  return roomMediaStates(roomId, userId);
}

export async function sendWebrtcSignal(roomId: string, userId: number, toUserId: number, kind: "offer" | "answer" | "candidate", payload: string) {
  const { rows } = await membership(roomId, userId);
  if (!rows.some((player) => player.userId === toUserId)) throw new Error("Il destinatario non è più al tavolo.");
  if (payload.length > 20_000) throw new Error("Segnale media non valido.");
  const db = await database();
  await db.insert(gameRoomWebrtcSignals).values({ roomId, fromUserId: userId, toUserId, kind, payload });
  return { success: true } as const;
}

export async function webRtcSignals(roomId: string, userId: number, afterId = 0) {
  await membership(roomId, userId);
  const db = await database();
  return db.select().from(gameRoomWebrtcSignals).where(and(eq(gameRoomWebrtcSignals.roomId, roomId), eq(gameRoomWebrtcSignals.toUserId, userId), gt(gameRoomWebrtcSignals.id, afterId))).orderBy(asc(gameRoomWebrtcSignals.id)).limit(100);
}

export async function setProfileAvatar(userId: number, rawUrl: string) {
  const avatarUrl = rawUrl.trim();
  if (avatarUrl) {
    let parsed: URL;
    try { parsed = new URL(avatarUrl, "https://cotecchio.invalid"); } catch { throw new Error("Inserisci un indirizzo immagine valido."); }
    if (parsed.protocol !== "https:" && !avatarUrl.startsWith("/manus-storage/")) throw new Error("La foto profilo deve usare HTTPS.");
  }
  const db = await database();
  await db.update(users).set({ avatarUrl: avatarUrl || null }).where(eq(users.id, userId));
  return { avatarUrl: avatarUrl || null };
}
