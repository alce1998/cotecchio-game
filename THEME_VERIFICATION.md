# Verifica temi grafici

## Risultati

La configurazione presenta cinque opzioni: **Taverna**, **Cibali**, **Balconera**, **Massimino** e **Mestalla**. Il tema selezionato modifica soltanto classi e variabili CSS locali al client; le chiamate di creazione e ingresso nelle sale online restano invariate e inviano soltanto il limite fisso di 100 punti.

La prova su tavolo locale ha confermato che **Taverna** mantiene il tavolo ovale originale, **Cibali** applica un piano rettangolare con bordo scuro e panno verde, **Balconera** una cornice moderna in vetro scuro, **Massimino** una finitura marmorea chiara con venature e **Mestalla** una trama di ferro battuto a righe strette. Gli sfondi dei temi sono ora generati con CSS, evitando dipendenze visive esterne e messaggi di errore di caricamento. Il selettore esplicita che la scelta non altera regole, sala o matchmaking. La scelta viene salvata nella chiave `cotecchio-table-theme` del localStorage.

## Responsive

Sotto i 620 px, il selettore passa a tre colonne e nasconde soltanto le descrizioni brevi, lasciando visibili anteprime e nomi dei cinque tavoli.
