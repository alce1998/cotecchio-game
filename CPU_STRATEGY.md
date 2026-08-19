# Strategia CPU difensiva

La CPU locale minimizza la probabilità di aggiudicarsi una presa e, in secondo luogo, il valore delle carte che può essere costretta a raccogliere. L’euristica legge solo la configurazione della mano corrente e assegna una penalità elevata alle carte che possono vincere con certezza o alta probabilità.

| Situazione | Comportamento CPU |
| --- | --- |
| Apre la presa | Privilegia una carta bassa, senza punti, di un seme ancora detenuto dagli avversari e con carte superiori disponibili. Fra aperture equivalenti cerca il **parafallo**: gioca una carta sicura del seme più corto, così da restarne priva e poter scaricare in seguito carte pericolose di altri semi. Evita 3, 2, assi e semi ormai esauriti presso gli altri giocatori. |
| Risponde al seme | Se può perdere la presa, sceglie la carta pericolosa più alta fra quelle perdenti. Se è costretta a vincere, usa la carta meno costosa che lascia più probabilità agli avversari di superarla. |
| Non possiede il seme richiesto | Scarica prima le carte ad alto rischio: Pelliccione, altri assi, 3, 2 e figure; in particolare privilegia carte che, se conservate, potrebbero farle prendere una presa successiva. |
| Pelliccione | Non lo espone in apertura o risposta se può evitarlo; lo scarica quando è fuori seme per sottrarlo alle prese. |
| Cappotto | La CPU cambia direzione solo quando ha già vinto tutte le prese disputate e nessun altro ha segnato: in quel caso massimizza la sicurezza di prendere per chiudere il cappotto. |

La valutazione della certezza tiene conto delle carte ancora presenti nelle mani degli altri giocatori locali. Per le partite online, l’euristica resta locale alla mano simulata del tavolo e non altera il flusso di sincronizzazione.
