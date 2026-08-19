# Comunicazione della sala online

La chat è disponibile esclusivamente agli utenti che occupano un posto attivo nella sala. I messaggi sono testuali, associati al relativo account e limitati a 600 caratteri.

Audio e video sono **disattivati per impostazione predefinita**. Il giocatore li abilita soltanto tramite i comandi presenti sul proprio riquadro; il browser richiede quindi il consenso esplicito per microfono e/o videocamera. La scelta può essere revocata in qualunque momento, disattivando entrambi i controlli.

Quando un utente non condivide un flusso video, il riquadro mostra il suo avatar con iniziali. La sala scambia la segnalazione necessaria fra browser partecipanti e non registra né audio né video sul server. La negoziazione crea canali di ricezione anche per chi non ha ancora attivato dispositivi, così l’audio/video di un partecipante può arrivare a tutti i presenti autorizzati.

Su smartphone l’app richiede, trasmette e riceve solo l’audio; il controllo della videocamera è nascosto per lasciare spazio al tavolo. I test automatici coprono permessi, normalizzazione audio-only, signaling e UI. La prova conclusiva con due account reali e dispositivi fisici resta necessaria perché browser, reti e permessi hardware non sono simulabili integralmente nell’ambiente di sviluppo.
