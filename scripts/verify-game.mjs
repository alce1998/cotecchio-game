import assert from "node:assert/strict";
import { abbuonoIndividuale, autoPlay, createGame, resolveTrick } from "../client/src/game/engine.ts";

for (const playerCount of [3, 4, 5, 6, 7, 8]) {
  const game = createGame(playerCount, 100);
  const cardsInHands = game.players.reduce((total, player) => total + player.hand.length, 0);
  assert.equal(cardsInHands + game.discarded.length, 40, `mazzo completo per ${playerCount} giocatori`);
  assert.equal(new Set(game.players.map((player) => player.hand.length)).size, 1, `mani uguali per ${playerCount} giocatori`);
}

let game = createGame(4, 1000);
let guard = 0;
while (["playing", "resolving"].includes(game.phase) && guard < 100) {
  game = game.phase === "playing" ? autoPlay(game, game.turn) : resolveTrick(game);
  guard += 1;
}
assert.ok(["roundEnd", "matchEnd"].includes(game.phase), "smazzata terminata");
assert.ok(game.players.every((player) => Number.isInteger(player.score)), "punteggi di smazzata interi");
assert.equal(abbuonoIndividuale(3, 1), 2, "abbuono singolo in tre");
assert.equal(abbuonoIndividuale(3, 2), 1, "abbuono in parità in tre");
assert.equal(abbuonoIndividuale(4, 1), 4, "abbuono singolo in quattro");
assert.equal(abbuonoIndividuale(5, 3), 1, "abbuono in tre su cinque");
assert.equal(abbuonoIndividuale(6, 2), 3, "abbuono in due su sei");
assert.equal(abbuonoIndividuale(7, 1), 0, "nessun abbuono singolo in sette");
assert.equal(abbuonoIndividuale(7, 3), 2, "abbuono in tre su sette");
assert.equal(abbuonoIndividuale(8, 2), 0, "nessun abbuono in due su otto");
assert.equal(abbuonoIndividuale(8, 4), 2, "abbuono in quattro su otto");

console.log("Verifica regole completata: distribuzione, presa automatica e chiusura smazzata valide.");
