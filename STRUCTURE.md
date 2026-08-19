# Architettura — Cotecchio

L’interfaccia React è il tavolo e il pannello di controllo; le regole sono indipendenti dal rendering in `client/src/game/`. Il canvas Babylon viene usato come fondale grafico del panno e della cornice, mentre l’area interattiva rimane HTML per rendere le carte accessibili, cliccabili e adattabili ai dispositivi mobili.

| Modulo | Responsabilità |
| --- | --- |
| `client/src/game/types.ts` | Vocabolario delle carte, giocatori, punteggi e stati della partita. |
| `client/src/game/rules.ts` | Mazzo, distribuzione, obbligo di seme, vincitore della presa e punteggio. |
| `client/src/game/engine.ts` | Macchina a stati della partita locale e scelta delle CPU. |
| `client/src/game/scene.ts` | Piccolo fondale Babylon, lifecycle-safe, con panno da gioco illuminato. |
| `client/src/components/GameCanvas.tsx` | Ciclo di vita del canvas e ridimensionamento del renderer. |
| `client/src/pages/Home.tsx` | Tavolo, mano utente, dialoghi, timer e comandi. |
| `server/matchmaking.ts` | Coda persistente, prontezza, turni autoritativi, pause, ritiri e archivio delle partite online. |
| `server/routers.ts` | Procedure protette per accesso, lobby, polling, mosse, pausa e ritiro. |

## Modello dati

Una `Card` ha `suit` e `rank`. Un `PlayerState` contiene la mano, le prese, il punteggio della smazzata, il punteggio partita, il flag di pausa e il numero di carte rimaste. `GameState` possiede l’ordine della presa corrente, l’indice di turno, il giocatore iniziale, gli scarti pubblici, il contatore di smazzate e la fase corrente.

## Invarianti

Il mazzo non contiene duplicati. Una carta non può comparire contemporaneamente in una mano, in una presa o negli scarti. Il turno procede una sola volta dopo ogni carta. In ogni presa, le carte di seme guidato sono obbligatorie quando disponibili. Solo il vincitore dell’ultima presa riceve il conguaglio per raggiungere sedici punti.

## Partita online

`game_rooms` con stato `waiting` è la **coda di matchmaking persistente**: utenti con lo stesso numero desiderato di giocatori e lo stesso limite vengono assegnati alla stanza più vecchia compatibile. La stanza avvia la partita quando almeno tre persone sono pronte; in alternativa, allo scadere della finestra di due minuti, i presenti vengono avviati purché siano almeno tre. Le interrogazioni periodiche ogni 1,5 secondi leggono lo stato autoritativo nel database, senza dipendere da memoria del browser.

Al termine, `game_matches` e `game_match_results` conservano stato finale, piazzamento, punteggio e premio di classifica. Il polling funge anche da heartbeat: dopo 45 secondi d’assenza il partecipante viene rimosso e riceve l’ultimo piazzamento, senza punti di classifica. Con almeno tre partecipanti il tavolo riapre una nuova smazzata mantenendo i punteggi; sotto soglia la sala e la partita vengono chiuse come annullate.
