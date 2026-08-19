/**
 * Il tavolo visivo è gestito dal fondale CSS dell’app.
 *
 * Babylon viene volutamente escluso dal runtime: in alcuni percorsi Vite il
 * registro shader non viene popolato e il renderer tenta di compilare la pagina
 * HTML di fallback come GLSL. Il canvas era decorativo e non partecipa a regole,
 * input o stato della partita; restituire `null` evita un errore console senza
 * ridurre la giocabilità o il fondale del tavolo.
 */
export default function GameCanvas() {
  return null;
}
