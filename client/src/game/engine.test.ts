import { describe, expect, it } from "vitest";
import { abbuonoIndividuale, canCloseInHand, chooseCpuCard, closeInHand, createGame, matchRanking, nextDeal, playCard, resolveTrick } from "./engine";
import { GameCard, Rank, Suit } from "./types";

const card = (suit: Suit, rank: Rank): GameCard => ({ id: `${suit}-${rank}`, suit, rank });

function cpuScenario(cpuHand: GameCard[], otherHands: [GameCard[], GameCard[]]) {
  const game = createGame(3, 100);
  game.turn = 1;
  game.leader = 0;
  game.players[0].hand = otherHands[0];
  game.players[1].hand = cpuHand;
  game.players[2].hand = otherHands[1];
  return game;
}

describe("abbuono del Cotecchio", () => {
  it("applica il fondo da −2 nel tavolo da tre", () => {
    expect(abbuonoIndividuale(3, 1)).toBe(2);
    expect(abbuonoIndividuale(3, 2)).toBe(1);
  });

  it("ripartisce il fondo per quattro, cinque e sei giocatori", () => {
    expect(abbuonoIndividuale(4, 1)).toBe(4);
    expect(abbuonoIndividuale(4, 2)).toBe(2);
    expect(abbuonoIndividuale(5, 3)).toBe(1);
    expect(abbuonoIndividuale(6, 1)).toBe(6);
    expect(abbuonoIndividuale(6, 3)).toBe(2);
    expect(abbuonoIndividuale(6, 4)).toBe(1);
  });

  it("rispetta le soglie minime per sette e otto giocatori", () => {
    expect(abbuonoIndividuale(7, 1)).toBe(0);
    expect(abbuonoIndividuale(7, 2)).toBe(3);
    expect(abbuonoIndividuale(7, 3)).toBe(2);
    expect(abbuonoIndividuale(8, 2)).toBe(0);
    expect(abbuonoIndividuale(8, 3)).toBe(3);
    expect(abbuonoIndividuale(8, 4)).toBe(2);
  });

  it("distribuisce sempre le carte senza doppioni", () => {
    const game = createGame(7, 100);
    const cards = game.players.flatMap((player) => player.hand).concat(game.discarded);
    expect(cards).toHaveLength(40);
    expect(new Set(cards.map((card) => card.id)).size).toBe(40);
  });

  it("mantiene distribuibile e classificabile un tavolo online oltre otto partecipanti", () => {
    const game = createGame(12, 100);
    const cards = game.players.flatMap((player) => player.hand).concat(game.discarded);
    expect(game.players).toHaveLength(12);
    expect(game.players.every((player) => player.name.length > 0)).toBe(true);
    expect(cards).toHaveLength(40);
    expect(new Set(cards.map((card) => card.id)).size).toBe(40);
    expect(matchRanking(game)).toHaveLength(12);
  });
});

describe("ordine antiorario del tavolo", () => {
  it("assegna i nomi CPU aggiornati nell’ordine previsto", () => {
    const game = createGame(4, 100);
    expect(game.players.map((player) => player.name)).toEqual(["Tu", "Maestro", "Sergio", "Carlaccio"]);
  });

  it("passa il turno al posto antiorario successivo", () => {
    const game = createGame(4, 100);
    const firstPlayer = game.turn;
    const firstCard = game.players[firstPlayer].hand[0];
    const played = playCard(game, firstPlayer, firstCard.id);

    expect(firstPlayer).toBe(0);
    expect(played.turn).toBe(3);
  });

  it("ruota il primo giocatore di una smazzata in senso antiorario", () => {
    const firstDeal = createGame(4, 100);
    const secondDeal = nextDeal(firstDeal);
    const thirdDeal = nextDeal(secondDeal);

    expect(firstDeal.leader).toBe(0);
    expect(secondDeal.leader).toBe(3);
    expect(thirdDeal.leader).toBe(2);
  });

  it("conserva la presa completa nello stato resolving prima di assegnarla", () => {
    const game = createGame(3, 100);
    const first = game.turn;
    const afterFirst = playCard(game, first, game.players[first].hand[0].id);
    const second = afterFirst.turn;
    const afterSecond = playCard(afterFirst, second, afterFirst.players[second].hand[0].id);
    const third = afterSecond.turn;
    const resolving = playCard(afterSecond, third, afterSecond.players[third].hand[0].id);

    expect(resolving.phase).toBe("resolving");
    expect(resolving.trick).toHaveLength(3);
    expect(resolving.lastTrick).toHaveLength(0);
  });
});

