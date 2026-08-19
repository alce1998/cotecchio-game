import { describe, expect, it } from "vitest";
import { normalizedRoomMessage } from "./matchmaking";

describe("chat della sala", () => {
  it("normalizza gli spazi senza alterare il contenuto del messaggio", () => {
    expect(normalizedRoomMessage("  Ciao   al\n tavolo  ")).toBe("Ciao al tavolo");
    expect(normalizedRoomMessage("    ")).toBe("");
  });
});
