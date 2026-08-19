import { describe, expect, it } from "vitest";
import { ONLINE_SCORE_LIMIT, canContinueAfterDeparture, departureDecision, isPublicMatchmakingRoom, normalizedInviteCode, privateJoinValidation, shouldStartOnlineRoom, withDisplayOrder } from "./matchmaking";
import { createGame } from "../client/src/game/engine";

describe("gestione ritiro online", () => {
  it("prosegue solo quando il tavolo conserva almeno tre partecipanti", () => {
    expect(canContinueAfterDeparture(2)).toBe(false);
    expect(canContinueAfterDeparture(3)).toBe(true);
    expect(canContinueAfterDeparture(8)).toBe(true);
  });
  it("prosegue con almeno un voto per continuare e annulla solo con chiusura unanime", () => {
    expect(departureDecision([2, 3, 4], { "2": "continue", "3": "end" })).toBe("continue");
    expect(departureDecision([2, 3, 4], { "2": "end", "3": "end", "4": "end" })).toBe("end");
    expect(departureDecision([2, 3], {})).toBe("end");
  });
});

describe("inviti privati", () => {
  it("normalizza il codice e non considera private le sale per il matchmaking pubblico", () => {
    expect(normalizedInviteCode(" cote-ab_12 ")).toBe("COTEAB12");
    expect(isPublicMatchmakingRoom("public", "waiting")).toBe(true);
    expect(isPublicMatchmakingRoom("private", "waiting")).toBe(false);
    expect(isPublicMatchmakingRoom("public", "playing")).toBe(false);
  });

  it("accetta solo codici validi per sale private in attesa", () => {
    const waitingPrivate = { visibility: "private" as const, status: "waiting", activePlayers: 2 };
    expect(privateJoinValidation(waitingPrivate, "COTE-AB12")).toBe("accepted");
    expect(privateJoinValidation(waitingPrivate, "AB")).toBe("invalid-code");
    expect(privateJoinValidation({ ...waitingPrivate, activePlayers: 12 }, "COTEAB12")).toBe("accepted");
    expect(privateJoinValidation({ ...waitingPrivate, visibility: "public" }, "COTEAB12")).toBe("unavailable");
    expect(privateJoinValidation(null, "COTEAB12")).toBe("unavailable");
  });
});

describe("avvio della sala online", () => {
  it("mostra nel tavolo i nomi reali del roster invece delle etichette CPU", () => {
    const game = createGame(3, 100);
    const view = withDisplayOrder(game, 0, new Map([[0, "Alessandro"], [1, "Bianca"], [2, "Carlo"]]));
    expect(view.players.map((player) => player.name)).toEqual(["Alessandro", "Bianca", "Carlo"]);
  });

  it("usa sempre il limite online fisso di 100 punti", () => {
    expect(ONLINE_SCORE_LIMIT).toBe(100);
  });

  it("parte da tre giocatori al termine dell’attesa o subito quando tutti sono pronti", () => {
    expect(shouldStartOnlineRoom(2, true, true)).toBe(false);
    expect(shouldStartOnlineRoom(3, false, false)).toBe(false);
    expect(shouldStartOnlineRoom(3, true, false)).toBe(true);
    expect(shouldStartOnlineRoom(7, false, true)).toBe(true);
  });
});
