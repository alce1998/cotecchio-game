import { describe, expect, it } from "vitest";
import { isPelliccione, pelliccioneEventKey, roundEffect, trickPointTotal } from "./tableEvents";

describe("eventi simbolici del tavolo", () => {
  it("emette un nuovo trigger Pelliccione a ogni smazzata", () => {
    const trick = [{ playerId: 2, card: { id: "bastoni-1", suit: "bastoni" as const, rank: 1 as const } }];
    expect(pelliccioneEventKey(1, trick)).toBe("1-2-bastoni-1");
    expect(pelliccioneEventKey(2, trick)).toBe("2-2-bastoni-1");
  });

  it("riconosce il Pelliccione e i suoi sei punti", () => {
    const pelliccione = { id: "bastoni-1", suit: "bastoni" as const, rank: 1 as const };
    expect(isPelliccione(pelliccione)).toBe(true);
    expect(trickPointTotal([{ playerId: 1, card: pelliccione }])).toBe(6);
  });

  it("segnala cappotto e conclusione del match", () => {
    expect(roundEffect("roundEnd", [-16, 16, 16])).toBe("cappotto");
    expect(roundEffect("matchEnd", [4, 6, 7])).toBe("finale");
  });
});
