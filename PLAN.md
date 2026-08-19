# Piano di gioco — Cotecchio

## Rischi isolati

### 1. Regole di distribuzione e punteggio

- **Perché è isolato:** il Cotecchio combina obbligo di risposta al seme, gerarchia non numerica, carte scartate per alcuni tavoli e una regola speciale per l’ultima presa.
- **Approccio:** una logica deterministica a stati, con mazzo tipizzato e funzioni pure per le carte legali, il vincitore della presa, i punti grezzi e la chiusura della smazzata. I punteggi di ogni giocatore restano separati dal valore delle singole carte.
- **Verifica:** ogni turno propone solo le carte legali; 3 batte 2, asso, re, cavallo, fante, 7, 6, 5 e 4; l’ultima presa completa il totale a 16; il cappotto assegna –16 al vincitore della presa e +16 agli altri.

### 2. Interazione a tempo e CPU

- **Perché è isolato:** un conto alla rovescia non deve consentire mosse illegali o bloccare l’avanzamento automatico della mano.
- **Approccio:** il timer è attivo esclusivamente per il giocatore di turno; alla scadenza seleziona casualmente una carta tra quelle legali. La pausa è disponibile una sola volta per il giocatore umano e sospende il timer per massimo un minuto.
- **Verifica:** allo scadere dei 30 secondi viene giocata una carta valida; pausa, ripresa e fine pausa aggiornano il timer senza duplicare né saltare turni.

## Costruzione principale

L’app offre una partita locale da tre a otto partecipanti, con un giocatore umano e avversari CPU. Il tavolo visibile dall’alto mostra la mano dell’utente, le carte coperte degli avversari, le carte della presa corrente, il palo da seguire e il conto alla rovescia. La classifica parziale e le regole restano disponibili senza interrompere la partita.

La smazzata riduce il mazzo in modo pubblico quando il numero dei partecipanti non divide quaranta: un quattro a tre giocatori, tutti i quattro a sei giocatori, tutti i quattro e un cinque a sette giocatori. La partita continua fino al primo superamento della soglia; a quel punto vince il punteggio più basso e viene calcolata la dote di classifica della partita.

- **Asset necessari:** sfondo da tavolo 1920×1080, texture panno, gettone di presa 64×64 px, logo, foglio fronti da usare come sprite 96×166 px, retro 96×166 px.
- **Verifica:** il tavolo resta leggibile su desktop e mobile; le carte reali sono visibili senza immagini mancanti; non esistono carte duplicate; tutte le 40 carte sono distribuite o dichiarate scartate; nessuna sovrapposizione impedisce un clic sulla propria mano.
- **Flusso di gioco:** configurazione → distribuzione → presa dopo presa → calcolo smazzata → nuova smazzata oppure risultato finale.
- **Limite di piattaforma:** questa prima consegna implementa in modo completo il gioco locale contro CPU nel browser. Autenticazione, matchmaking e APK nativo richiedono una fase full-stack e di packaging mobile dedicata.

## Estensione online realizzata

La consegna full-stack introduce login, coda persistente, sala d’attesa, dichiarazione di prontezza, polling periodico, timer e pausa autoritativi. L’abbuono è riportato nel riepilogo della smazzata. Le partite online terminate sono storicizzate con punteggio, piazzamento e punti di classifica; un ritiro chiude la sala come annullata.
