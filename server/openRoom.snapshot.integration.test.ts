import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ getDb: vi.fn() }));

import { getDb } from "./db";
import { gameMatches, gameRoomPlayers, gameRooms, users } from "../drizzle/schema";
import { closeOnlineInHand, nextOnlineDeal, playOnlineCard, snapshot } from "./matchmaking";
import { createGame } from "../client/src/game/engine";

describe("snapshot della sala aperta", () => {
  let room: any;
  let players: any[];

  beforeEach(() => {
    room = { id: "sala-aperta", matchId: null, ownerUserId: 1, visibility: "public", inviteCode: null, playerCount: 3, scoreLimit: 100, status: "waiting", gameState: null, turnDeadlineAt: null, version: 1, readyDeadlineAt: new Date(Date.now() + 180_000), createdAt: new Date(), updatedAt: new Date() };
    players = [1, 2, 3].map((userId, seat) => ({ id: seat + 1, roomId: room.id, userId, seat, ready: false, pauseUsed: false, pausedUntil: null, leftAt: null, lastSeenAt: new Date(), createdAt: new Date() }));
    const db = {
      select: () => ({
        from: (table: unknown) => ({
          where: () => {
            if (table === gameRooms) return { limit: async () => [room] };
            if (table === gameRoomPlayers) return { orderBy: async () => players };
            if (table === users) return Promise.resolve(players.map((player) => ({ id: player.userId, name: `Giocatore ${player.userId}` })));
            return Promise.resolve([]);
          },
        }),
      }),
      insert: (table: unknown) => ({ values: async () => table === gameMatches ? undefined : undefined }),
      update: (table: unknown) => ({ set: (values: Record<string, unknown>) => ({ where: async () => { if (table === gameRooms) Object.assign(room, values); if (table === gameRoomPlayers) players.forEach((player) => Object.assign(player, values)); } }) }),
    };
    vi.mocked(getDb).mockResolvedValue(db as never);
  });

  it("non parte prima della scadenza con tre giocatori non pronti, poi parte a tre minuti scaduti", async () => {
    const waiting = await snapshot(room.id, 1);
    expect(waiting.room.status).toBe("waiting");
    expect(waiting.game).toBeNull();
    room.readyDeadlineAt = new Date(Date.now() - 1);
    const started = await snapshot(room.id, 1);
    expect(started.room.status).toBe("playing");
    expect(started.game?.playerCount).toBe(3);
  });

  it("rimane in attesa con meno di tre partecipanti anche dopo la scadenza", async () => {
    players = players.slice(0, 2);
    players.forEach((player) => { player.ready = true; });
    room.readyDeadlineAt = new Date(Date.now() - 1);
    const waiting = await snapshot(room.id, 1);
    expect(waiting.room.status).toBe("waiting");
    expect(waiting.game).toBeNull();
  });

  it("parte subito quando tutti i presenti sono pronti", async () => {
    players.forEach((player) => { player.ready = true; });
    const started = await snapshot(room.id, 1);
    expect(started.room.status).toBe("playing");
    expect(started.game).not.toBeNull();
  });

  it("mantiene l'ultima carta visibile fino alla scadenza della presa", async () => {
    const game = createGame(3, 100);
    game.phase = "resolving";
    game.leadSuit = "denari";
    game.trick = [0, 2, 1].map((playerId) => ({ playerId, card: game.players[playerId].hand[0] }));
    room.status = "playing";
    room.gameState = JSON.stringify(game);
    room.turnDeadlineAt = new Date(Date.now() + 1_000);

    const visible = await snapshot(room.id, 1);
    expect(visible.game?.phase).toBe("resolving");
    expect(visible.game?.trick).toHaveLength(3);

    room.turnDeadlineAt = new Date(Date.now() - 1);
    const resolved = await snapshot(room.id, 1);
    expect(resolved.game?.phase).toBe("playing");
    expect(resolved.game?.lastTrick).toHaveLength(3);
  });

  it("ruota il primo giocatore della nuova smazzata in senso antiorario", async () => {
    const game = createGame(3, 100);
    game.phase = "roundEnd";
    room.status = "playing";
    room.gameState = JSON.stringify(game);

    const advanced = await nextOnlineDeal(room.id, 1);
    expect(advanced.game?.roundIndex).toBe(2);
    // In coordinate tavolo: 0 è in basso, 2 è alla sua destra (antiorario).
    expect(advanced.game?.leader).toBe(2);
    expect(advanced.game?.turn).toBe(2);
  });

  it.each([3, 4])("fa avanzare il turno online in senso antiorario con %i partecipanti", async (playerCount) => {
    players = Array.from({ length: playerCount }, (_, seat) => ({ id: seat + 1, roomId: room.id, userId: seat + 1, seat, ready: true, pauseUsed: false, pausedUntil: null, leftAt: null, lastSeenAt: new Date(), createdAt: new Date() }));
    const game = createGame(playerCount, 100);
    room.status = "playing";
    room.playerCount = playerCount;
    room.gameState = JSON.stringify(game);
    room.turnDeadlineAt = new Date(Date.now() + 30_000);

    const afterPlay = await playOnlineCard(room.id, 1, game.players[0].hand[0].id);
    // Il proprio posto è in basso; l'indice finale è alla sua destra, ossia antiorario.
    expect(afterPlay.game?.turn).toBe(playerCount - 1);
  });

  it("ruota tre smazzate online consecutive in senso antiorario", async () => {
    players = Array.from({ length: 4 }, (_, seat) => ({ id: seat + 1, roomId: room.id, userId: seat + 1, seat, ready: true, pauseUsed: false, pausedUntil: null, leftAt: null, lastSeenAt: new Date(), createdAt: new Date() }));
    room.status = "playing";
    room.playerCount = 4;
    room.gameState = JSON.stringify({ ...createGame(4, 100), phase: "roundEnd" });

    const first = await nextOnlineDeal(room.id, 1);
    const secondState = JSON.parse(room.gameState);
    room.gameState = JSON.stringify({ ...secondState, phase: "roundEnd" });
    const second = await nextOnlineDeal(room.id, 1);
    const thirdState = JSON.parse(room.gameState);
    room.gameState = JSON.stringify({ ...thirdState, phase: "roundEnd" });
    const third = await nextOnlineDeal(room.id, 1);

    expect(first.game?.leader).toBe(3);
    expect(second.game?.leader).toBe(2);
    expect(third.game?.leader).toBe(1);
  });

  it("chiude online in mano e assegna subito tutte le prese residue", async () => {
    const game = createGame(3, 100);
    game.turn = 1;
    game.leader = 1;
    game.players[0].hand = [{ id: "bastoni-4", suit: "bastoni", rank: 4 }, { id: "coppe-4", suit: "coppe", rank: 4 }];
    game.players[1].hand = [{ id: "bastoni-3", suit: "bastoni", rank: 3 }, { id: "coppe-3", suit: "coppe", rank: 3 }];
    game.players[2].hand = [{ id: "denari-4", suit: "denari", rank: 4 }, { id: "spade-4", suit: "spade", rank: 4 }];
    room.status = "playing";
    room.gameState = JSON.stringify(game);
    room.turnDeadlineAt = new Date(Date.now() + 30_000);

    const closed = await closeOnlineInHand(room.id, 2);
    expect(closed.game?.phase).toBe("roundEnd");
    expect(closed.game?.players.every((player) => player.hand.length === 0)).toBe(true);
  });

  it("consente online una chiusura in mano anche quando non è certa", async () => {
    const game = createGame(3, 100);
    game.turn = 1;
    game.leader = 1;
    game.players[0].hand = [{ id: "bastoni-3", suit: "bastoni", rank: 3 }];
    game.players[1].hand = [{ id: "bastoni-5", suit: "bastoni", rank: 5 }];
    game.players[2].hand = [{ id: "denari-4", suit: "denari", rank: 4 }];
    room.status = "playing";
    room.gameState = JSON.stringify(game);
    room.turnDeadlineAt = new Date(Date.now() + 30_000);

    const closed = await closeOnlineInHand(room.id, 2);
    expect(closed.game?.phase).toBe("roundEnd");
  });

  it("applica online il punteggio normale se la chiusura arriva dopo una presa", async () => {
    const game = createGame(3, 100);
    game.turn = 1;
    game.leader = 1;
    game.players[0].tricks = 1;
    game.players[0].roundPointsRaw = 1;
    game.players[0].hand = [{ id: "bastoni-3", suit: "bastoni", rank: 3 }];
    game.players[1].hand = [{ id: "bastoni-5", suit: "bastoni", rank: 5 }];
    game.players[2].hand = [{ id: "denari-4", suit: "denari", rank: 4 }];
    room.status = "playing";
    room.gameState = JSON.stringify(game);
    room.turnDeadlineAt = new Date(Date.now() + 30_000);

    const closed = await closeOnlineInHand(room.id, 2);
    expect(closed.game?.phase).toBe("roundEnd");
    expect(closed.game?.roundAwards).not.toContain(16);
  });
});
