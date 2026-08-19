import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ getDb: vi.fn() }));

import { getDb } from "./db";
import { gameRoomMessages, gameRoomPlayers, users } from "../drizzle/schema";
import { postRoomChat, roomChat } from "./matchmaking";

describe("integrazione chat di sala", () => {
  let messages: Array<{ id: number; roomId: string; userId: number; body: string; createdAt: Date }>;

  beforeEach(() => {
    messages = [];
    const players = [{ id: 1, roomId: "sala-chat", userId: 1, seat: 0, leftAt: null }, { id: 2, roomId: "sala-chat", userId: 2, seat: 1, leftAt: null }];
    const db = {
      select: () => ({
        from: (table: unknown) => {
          if (table === gameRoomPlayers) return { where: () => ({ orderBy: async () => players }) };
          if (table === gameRoomMessages) return { where: () => ({ orderBy: () => ({ limit: async () => messages }) }) };
          if (table === users) return { where: async () => [{ id: 1, name: "Ada" }, { id: 2, name: "Nello" }] };
          return { where: async () => [] };
        },
      }),
      insert: (table: unknown) => ({ values: async (value: { roomId: string; userId: number; body: string }) => { if (table === gameRoomMessages) messages.push({ id: messages.length + 1, ...value, createdAt: new Date() }); } }),
    };
    vi.mocked(getDb).mockResolvedValue(db as never);
  });

  it("permette a due partecipanti di inviare e ricevere lo storico della stessa sala", async () => {
    await postRoomChat("sala-chat", 1, " Ciao   Nello ");
    const history = await postRoomChat("sala-chat", 2, "Ciao Ada!");
    expect(history.map((message) => message.body)).toEqual(["Ciao Nello", "Ciao Ada!"]);
    expect((await roomChat("sala-chat", 1)).map((message) => message.author)).toEqual(["Ada", "Nello"]);
  });
});
