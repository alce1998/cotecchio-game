import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ getDb: vi.fn() }));

import { getDb } from "./db";
import { gameMatchResults, gameMatches, gameRoomPlayers, gameRooms, users } from "../drizzle/schema";
import { leaveOnlineRoom, voteAfterDeparture } from "./matchmaking";
import { createGame } from "../client/src/game/engine";

describe("abbandono consensuale della sala", () => {
  let room: any;
  let players: any[];
  let deletedMatch = false;

  beforeEach(() => {
    const game = createGame(4, 100, [5, 7, 9, 11]);
    room = { id: "sala-ritiro", matchId: "match-ritiro", ownerUserId: 1, visibility: "public", inviteCode: null, playerCount: 4, scoreLimit: 100, status: "playing", gameState: JSON.stringify(game), turnDeadlineAt: new Date(Date.now() + 30_000), version: 1, readyDeadlineAt: null, departureUserId: null, departureVotes: null, departureOpenedAt: null, createdAt: new Date(), updatedAt: new Date() };
    players = [1, 2, 3, 4].map((userId, seat) => ({ id: seat + 1, roomId: room.id, userId, seat, ready: true, pauseUsed: false, pausedUntil: null, leftAt: null, lastSeenAt: new Date(), createdAt: new Date() }));
    deletedMatch = false;
    const db = {
      select: () => ({
        from: (table: unknown) => ({
          where: () => {
            if (table === gameRooms) return { limit: async () => [room] };
            if (table === gameRoomPlayers) return { orderBy: async () => players.filter((player) => !player.leftAt), limit: async () => players.filter((player) => player.userId === room.departureUserId) };
            if (table === users) {
              const roster = Promise.resolve(players.map((player) => ({ id: player.userId, name: `Giocatore ${player.userId}` })));
              return Object.assign(roster, { limit: async () => [{ name: "Giocatore 1" }] });
            }
            return { limit: async () => [] };
          },
        }),
      }),
      insert: () => ({ values: () => ({ onDuplicateKeyUpdate: async () => undefined }) }),
      update: (table: unknown) => ({ set: (values: Record<string, unknown>) => ({ where: async () => {
        if (table === gameRooms) Object.assign(room, values);
        if (table === gameRoomPlayers) {
          if ("leftAt" in values) players[0].leftAt = values.leftAt;
          else if ("seat" in values) players.filter((player) => !player.leftAt).forEach((player, index) => Object.assign(player, values, { seat: index }));
        }
      } }) }),
      delete: (table: unknown) => ({ where: async () => { if (table === gameMatches) deletedMatch = true; } }),
    };
    vi.mocked(getDb).mockResolvedValue(db as never);
  });

  it("annulla la smazzata e riparte senza l'uscente, mantenendo i punteggi consolidati", async () => {
    const left = await leaveOnlineRoom(room.id, 1);
    expect(left.status).toBe("pending");
    expect(room.departureUserId).toBe(1);

    const resumed = await voteAfterDeparture(room.id, 2, "continue");
    expect(resumed.status).toBe("continued");
    const nextGame = JSON.parse(room.gameState);
    expect(nextGame.playerCount).toBe(3);
    expect(nextGame.players.map((player: { score: number }) => player.score)).toEqual([7, 9, 11]);
  });

  it("cancella il match senza storico quando tutti i rimanenti votano di concludere", async () => {
    await leaveOnlineRoom(room.id, 1);
    await voteAfterDeparture(room.id, 2, "end");
    await voteAfterDeparture(room.id, 3, "end");
    const result = await voteAfterDeparture(room.id, 4, "end");
    expect(result.status).toBe("cancelled");
    expect(room.status).toBe("cancelled");
    expect(deletedMatch).toBe(true);
  });
});