describe("chiuso in mano", () => {
  it("alla prima presa assegna 16 al dichiarante e zero agli altri, senza cappotto", () => {
    const game = cpuScenario([card("bastoni", 3), card("coppe", 3)], [[card("bastoni", 4), card("coppe", 4)], [card("denari", 4), card("spade", 4)]]);
    expect(canCloseInHand(game, 1)).toBe(true);

    const closed = closeInHand(game, 1);
    expect(closed.phase).toBe("roundEnd");
    expect(closed.closedInHandBy).toBe(1);
    expect(closed.players[1].tricks).toBe(2);
    expect(closed.players.every((player) => player.hand.length === 0)).toBe(true);
    expect(closed.roundAwards).toEqual([0, 16, 0]);
  });

  it("consente la dichiarazione anche quando un avversario potrebbe superare una carta", () => {
    const game = cpuScenario([card("bastoni", 5), card("coppe", 3)], [[card("bastoni", 3), card("coppe", 4)], [card("denari", 4), card("spade", 4)]]);
    expect(canCloseInHand(game, 1)).toBe(false);
    const closed = closeInHand(game, 1);
    expect(closed).not.toBe(game);
    expect(closed.phase).toBe("roundEnd");
  });

  it("dopo una presa già completata assegna normalmente le carte residue, senza la regola da 16", () => {
    const game = cpuScenario([card("bastoni", 5), card("coppe", 3)], [[card("bastoni", 3), card("coppe", 4)], [card("denari", 4), card("spade", 4)]]);
    game.players[0].tricks = 1;
    game.players[0].roundPointsRaw = 1;
    const closed = closeInHand(game, 1);
    expect(closed.phase).toBe("roundEnd");
    expect(closed.roundAwards[1]).not.toBe(16);
    expect(closed.closedInHandBy).toBe(1);
  });

  it("mantiene i 16 punti finché gli avversari hanno solo frazioni di punto", () => {
    const game = cpuScenario([card("bastoni", 5), card("coppe", 3)], [[card("bastoni", 3), card("coppe", 4)], [card("denari", 4), card("spade", 4)]]);
    game.players[0].roundPointsRaw = 2 / 3;
    const closed = closeInHand(game, 1);
    expect(closed.roundAwards).toEqual([0, 16, 0]);
  });
});

