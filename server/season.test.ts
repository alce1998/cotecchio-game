import { describe, expect, it } from "vitest";
import { aggregateSeasonResults, leaderboardStatus, MINIMUM_VALID_MATCHES, seasonWindow } from "./season";

describe("classifica stagionale", () => {
  it("mantiene grigio il risultato fino alla quinta partita", () => {
    expect(MINIMUM_VALID_MATCHES).toBe(5);
    expect(leaderboardStatus(0)).toBe("provisional");
    expect(leaderboardStatus(4)).toBe("provisional");
    expect(leaderboardStatus(5)).toBe("valid");
  });

  it("chiude la stagione il 31 dicembre alle 00:00 in ora di Roma", () => {
    const season = seasonWindow(new Date("2026-08-13T12:00:00Z"));
    expect(season.seasonYear).toBe(2026);
    expect(season.start.toISOString()).toBe("2025-12-30T23:00:00.000Z");
    expect(season.end.toISOString()).toBe("2026-12-30T23:00:00.000Z");
  });

  it("ordina per media, mantiene grigio chi non arriva a cinque e esclude gli abbandoni", () => {
    const now = new Date("2026-08-13T12:00:00Z");
    const current = new Date("2026-06-10T20:00:00Z");
    const results = aggregateSeasonResults([
      ...Array.from({ length: 5 }, () => ({ userId: 1, name: "Ada", finalScore: 8, status: "finished" as const, finishedAt: current })),
      ...Array.from({ length: 4 }, () => ({ userId: 2, name: "Bruno", finalScore: 6, status: "finished" as const, finishedAt: current })),
      { userId: 2, name: "Bruno", finalScore: 1, status: "abandoned" as const, finishedAt: current },
    ], now);
    expect(results.entries.map((entry) => entry.name)).toEqual(["Bruno", "Ada"]);
    expect(results.entries[0]).toMatchObject({ averageScore: 6, resultCount: 4, status: "provisional", place: null });
    expect(results.entries[1]).toMatchObject({ averageScore: 8, resultCount: 5, status: "valid", place: 1 });
  });
});
