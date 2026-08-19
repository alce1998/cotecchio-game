import { describe, expect, it } from "vitest";
import { shouldNotifyTableReady } from "./notifications";

describe("avviso tavolo pronto", () => {
  it("notifica una volta sola quando la sala passa in partita", () => {
    expect(shouldNotifyTableReady("sala-1", "waiting", null)).toBe(false);
    expect(shouldNotifyTableReady("sala-1", "playing", null)).toBe(true);
    expect(shouldNotifyTableReady("sala-1", "playing", "sala-1")).toBe(false);
  });
});