describe("CPU difensiva", () => {
  it("non apre con il Tre certo quando dispone di una carta bassa più sicura", () => {
    const game = cpuScenario([card("denari", 3), card("coppe", 4)], [[card("denari", 2)], [card("denari", 1), card("coppe", 7)]]);
    expect(chooseCpuCard(game, 1)?.id).toBe("coppe-4");
  });

  it("apre con una carta sicura dell'unico seme per costruire il parafallo", () => {
    const game = cpuScenario([card("coppe", 9), card("denari", 4), card("denari", 5)], [[card("coppe", 3), card("denari", 2)], [card("spade", 7), card("denari", 6)]]);

    expect(chooseCpuCard(game, 1)?.id).toBe("coppe-9");
  });

  it("fra due semi corti equivalenti sceglie la carta più sicura per il parafallo", () => {
    const game = cpuScenario([card("coppe", 9), card("spade", 4), card("denari", 4), card("denari", 5)], [[card("coppe", 3), card("spade", 3)], [card("denari", 6), card("coppe", 7)]]);

    expect(chooseCpuCard(game, 1)?.id).toBe("spade-4");
  });

  it("non sacrifica Tre/Due di bastoni per costruire il parafallo", () => {
    const game = cpuScenario([card("bastoni", 3), card("coppe", 9), card("denari", 4), card("denari", 5)], [[card("bastoni", 1), card("coppe", 3)], [card("spade", 7), card("denari", 6)]]);

    expect(chooseCpuCard(game, 1)?.id).toBe("coppe-9");
  });

  it("scarica il Pelliccione quando non può rispondere al seme", () => {
    const game = cpuScenario([card("bastoni", 1), card("spade", 3)], [[card("denari", 7)], [card("denari", 4), card("spade", 5)]]);
    game.leadSuit = "denari";
    game.trick = [{ playerId: 0, card: card("denari", 7) }];
    expect(chooseCpuCard(game, 1)?.id).toBe("bastoni-1");
  });

  it("scarica un asso ordinario quando è fuori seme e può liberarsene senza prendere", () => {
    const game = cpuScenario([card("coppe", 1), card("spade", 4)], [[card("denari", 7)], [card("denari", 4), card("coppe", 6)]]);
    game.leadSuit = "denari";
    game.trick = [{ playerId: 0, card: card("denari", 7) }];
    expect(chooseCpuCard(game, 1)?.id).toBe("coppe-1");
  });

  it("se può perdere la presa, scarica la carta perdente più pericolosa", () => {
    const game = cpuScenario([card("denari", 2), card("denari", 4)], [[card("denari", 3)], [card("coppe", 6)]]);
    game.leadSuit = "denari";
    game.trick = [{ playerId: 0, card: card("denari", 3) }];
    expect(chooseCpuCard(game, 1)?.id).toBe("denari-2");
  });

  it("se è costretta a prendere, usa la carta meno rischiosa", () => {
    const game = cpuScenario([card("denari", 3), card("denari", 5)], [[card("denari", 4)], [card("coppe", 6)]]);
    game.leadSuit = "denari";
    game.trick = [{ playerId: 0, card: card("denari", 4) }];
    expect(chooseCpuCard(game, 1)?.id).toBe("denari-5");
  });

  it("quando ha già tutte le prese, sceglie una carta alta per tentare il cappotto", () => {
    const game = cpuScenario([card("denari", 3), card("denari", 5)], [[card("denari", 4)], [card("coppe", 6)]]);
    game.players[1].tricks = 5;
    game.leadSuit = "denari";
    game.trick = [{ playerId: 0, card: card("denari", 4) }];
    expect(chooseCpuCard(game, 1)?.id).toBe("denari-3");
  });

  it("non trasforma una sola presa iniziale in un cappotto e non vince il Pelliccione con il Due", () => {
    const game = cpuScenario([card("bastoni", 2), card("bastoni", 4)], [[card("bastoni", 1)], [card("coppe", 6)]]);
    game.players[1].tricks = 1;
    game.leadSuit = "bastoni";
    game.trick = [{ playerId: 0, card: card("bastoni", 1) }];
    expect(chooseCpuCard(game, 1)?.id).toBe("bastoni-4");
  });

  it("cede il Pelliccione quando il Tre di bastoni già domina la presa", () => {
    const game = cpuScenario([card("bastoni", 1), card("bastoni", 4)], [[card("bastoni", 3)], [card("coppe", 6)]]);
    game.leadSuit = "bastoni";
    game.trick = [{ playerId: 0, card: card("bastoni", 3) }];
    expect(chooseCpuCard(game, 1)?.id).toBe("bastoni-1");
  });

  it("fuori seme scarica la carta più pericolosa invece della carta bassa", () => {
    const game = cpuScenario([card("spade", 4), card("coppe", 3), card("coppe", 1)], [[card("denari", 7)], [card("denari", 4), card("coppe", 6)]]);
    game.leadSuit = "denari";
    game.trick = [{ playerId: 0, card: card("denari", 7) }];
    expect(chooseCpuCard(game, 1)?.id).toBe("coppe-1");
  });

  it("accetta una presa sotto il punto pieno per liberare una carta alta", () => {
    const game = cpuScenario([card("denari", 3), card("denari", 5)], [[card("denari", 7)], [card("coppe", 6)]]);
    game.leadSuit = "denari";
    game.trick = [{ playerId: 0, card: card("denari", 7) }];

    expect(chooseCpuCard(game, 1)?.id).toBe("denari-3");
  });

  it("da ultima prende con il Tre di bastoni solo finché il Pelliccione non è apparso", () => {
    const game = cpuScenario([card("bastoni", 3), card("bastoni", 5)], [[card("bastoni", 9)], [card("bastoni", 1), card("bastoni", 10)]]);
    game.leadSuit = "bastoni";
    game.trick = [{ playerId: 0, card: card("bastoni", 9) }, { playerId: 2, card: card("bastoni", 10) }];
    expect(chooseCpuCard(game, 1)?.id).toBe("bastoni-3");

    game.players[2].hand = [card("bastoni", 10)];
    game.lastTrick = [{ playerId: 0, card: card("bastoni", 1) }];
    expect(chooseCpuCard(game, 1)?.id).toBe("bastoni-5");
  });

  it("non usa Tre/Due di bastoni per una presa economica se non è l'ultimo di mano", () => {
    const game = cpuScenario([card("bastoni", 3), card("bastoni", 5)], [[card("bastoni", 9)], [card("bastoni", 1), card("bastoni", 10)]]);
    game.leadSuit = "bastoni";
    game.trick = [{ playerId: 0, card: card("bastoni", 9) }];

    expect(chooseCpuCard(game, 1)?.id).toBe("bastoni-5");
  });

  it("scarica in ordine Pelliccione, Tre/Due di bastoni e poi le alte degli altri semi", () => {
    const game = cpuScenario([card("bastoni", 1), card("bastoni", 3), card("spade", 1)], [[card("denari", 7)], [card("denari", 4)]]);
    game.leadSuit = "denari";
    game.trick = [{ playerId: 0, card: card("denari", 7) }];
    expect(chooseCpuCard(game, 1)?.id).toBe("bastoni-1");

    game.players[1].hand = [card("bastoni", 3), card("spade", 1)];
    expect(chooseCpuCard(game, 1)?.id).toBe("bastoni-3");

    game.players[1].hand = [card("spade", 1), card("coppe", 3)];
    expect(chooseCpuCard(game, 1)?.id).toBe("spade-1");
  });
});
