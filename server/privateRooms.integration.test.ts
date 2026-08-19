import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ getDb: vi.fn() }));

import { getDb } from "./db";
import { gameRoomPlayers, gameRooms, users } from "../drizzle/schema";
import { createPrivateRoom, joinPrivateByCode } from "./matchmaking";

type Room = { id: string; ownerUserId: number; visibility: "private"; inviteCode: string; playerCount: number; scoreLimit: number; status: "waiting"; gameState: null; turnDeadlineAt: null; version: number; readyDeadlineAt: Date; createdAt: Date; updatedAt: Date; matchId: null };
type RoomPlayer = { id: number; roomId: string; userId: number; seat: number; ready: boolean; pauseUsed: boolean; pausedUntil: null; leftAt: null; lastSeenAt: Date; createdAt: Date };

describe("integrazione sale private", () => {
  let rooms: Room[];
  let players: RoomPlayer[];
  let roomSelects: number;

  beforeEach(() => {
    rooms = [];
    players = [];
    roomSelects = 0;
    const db = {
      select: () => ({
        from: (table: unknown) => ({
          where: () => {
            if (table === gameRooms) {
              roomSelects += 1;
              return { limit: async () => roomSelects === 1 ? [] : rooms };
            }
            if (table === gameRoomPlayers) return { orderBy: async () => players };
            if (table === users) return Promise.resolve(players.map((player) => ({ id: player.userId, name: `Giocatore ${player.userId}` })));
            return Promise.resolve([]);
          },
        }),
      }),
      insert: (table: unknown) => ({
        values: async (value: Record<string, unknown>) => {
          if (table === gameRooms) rooms.push({ ...value, status: "waiting", gameState: null, turnDeadlineAt: null, version: 1, createdAt: new Date(), updatedAt: new Date(), matchId: null } as Room);
          if (table === gameRoomPlayers) players.push({ ...value, id: players.length + 1, ready: false, pauseUsed: false, pausedUntil: null, leftAt: null, lastSeenAt: new Date(), createdAt: new Date() } as RoomPlayer);
        },
      }),
      update: () => ({ set: () => ({ where: async () => undefined }) }),
    };
    vi.mocked(getDb).mockResolvedValue(db as never);
  });

  it("crea una sala privata aperta, accetta il codice e non impone una capienza", async () => {
    const created = await createPrivateRoom(1, 100);
    expect(created.room.visibility).toBe("private");
    expect(created.room.inviteCode).toMatch(/^COTE[A-Z0-9]{7}$/);
    await expect(joinPrivateByCode(2, "XX")).rejects.toThrow("codice sala valido");
    await joinPrivateByCode(2, created.room.inviteCode!);
    await joinPrivateByCode(3, created.room.inviteCode!);
    await joinPrivateByCode(4, created.room.inviteCode!);
    expect(players.map((player) => player.userId)).toEqual([1, 2, 3, 4]);
  });
});
