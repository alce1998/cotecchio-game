# Memoria di lavorazione — Cotecchio

## Regole recepite dal documento allegato

Il gioco supporta da tre a otto giocatori individuali, usa quaranta carte piacentine e impone la risposta al seme. La gerarchia è 3, 2, asso, re, cavallo, fante, 7, 6, 5, 4. L’asso vale un punto; 3, 2 e le figure valgono un terzo; l’asso di bastoni vale sei punti.

Il fine è fare meno punti. Dopo ogni smazzata il punteggio di tutti, eccetto quello dell’ultima presa, viene arrotondato per difetto; l’ultima presa riceve il complemento a sedici. Il cappotto porta –16 al vincitore dell’ultima presa e +16 a tutti gli altri.

## Scelte di consegna

La versione browser fornisce il ciclo locale completo contro CPU. Le funzioni online richiedono identità, persistenza, sincronizzazione in tempo reale, abbandoni e matchmaking: sono documentate come fase successiva anziché simulate con dati fittizi.

## Estensione online e abbuono

La modalità online usa l’accesso Manus e una coda persistente per parametri compatibili; il browser interroga la sala ogni 1,5 secondi. Le sale partono da tre giocatori pronti oppure dopo due minuti di attesa con almeno tre partecipanti. Le partite chiuse vengono archiviate con piazzamento e punti di classifica. Un ritiro o una disconnessione oltre 45 secondi assegna l’ultimo piazzamento senza punti al giocatore uscente; il tavolo continua da tre partecipanti con una nuova smazzata che conserva i punteggi, oppure si chiude sotto soglia.

L’abbuono è calcolato dopo il punteggio ordinario e prima dell’aggiornamento dei totali. A tre partecipanti il fondo è −2: −2 al solo minimo, oppure −1 per ciascuno dei due minimi. Il cappotto mantiene precedenza assoluta e non riceve ulteriori abbuoni.

## Asset utente

Non riapro le immagini inviate, in rispetto del vincolo dell’utente. I file fronte e retro sono stati copiati nell’archivio asset e caricati per l’uso diretto dell’app.
