# Idee di design — Cotecchio

## Tre possibili direzioni

| Tema | Breve introduzione | Probabilità |
| --- | --- | ---: |
| **Sala da Circolo** | Il calore di un tavolo da gioco tradizionale, legno patinato, ottone e segnapunti da bar di paese. Trasmette familiarità e competizione amichevole. | 0,07 |
| **Cabinet Tipografico** | Un’esperienza editoriale ispirata a manuali di carte italiani: carta avorio, incisioni, timbri e una rigorosa gerarchia tipografica. | 0,04 |
| **Notte in Osteria** | Un tavolo verde profondo illuminato da una lampada calda, con carte piacentine nitide e dettagli da insegna smaltata. È raccolto, leggibile e rituale. | 0,09 |

## Direzione selezionata: Notte in Osteria

### Movimento di design

**Modernismo vernacolare italiano**: l’atmosfera dei circoli e delle osterie emiliane tradotta in un’interfaccia contemporanea, concreta e altamente funzionale.

### Principi guida

1. Il tavolo è il centro narrativo: tutto ciò che è essenziale alla presa vive attorno al panno verde.
2. La tradizione non è una decorazione: carte, semi e lessico del Cotecchio restano i protagonisti leggibili.
3. Le informazioni competitive emergono come un segnapunti fisico, non come pannelli astratti.
4. Ogni interazione risponde con il peso e la precisione di una carta posata sul tavolo.

### Filosofia cromatica

Il **verde biliardo profondo** comunica concentrazione e continuità fra una mano e l’altra; avorio e gesso riducono l’affaticamento sulle superfici informative; bordeaux e ottone usano il contrasto solo per azioni, pericoli e risultati. L’interfaccia evita la spettacolarizzazione digitale: deve sembrare una partita vera, non un casinò.

### Paradigma di layout

Un tavolo ovale occupa il campo visivo. I giocatori formano un anello attorno al panno, mentre punteggi e comandi si agganciano al bordo come accessori fisici del tavolo. Su schermi stretti il tavolo si apre verticalmente, mantenendo la mano del giocatore in primo piano.

### Elementi distintivi

1. **Cornice da tavolo** in noce scuro con riflessi d’ottone opaco.
2. **Gettoni di presa** che indicano il turno e l’ultima mano conquistata.
3. **Etichette a timbro** per palo, obbligo di risposta e avvisi di tempo.

### Filosofia d’interazione

Il giocatore riceve sempre un’indicazione chiara delle carte valide; la carta selezionata si solleva appena e si posa al centro con una transizione breve. Gli elementi passivi restano discreti, mentre le scelte di gioco e i cambi turno hanno una risposta netta.

### Animazione

Le carte entrano con una traiettoria corta e un lieve scarto di rotazione, senza effetti di zoom teatrali. I passaggi di turno durano circa 180 ms con curva di uscita rapida. La presa vinta viene raccolta con una scivolata verso il giocatore vincitore. Tutte le animazioni non essenziali rispettano `prefers-reduced-motion`.

### Sistema tipografico

**Fraunces** per risultati, punteggi e titoli, con un tono quasi da insegna dipinta; **Source Sans 3** per regole, comandi e cronologia, ottimizzata per lettura rapida. I valori di partita sono tabulari e ad alta leggibilità; le azioni sono brevi e imperative.

### Essenza del brand

**Cotecchio è il tavolo digitale per chi vuole giocare a Traversone con la serietà allegra di un circolo.** Personalità: **autentica, vigile, conviviale**.

### Voce del brand

La voce è diretta, locale ma non caricaturale, competitiva senza aggressività. Le azioni sono formulate come inviti di gioco, non come istruzioni generiche.

> “Tocca a te: rispondi a Spade.”

> “La presa è tua. Tieni basso il conto.”

### Wordmark e logo

Il marchio è un **traversone**: una barra diagonale marfilo attraversa un seme di bastoni stilizzato e lo trasforma in un segno di gioco immediatamente riconoscibile. È solo simbolo, senza testo, per funzionare anche come icona applicativa.

### Colore firma

**Verde Cotecchio — #0F4B3A.**

## Style Decisions

Tutti gli elementi informativi della partita sono oggetti da tavolo: targhette smaltate, segnapunti con bordo d’ottone e cartigli stampati, mai pannelli generici o pillole traslucide. Fraunces governa ogni momento rituale e competitivo — punteggio, turno, piazzamento e presa — mentre Source Sans 3 resta riservata alle spiegazioni brevi. La microcopia parla come un compagno di tavolo emiliano: concisa, calma e concreta.
