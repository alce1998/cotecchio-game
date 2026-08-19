/** Design: Notte in Osteria — il panno verde è il palcoscenico, i dati sono accessori da tavolo. */
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, BookOpen, Camera, ChevronRight, CircleHelp, Copy, KeyRound, LogIn, Medal, MessageCircle, Mic, MicOff, Pause, RotateCcw, Send, Timer, Trophy, Users, Video, VideoOff, Wifi, X } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import GameCanvas from "@/components/GameCanvas";
import { autoPlay, closeInHand, createGame, isLegalForHuman, matchRanking, nextDeal, playCard, resolveTrick } from "@/game/engine";
import { cardLabel, RANK_LABEL, SUIT_LABEL } from "@/game/rules";
import { GameCard, GameState, Suit } from "@/game/types";
import { shouldNotifyTableReady } from "@/game/notifications";
import { dispatchTableReadyNotification, requestTableNotificationPermission } from "@/game/browserNotifications";
import { pelliccioneEventKey, roundEffect, trickPointTotal } from "@/game/tableEvents";
import { useRoomMedia } from "@/hooks/useRoomMedia";
import { beginsPointerDrag, commitsCardDrop } from "@/game/cardInput";
import "./logoCrop.css";
import "./cardInteraction.css";
import "./chatDock.css";
import "./tableThemes.css";

const FRONT_SHEET = "/cards/fronte.jpg";
const BACK_CARD = "/cards/retro.jpg";
const TABLE_IMAGE = "/cards/tavolo.png";
const FELT_IMAGE = "/cards/panno.png";
const TOKEN_IMAGE = "/cards/gettone.png";
const LOGO_IMAGE = "/cards/logo.jpg";
const TABLE_THEMES = [
  { id: "taverna", name: "Taverna", note: "Il circolo di sempre", image: TABLE_IMAGE },
  { id: "cibali", name: "Cibali", note: "Legno scuro e panno verde", image: TABLE_IMAGE },
  { id: "balconera", name: "Balconera", note: "Vetro scuro e sole di terrazza", image: TABLE_IMAGE },
  { id: "massimino", name: "Massimino", note: "Marmo e luce calda", image: TABLE_IMAGE },
  { id: "mestalla", name: "Mestalla", note: "Ferro battuto all’aperto", image: TABLE_IMAGE },
] as const;
type TableThemeId = (typeof TABLE_THEMES)[number]["id"];
const suitIndex: Record<Suit, number> = { denari: 0, coppe: 1, bastoni: 2, spade: 3 };

function cardFaceStyle(card: GameCard) {
  const x = ((card.rank - 1) / 9) * 100;
  const y = (suitIndex[card.suit] / 3) * 100;
  return { backgroundImage: `url(${FRONT_SHEET})`, backgroundPosition: `${x}% ${y}%` };
}

function PiacentineCard({ card, onClick, disabled, small = false }: { card: GameCard; onClick?: () => void; disabled?: boolean; small?: boolean }) {
  const [selected, setSelected] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const gesture = useRef<{ x: number; y: number; active: boolean } | null>(null);
  const finishDrop = (clientX: number, clientY: number) => {
    const trickZone = document.querySelector(".trick-zone")?.getBoundingClientRect();
    const isOverTrickZone = Boolean(trickZone && clientX >= trickZone.left && clientX <= trickZone.right && clientY >= trickZone.top && clientY <= trickZone.bottom);
    if (commitsCardDrop(true, isOverTrickZone)) onClick?.();
    setDragging(false);
    setOffset({ x: 0, y: 0 });
    setSelected(false);
  };
  return <button className={`piacentine-card ${small ? "small" : ""} ${disabled ? "disabled" : ""} ${selected ? "selected" : ""} ${dragging ? "dragging" : ""}`} style={{ ...cardFaceStyle(card), "--drag-x": `${offset.x}px`, "--drag-y": `${offset.y}px` } as React.CSSProperties} onClick={() => { if (!disabled) setSelected(true); }} disabled={disabled} draggable={false} onPointerDown={(event) => { if (disabled || small || !onClick) return; gesture.current = { x: event.clientX, y: event.clientY, active: false }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (!gesture.current) return; const x = event.clientX - gesture.current.x; const y = event.clientY - gesture.current.y; if (beginsPointerDrag(event.pointerType, x, y)) gesture.current.active = true; if (gesture.current.active) { event.preventDefault(); setSelected(true); setDragging(true); setOffset({ x, y }); } }} onPointerUp={(event) => { if (!gesture.current) return; const active = gesture.current.active; gesture.current = null; if (active) { event.preventDefault(); finishDrop(event.clientX, event.clientY); } }} onPointerCancel={() => { gesture.current = null; setDragging(false); setOffset({ x: 0, y: 0 }); }} aria-pressed={selected} aria-label={`${cardLabel(card)}${selected ? ", selezionata" : ""}`} title={selected ? "Trascina la carta sul tavolo" : cardLabel(card)} data-card-id={card.id} />;
}
function BackCard({ compact = false }: { compact?: boolean }) { return <span className={`back-card ${compact ? "compact" : ""}`} style={{ backgroundImage: `url(${BACK_CARD})` }} aria-hidden="true" />; }
function SuitPip({ suit }: { suit: Suit | null }) { if (!suit) return <span className="suit-pip neutral">—</span>; return <span className={`suit-pip ${suit}`}>{suit === "denari" ? "●" : suit === "coppe" ? "⌒" : suit === "bastoni" ? "✦" : "†"}</span>; }
function MiniFan({ count }: { count: number }) { return <div className="mini-fan">{Array.from({ length: Math.min(count, 6) }, (_, index) => <BackCard compact key={index} />)}<span>{count}</span></div>; }
function Overlay({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="overlay" role="dialog" aria-modal="true" aria-label={title}><section className="overlay-panel"><button className="overlay-close" onClick={onClose} aria-label="Chiudi"><X size={20} /></button><p className="eyebrow">Cotecchio · Traversone</p><h2>{title}</h2>{children}</section></div>; }
function tablePosition(playerId: number, playerCount: number, radiusX: number, radiusY: number) { const angle = Math.PI / 2 + (Math.PI * 2 * playerId) / playerCount; return { left: `${50 + Math.cos(angle) * radiusX}%`, top: `${50 + Math.sin(angle) * radiusY}%` }; }
function initials(name: string) { return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "G"; }
function PlayerMediaTile({ name, avatarUrl, stream, videoEnabled, audioEnabled, own, onAudio, onVideo, videoAllowed = true }: { name: string; avatarUrl?: string | null; stream?: MediaStream; videoEnabled: boolean; audioEnabled: boolean; own?: boolean; onAudio?: () => void; onVideo?: () => void; videoAllowed?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => { if (videoRef.current) videoRef.current.srcObject = stream ?? null; if (audioRef.current) audioRef.current.srcObject = stream ?? null; }, [stream]);
  return <div className={`player-media ${videoEnabled && stream ? "has-video" : ""}`} aria-label={`Profilo di ${name}`}>
    {videoEnabled && stream ? <video ref={videoRef} autoPlay playsInline muted={own} /> : avatarUrl ? <img className="profile-photo" src={avatarUrl} alt={`Foto profilo di ${name}`} onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <div className="profile-avatar"><span>{initials(name)}</span></div>}
    {stream && !own && <audio ref={audioRef} autoPlay />}
    <div className="media-presence">{audioEnabled ? <Mic size={11} /> : <MicOff size={11} />}{videoEnabled ? <Video size={11} /> : <VideoOff size={11} />}</div>
    {own && <div className="media-controls"><button onClick={onAudio} aria-label={audioEnabled ? "Disattiva microfono" : "Attiva microfono"}>{audioEnabled ? <Mic size={13} /> : <MicOff size={13} />}</button>{videoAllowed && <button onClick={onVideo} aria-label={videoEnabled ? "Disattiva videocamera" : "Attiva videocamera"}>{videoEnabled ? <Video size={13} /> : <Camera size={13} />}</button>}</div>}
  </div>;
}

function ChatDock({ open, onToggle, children, count }: { open: boolean; onToggle: () => void; children: React.ReactNode; count: number }) {
  return <aside className={`room-chat ${open ? "open" : "collapsed"}`} aria-label="Chat della sala"><button className="chat-toggle" onClick={onToggle} aria-expanded={open} aria-label={open ? "Riduci chat" : "Apri chat"}><MessageCircle size={17} /><span>{open ? "Chat di sala" : "Chat"}</span>{count > 0 && <b>{count}</b>}</button>{open && children}</aside>;
}

function ThemePicker({ value, onChange }: { value: TableThemeId; onChange: (theme: TableThemeId) => void }) {
  return <fieldset className="theme-picker"><legend>Atmosfera del tavolo</legend><div>{TABLE_THEMES.map((theme) => <button type="button" key={theme.id} className={value === theme.id ? "selected" : ""} onClick={() => onChange(theme.id)}><span className={`theme-preview ${theme.id}`} /><strong>{theme.name}</strong><small>{theme.note}</small></button>)}</div><p>Scelta puramente grafica: non modifica regole, sala né matchmaking.</p></fieldset>;
}

export default function Home() {
  const { user, loading, error: authError, isAuthenticated } = useAuth();
  const previewParams = new URLSearchParams(window.location.search);
  const demoScenario = previewParams.get("demo");
  const demoMode = Boolean(demoScenario);
  const communicationDemo = demoScenario === "communication";
  const holdDemoEffect = Boolean(demoScenario && demoScenario !== "true");
  const [matchMode, setMatchMode] = useState<"local" | "online">("local");
  const [onlineRoomId, setOnlineRoomId] = useState<string | null>(null);
  const [playersCount, setPlayersCount] = useState(4);
  const [scoreLimit, setScoreLimit] = useState(100);
  const [tableTheme, setTableTheme] = useState<TableThemeId>(() => {
    const saved = window.localStorage.getItem("cotecchio-table-theme");
    return TABLE_THEMES.some((theme) => theme.id === saved) ? saved as TableThemeId : "taverna";
  });
  const [game, setGame] = useState<GameState>(() => createGame(4, 100));
  const [started, setStarted] = useState(demoMode);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(!demoMode);
  const [turnSeconds, setTurnSeconds] = useState(30);
  const [paused, setPaused] = useState(false);
  const [pauseSeconds, setPauseSeconds] = useState(60);
  const [pauseUsed, setPauseUsed] = useState(false);
  const [clockNow, setClockNow] = useState(Date.now());
  const [onlineEntry, setOnlineEntry] = useState<"public" | "private-create" | "private-join">("public");
  const [inviteCode, setInviteCode] = useState("");
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notifiedRoomId, setNotifiedRoomId] = useState<string | null>(null);
  const [tableEffect, setTableEffect] = useState<"pelliccione" | "cappotto" | "finale" | null>(null);
  const [trickToast, setTrickToast] = useState<{ playerId: number; points: number } | null>(null);
  const [matchEndVisible, setMatchEndVisible] = useState(false);
  const [closedInHandThrowing, setClosedInHandThrowing] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [avatarInput, setAvatarInput] = useState("");
  const [ownAvatarUrl, setOwnAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null);
  const mobileAudioOnly = typeof window !== "undefined" && window.matchMedia("(max-width: 620px)").matches;
  const [chatOpen, setChatOpen] = useState(() => previewParams.get("chat") === "open");
  const lastResolvedTrick = useRef("");
  const seenPelliccione = useRef("");
  const seenRoundEffect = useRef("");
  const seenClosedInHand = useRef("");

  const reportError = (error: { message: string }) => toast.error(error.message || "Il tavolo non ha risposto. Riprova.");
  const onlineSnapshot = trpc.match.snapshot.useQuery({ roomId: onlineRoomId ?? "nessuna-sala" }, { enabled: Boolean(onlineRoomId), refetchInterval: onlineRoomId ? 1500 : false, refetchOnWindowFocus: true });
  const joinOnline = trpc.match.join.useMutation({ onSuccess: (data) => { setOnlineRoomId(data.room.id); setSetupOpen(false); }, onError: reportError });
  const createPrivate = trpc.match.createPrivate.useMutation({ onSuccess: (data) => { setOnlineRoomId(data.room.id); setSetupOpen(false); }, onError: reportError });
  const joinPrivate = trpc.match.joinPrivate.useMutation({ onSuccess: (data) => { setOnlineRoomId(data.room.id); setSetupOpen(false); }, onError: reportError });
  const readyOnline = trpc.match.ready.useMutation({ onSuccess: () => onlineSnapshot.refetch(), onError: reportError });
  const playOnline = trpc.match.playCard.useMutation({ onSuccess: () => onlineSnapshot.refetch(), onError: reportError });
  const closeOnline = trpc.match.closeInHand.useMutation({ onSuccess: () => onlineSnapshot.refetch(), onError: reportError });
  const pauseOnline = trpc.match.pause.useMutation({ onSuccess: () => onlineSnapshot.refetch(), onError: reportError });
  const resumeOnline = trpc.match.resume.useMutation({ onSuccess: () => onlineSnapshot.refetch(), onError: reportError });
  const leaveOnline = trpc.match.leave.useMutation({ onSuccess: () => { setOnlineRoomId(null); setStarted(false); setSetupOpen(true); toast.message("Hai lasciato la sala."); }, onError: reportError });
  const voteDeparture = trpc.match.voteDeparture.useMutation({ onSuccess: (data) => { if (data.status === "cancelled") { setOnlineRoomId(null); setStarted(false); setSetupOpen(true); toast.message("La partita è stata annullata senza essere registrata."); } else if (data.status === "continued") { toast.success("La partita riparte senza il giocatore uscente."); onlineSnapshot.refetch(); } else onlineSnapshot.refetch(); }, onError: reportError });
  const nextOnline = trpc.match.nextDeal.useMutation({ onSuccess: () => onlineSnapshot.refetch(), onError: reportError });
  const saveAvatar = trpc.profile.setAvatar.useMutation({ onSuccess: (data) => { setOwnAvatarUrl(data.avatarUrl); setAvatarInput(data.avatarUrl ?? ""); toast.success("Foto profilo aggiornata."); }, onError: reportError });
  const leaderboard = trpc.leaderboard.current.useQuery(undefined, { enabled: leaderboardOpen, refetchOnWindowFocus: false });
  const isOnline = Boolean(onlineRoomId);
  const roomChat = trpc.match.chat.useQuery({ roomId: onlineRoomId ?? "nessuna-sala" }, { enabled: isOnline, refetchInterval: isOnline ? 1500 : false });
  const sendRoomChat = trpc.match.sendChat.useMutation({ onSuccess: () => roomChat.refetch(), onError: reportError });
  const [chatText, setChatText] = useState("");
  const chatEnd = useRef<HTMLDivElement>(null);
  const roomMedia = useRoomMedia(onlineRoomId, user?.id);

  const human = game.players[0];
  const activeTableTheme = TABLE_THEMES.find((theme) => theme.id === tableTheme) ?? TABLE_THEMES[0];
  const activePlayer = game.players[game.turn];
  const leadLabel = game.leadSuit ? SUIT_LABEL[game.leadSuit] : "Apertura libera";
  const ranked = useMemo(() => matchRanking(game), [game]);
  const onlineSeconds = onlineSnapshot.data?.room.turnDeadlineAt ? Math.max(0, Math.ceil((new Date(onlineSnapshot.data.room.turnDeadlineAt).getTime() - clockNow) / 1000)) : 30;
  const ownOnlinePlayer = onlineSnapshot.data?.players.find((player) => player.userId === user?.id);
  const orderedOnlinePlayers = useMemo(() => {
    const players = onlineSnapshot.data?.players ?? [];
    if (!ownOnlinePlayer) return players;
    const seats = Array.from({ length: players.length }, (_, displaySeat) => (ownOnlinePlayer.seat + displaySeat) % players.length);
    return seats.map((seat) => players.find((player) => player.seat === seat)).filter(Boolean);
  }, [onlineSnapshot.data?.players, ownOnlinePlayer]);
  const ownMedia = roomMedia.members.find((member) => member.userId === user?.id) ?? { userId: user?.id ?? 0, audioEnabled: false, videoEnabled: false };
  const onlinePausedUntil = ownOnlinePlayer?.pausedUntil ? new Date(ownOnlinePlayer.pausedUntil).getTime() : 0;
  const onlinePaused = onlinePausedUntil > clockNow;
  const onlinePauseSeconds = Math.max(0, Math.ceil((onlinePausedUntil - clockNow) / 1000));
  const waitSeconds = onlineSnapshot.data?.room.readyDeadlineAt ? Math.max(0, Math.ceil((new Date(onlineSnapshot.data.room.readyDeadlineAt).getTime() - clockNow) / 1000)) : 0;
  const departure = onlineSnapshot.data?.departure;
  const previewEffect = demoScenario === "pelliccione" ? "pelliccione" : demoScenario === "cappotto" ? "cappotto" : demoScenario === "finale" ? "finale" : null;
  const visibleTableEffect = previewEffect ?? tableEffect;
  const visibleTrickToast = demoScenario === "presa" ? { playerId: 1, points: 1 } : trickToast;
  const closedHandDemo = demoScenario === "chiuso" || demoScenario === "chiuso-preview";
  const showingClosedHandThrow = closedInHandThrowing || demoScenario === "chiuso-preview";
  const visibleMediaMembers = communicationDemo ? game.players.map((player, index) => ({ userId: index + 1, audioEnabled: index !== 2, videoEnabled: index === 1 })) : roomMedia.members;
  const visibleChatMessages = communicationDemo ? [{ id: -1, userId: 2, author: "Gina", body: "Buona partita a tutti!" }, { id: -2, userId: 1, author: "Tu", body: "Ciao, sono pronto." }] : roomChat.data ?? [];

  useEffect(() => { if (onlineSnapshot.data?.game) { setGame(onlineSnapshot.data.game); setStarted(onlineSnapshot.data.room.status === "playing"); setSetupOpen(false); } }, [onlineSnapshot.data]);
  useEffect(() => { if (onlineSnapshot.data?.room.status === "cancelled") { setOnlineRoomId(null); setStarted(false); setSetupOpen(true); toast.message("La partita è stata annullata e non è stata registrata."); } }, [onlineSnapshot.data?.room.status]);
  useEffect(() => { setOwnAvatarUrl(user?.avatarUrl ?? null); setAvatarInput(user?.avatarUrl ?? ""); }, [user?.avatarUrl]);
  useEffect(() => { window.localStorage.setItem("cotecchio-table-theme", tableTheme); }, [tableTheme]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [roomChat.data?.length]);
  useEffect(() => {
    if (!demoScenario || demoScenario === "true") return;
    const pelliccione = { id: "bastoni-1", suit: "bastoni" as const, rank: 1 as const };
    const coppeAsso = { id: "coppe-1", suit: "coppe" as const, rank: 1 as const };
    setGame((current) => {
      if (demoScenario === "pelliccione") return { ...current, trick: [{ playerId: 0, card: pelliccione }], leadSuit: "bastoni", phase: "playing" };
      if (demoScenario === "presa") return { ...current, leader: 1, lastTrick: [{ playerId: 1, card: coppeAsso }], phase: "playing" };
      if (demoScenario === "cappotto") return { ...current, phase: "roundEnd", roundAwards: [-16, 16, 16, 16] };
      if (demoScenario === "finale") return { ...current, phase: "matchEnd", roundAwards: [4, 6, 7, 8] };
      if (closedHandDemo) return { ...current, phase: "roundEnd", closedInHandBy: 0, roundAwards: [16, 0, 0, 0] };
      return current;
    });
  }, [closedHandDemo, demoScenario]);
  useEffect(() => { if (typeof window !== "undefined" && window.Notification?.permission === "granted") setNotificationsEnabled(true); }, []);
  useEffect(() => {
    const room = onlineSnapshot.data?.room;
    if (!room || !shouldNotifyTableReady(room.id, room.status, notifiedRoomId)) return;
    setNotifiedRoomId(room.id);
    toast.success("Il tavolo è pronto: la partita comincia ora.");
    dispatchTableReadyNotification("Notification" in window ? { permission: window.Notification.permission, requestPermission: window.Notification.requestPermission.bind(window.Notification), create: (title, options) => { new window.Notification(title, options); } } : null, notificationsEnabled);
  }, [onlineSnapshot.data?.room, notificationsEnabled, notifiedRoomId]);
  useEffect(() => { if (onlineSnapshot.error) reportError(onlineSnapshot.error); }, [onlineSnapshot.error]);
  useEffect(() => { if (!isOnline) return; const clock = window.setInterval(() => setClockNow(Date.now()), 1000); return () => window.clearInterval(clock); }, [isOnline]);
  useEffect(() => setTurnSeconds(30), [game.turn, game.roundIndex]);
  useEffect(() => { if (isOnline || !started || game.phase !== "playing" || paused) return; const timer = window.setInterval(() => setTurnSeconds((seconds) => { if (seconds > 1) return seconds - 1; setGame((current) => autoPlay(current, current.turn)); return 30; }), 1000); return () => window.clearInterval(timer); }, [isOnline, started, game.phase, game.turn, paused]);
  useEffect(() => { if (isOnline || !started || paused || game.phase !== "playing" || (game.turn === 0 && !demoMode)) return; const cpuMove = window.setTimeout(() => setGame((current) => autoPlay(current, current.turn)), 650); return () => window.clearTimeout(cpuMove); }, [isOnline, started, game.phase, game.turn, paused, demoMode]);
  useEffect(() => { if (isOnline || game.phase !== "resolving") return; const resolve = window.setTimeout(() => setGame((current) => resolveTrick(current)), 920); return () => window.clearTimeout(resolve); }, [isOnline, game.phase, game.trick.length]);
  useEffect(() => { if (!paused || isOnline) return; const timer = window.setInterval(() => setPauseSeconds((seconds) => { if (seconds > 1) return seconds - 1; setPaused(false); return 0; }), 1000); return () => window.clearInterval(timer); }, [paused, isOnline]);
  useEffect(() => { const guard = (event: BeforeUnloadEvent) => { if (started && ["playing", "resolving"].includes(game.phase)) { event.preventDefault(); event.returnValue = "La partita in corso sarebbe persa."; } }; window.addEventListener("beforeunload", guard); return () => window.removeEventListener("beforeunload", guard); }, [game.phase, started]);

  function startMatch() { setGame(createGame(playersCount, scoreLimit)); setStarted(true); setSetupOpen(false); setTurnSeconds(30); setPauseUsed(false); setPaused(false); }
  function startOnlineMatch() { if (!isAuthenticated) { startLogin(); return; } if (onlineEntry === "private-create") createPrivate.mutate({ scoreLimit: 100 }); else if (onlineEntry === "private-join") joinPrivate.mutate({ inviteCode }); else joinOnline.mutate({ scoreLimit: 100 }); }
  function enableNotifications() { requestTableNotificationPermission("Notification" in window ? { permission: window.Notification.permission, requestPermission: window.Notification.requestPermission.bind(window.Notification), create: () => undefined } : null).then((result) => { if (result.enabled) { setNotificationsEnabled(true); toast.success("Avvisi del tavolo attivati."); } else if (result.reason === "unsupported") toast.error("Questo browser non supporta gli avvisi."); else toast.error("Autorizza le notifiche del browser per ricevere l’avviso."); }); }
  async function copyInvite() { const code = onlineSnapshot.data?.room.inviteCode; if (!code) return; await navigator.clipboard?.writeText(code); toast.success("Codice invito copiato."); }
  function startNextDeal() { if (onlineRoomId) { nextOnline.mutate({ roomId: onlineRoomId }); return; } setGame((current) => nextDeal(current)); setTurnSeconds(30); }
  function pauseTurn() { if (onlineRoomId) { if (onlinePaused) resumeOnline.mutate({ roomId: onlineRoomId }); else pauseOnline.mutate({ roomId: onlineRoomId }); return; } if (pauseUsed || game.turn !== 0 || game.phase !== "playing") return; setPauseUsed(true); setPauseSeconds(60); setPaused(true); }
  function confirmCloseInHand() { if (!window.confirm("Confermi “Chiuso in mano”? Le mani residue saranno assegnate subito a te. Finché nessun avversario ha già un punto intero, ricevi 16 punti e gli altri 0.")) return; if (onlineRoomId) { closeOnline.mutate({ roomId: onlineRoomId }); return; } setGame((current) => closeInHand(current, 0)); }
  function leaveLobby() { if (onlineRoomId) leaveOnline.mutate({ roomId: onlineRoomId }); }
  function sendChatMessage(event: React.FormEvent) { event.preventDefault(); if (!onlineRoomId || !chatText.trim()) return; sendRoomChat.mutate({ roomId: onlineRoomId, body: chatText }); setChatText(""); }
  async function updateOwnMedia(audioEnabled: boolean, videoEnabled: boolean) { if (!onlineRoomId) return; const effectiveVideo = mobileAudioOnly ? false : videoEnabled; if (!audioEnabled && !effectiveVideo) { await roomMedia.stopAll(); return; } await roomMedia.start({ audio: audioEnabled, video: effectiveVideo }); if (roomMedia.error) toast.error(roomMedia.error); }

  useEffect(() => {
    const key = pelliccioneEventKey(game.roundIndex, game.trick);
    if (!key || seenPelliccione.current === key) return;
    seenPelliccione.current = key;
    setTableEffect("pelliccione");
    if (holdDemoEffect) return;
    const timer = window.setTimeout(() => setTableEffect(null), 1500);
    return () => window.clearTimeout(timer);
  }, [game.roundIndex, game.trick]);

  useEffect(() => {
    if (game.phase !== "roundEnd" || game.closedInHandBy == null) return;
    const key = `${game.roundIndex}-${game.closedInHandBy}-${game.players.map((player) => player.score).join("-")}`;
    if (seenClosedInHand.current === key) return;
    seenClosedInHand.current = key;
    setClosedInHandThrowing(true);
    if (demoScenario === "chiuso-preview") return;
    const timer = window.setTimeout(() => setClosedInHandThrowing(false), 1350);
    return () => window.clearTimeout(timer);
  }, [demoScenario, game.closedInHandBy, game.phase, game.players, game.roundIndex]);

  useEffect(() => {
    if (!game.lastTrick.length) return;
    const key = game.lastTrick.map(({ card }) => card.id).join("|");
    if (lastResolvedTrick.current === key) return;
    lastResolvedTrick.current = key;
    setTrickToast({ playerId: game.leader, points: trickPointTotal(game.lastTrick) });
    if (holdDemoEffect) return;
    const timer = window.setTimeout(() => setTrickToast(null), 1700);
    return () => window.clearTimeout(timer);
  }, [game.lastTrick, game.leader]);

  useEffect(() => {
    if (game.phase !== "roundEnd" && game.phase !== "matchEnd") { setMatchEndVisible(false); return; }
    const key = `${game.roundIndex}-${game.phase}-${game.roundAwards.join(",")}`;
    if (seenRoundEffect.current === key) return;
    seenRoundEffect.current = key;
    const effect = roundEffect(game.phase, game.roundAwards);
    if (game.phase === "roundEnd" && effect === "cappotto") {
      setTableEffect("cappotto");
      if (holdDemoEffect) return;
      const timer = window.setTimeout(() => setTableEffect(null), 1600);
      return () => window.clearTimeout(timer);
    }
    if (game.phase === "matchEnd") {
      setMatchEndVisible(false);
      if (holdDemoEffect) { setTableEffect(effect === "cappotto" ? "cappotto" : "finale"); return; }
      if (effect === "cappotto") {
        setTableEffect("cappotto");
        const first = window.setTimeout(() => setTableEffect("finale"), 1200);
        const second = window.setTimeout(() => { setTableEffect(null); setMatchEndVisible(true); }, 2700);
        return () => { window.clearTimeout(first); window.clearTimeout(second); };
      }
      setTableEffect("finale");
      const timer = window.setTimeout(() => { setTableEffect(null); setMatchEndVisible(true); }, 1600);
      return () => window.clearTimeout(timer);
    }
  }, [game.phase, game.roundIndex, game.roundAwards, holdDemoEffect]);

  useEffect(() => {
    if (game.closedInHandBy == null || (game.phase !== "roundEnd" && game.phase !== "matchEnd")) return;
    const key = `${game.roundIndex}-${game.closedInHandBy}`;
    if (seenClosedInHand.current === key) return;
    seenClosedInHand.current = key;
    const award = game.roundAwards[game.closedInHandBy] ?? 0;
    toast.message(award === 16 ? "Chiuso in mano prima del primo punto intero avversario: 16 punti al dichiarante, 0 agli altri." : "Chiuso in mano dichiarato: le prese residue sono state assegnate.");
  }, [game.closedInHandBy, game.phase, game.roundAwards, game.roundIndex]);

  return <main className={`game-shell table-theme-${tableTheme}`} style={{ "--table-image": `url(${activeTableTheme.image})`, "--felt-image": `url(${FELT_IMAGE})` } as React.CSSProperties}>
    <GameCanvas /><div className="table-background" />
    <header className="game-header"><button className="brand" onClick={() => setSetupOpen(true)} aria-label="Configurazione partita"><img src={LOGO_IMAGE} alt="" /><span><strong>Cotecchio</strong><small>Traversone</small></span></button><div className="header-status"><span className="live-dot" />{isOnline ? "Tavolo online" : "Partita locale"} <span>·</span> mano {game.roundIndex}</div><div className="header-actions">{isAuthenticated && <button className="user-stamp" onClick={() => setProfileOpen(true)}>{user?.name ?? "Giocatore"}</button>}<button className="icon-button" onClick={() => setRulesOpen(true)} aria-label="Regole"><CircleHelp size={19} /></button><button className="icon-button" onClick={() => setLeaderboardOpen(true)} aria-label="Classifica stagionale"><Medal size={19} /></button><button className="score-button" onClick={() => setScoreOpen(true)}><Trophy size={16} /> Match</button></div></header>
    <section className="playfield" aria-label="Tavolo di gioco"><div className="table-ring"><div className="felt-surface" /></div>{visibleTableEffect && <div className={`table-omen ${visibleTableEffect} ${previewEffect ? "preview" : ""}`} role="status"><span>{visibleTableEffect === "pelliccione" ? "✦" : visibleTableEffect === "cappotto" ? "✹" : "♛"}</span><strong>{visibleTableEffect === "pelliccione" ? "Pelliccione!" : visibleTableEffect === "cappotto" ? "Cappotto!" : "Partita conclusa"}</strong><small>{visibleTableEffect === "pelliccione" ? "Asso di bastoni · 6 punti" : visibleTableEffect === "cappotto" ? "Sedici punti al tavolo" : "I conti del tavolo sono definitivi"}</small></div>}{visibleTrickToast && <div className={`trick-score dynamic ${demoScenario === "presa" ? "preview" : ""}`} style={tablePosition(visibleTrickToast.playerId, game.playerCount, 35, 27)}><strong>+{visibleTrickToast.points % 1 === 0 ? visibleTrickToast.points : visibleTrickToast.points.toFixed("2").replace(".", ",")}</strong><span>presa</span></div>}{game.players.slice(1).map((player) => { const participant = orderedOnlinePlayers[player.id]; const media = participant ? visibleMediaMembers.find((member) => member.userId === participant.userId) : communicationDemo ? visibleMediaMembers[player.id] : undefined; return <article className="opponent-seat dynamic" style={tablePosition(player.id, game.playerCount, 43, 34)} key={player.id}>{(isOnline || communicationDemo) && <PlayerMediaTile name={player.name} avatarUrl={participant?.avatarUrl ?? null} stream={media ? roomMedia.remoteStreams[media.userId] : undefined} videoEnabled={!mobileAudioOnly && (media?.videoEnabled ?? false)} audioEnabled={media?.audioEnabled ?? false} />}<div className="opponent-name"><span className={game.turn === player.id ? "turn-lamp active" : "turn-lamp"} />{player.name}<small>{player.score} pt</small></div><MiniFan count={player.hand.length} /></article>; })}
      <section className="trick-zone"><div className="lead-indicator"><SuitPip suit={game.leadSuit} /><span>{leadLabel}</span></div><div className={`trick-cards ${game.phase === "resolving" ? "resolving" : ""}`}>{game.trick.map(({ playerId, card }) => <div className="trick-card dynamic" style={tablePosition(playerId, game.playerCount, 34, 26)} key={`${playerId}-${card.id}`}><PiacentineCard card={card} small /><span>{game.players[playerId].name}</span></div>)}{!game.trick.length && <div className="center-emblem"><img src={TOKEN_IMAGE} alt="" /><span>{game.turn === 0 ? "Tocca a te" : `${activePlayer?.name ?? ""} apre`}</span></div>}</div></section>
      <aside className="table-sidecard"><div><span>Limite</span><strong>{game.scoreLimit}</strong></div><div><span>Scarti</span><strong>{game.discarded.length || "—"}</strong></div><button onClick={() => setScoreOpen(true)}><ChevronRight size={15} /> dettagli</button>{isOnline && <button disabled={leaveOnline.isPending} onClick={() => { if (window.confirm("Vuoi abbandonare la partita? Gli altri giocatori decideranno se continuare.")) leaveOnline.mutate({ roomId: onlineRoomId! }); }}>Abbandona partita</button>}</aside>
      <button className="close-in-hand-toolbar" disabled={Boolean(departure) || closeOnline.isPending || game.phase !== "playing" || game.turn !== 0} onClick={confirmCloseInHand}>Chiuso in mano</button>
      <section className="human-zone"><div className="human-meta">{(isOnline || communicationDemo) && <PlayerMediaTile name={human?.name ?? user?.name ?? "Tu"} avatarUrl={ownAvatarUrl} stream={roomMedia.localStream ?? undefined} videoEnabled={!mobileAudioOnly && (communicationDemo ? false : ownMedia.videoEnabled)} audioEnabled={communicationDemo ? true : ownMedia.audioEnabled} own={!communicationDemo} onAudio={() => updateOwnMedia(!ownMedia.audioEnabled, ownMedia.videoEnabled)} onVideo={() => updateOwnMedia(ownMedia.audioEnabled, !ownMedia.videoEnabled)} videoAllowed={!mobileAudioOnly} />}<div><span className="eyebrow">La tua mano</span><strong>{human?.score ?? 0} punti</strong></div><div className={`turn-timer ${game.turn === 0 && game.phase === "playing" ? "active" : ""}`}><Timer size={16} /><span>{(paused || onlinePaused) ? "Pausa" : `00:${String(isOnline ? onlineSeconds : turnSeconds).padStart(2, "0")}`}</span></div><button className="pause-button" onClick={pauseTurn} disabled={Boolean(departure) || (isOnline ? (pauseOnline.isPending || resumeOnline.isPending) : pauseUsed) || game.turn !== 0 || game.phase !== "playing"}><Pause size={14} /> {isOnline && onlinePaused ? "Riprendi" : isOnline ? "Pausa" : pauseUsed ? "Pausa usata" : "Pausa"}</button></div><div className="hand-area">{human?.hand.map((card) => <PiacentineCard key={card.id} card={card} disabled={Boolean(departure) || !isLegalForHuman(game, card) || paused || onlinePaused || playOnline.isPending} onClick={() => { if (onlineRoomId) playOnline.mutate({ roomId: onlineRoomId, cardId: card.id }); else { setGame((current) => playCard(current, 0, card.id)); setTurnSeconds(30); } }} />)}</div><p className="turn-message">{departure ? "La partita attende la decisione degli altri giocatori dopo un abbandono." : roomMedia.error ?? (onlinePaused ? `Pausa online: ${onlinePauseSeconds}s` : paused ? `Tavolo in attesa: ${pauseSeconds}s` : game.phase === "playing" ? game.turn === 0 ? game.leadSuit ? `Tocca a te: rispondi a ${SUIT_LABEL[game.leadSuit]}.` : "Tocca a te: apri la presa." : `${activePlayer?.name} sta sul tavolo.` : game.phase === "resolving" ? "La presa va al suo padrone…" : "Conti fatti: chiudi la mano.")}</p></section>
      {(isOnline || communicationDemo) && <ChatDock open={chatOpen} onToggle={() => setChatOpen((open) => !open)} count={visibleChatMessages.length}><div className="room-chat-log">{roomChat.isLoading && !communicationDemo ? <p>Carico i messaggi…</p> : visibleChatMessages.length ? visibleChatMessages.map((message) => <div className={message.userId === user?.id || (communicationDemo && message.userId === 1) ? "own" : ""} key={message.id}><strong>{message.userId === user?.id || (communicationDemo && message.userId === 1) ? "Tu" : message.author}</strong><span>{message.body}</span></div>) : <p>Rompi il ghiaccio: saluta il tavolo.</p>}<div ref={chatEnd} /></div><form onSubmit={sendChatMessage}><input value={chatText} onChange={(event) => setChatText(event.target.value)} maxLength={600} placeholder="Scrivi alla sala…" aria-label="Messaggio chat" /><button disabled={communicationDemo || sendRoomChat.isPending || !chatText.trim()} aria-label="Invia messaggio"><Send size={15} /></button></form></ChatDock>}
    </section>
    {(paused || onlinePaused) && <div className="pause-scrim"><section><Pause size={30} /><p className="eyebrow">Tavolo in attesa</p><h2>Pausa di un minuto</h2><strong>00:{String(onlinePaused ? onlinePauseSeconds : pauseSeconds).padStart(2, "0")}</strong><button onClick={() => onlinePaused && onlineRoomId ? resumeOnline.mutate({ roomId: onlineRoomId }) : setPaused(false)}>Sono pronto a giocare</button></section></div>}
    {isOnline && departure && <Overlay title="Abbandono al tavolo" onClose={() => undefined}><p className="overlay-intro"><strong>{departure.playerName}</strong> ha abbandonato. La smazzata in corso verrà annullata; decidete se ripartire senza di lui o concludere senza registrare la partita.</p>{departure.canContinue ? <div className="departure-actions"><button className="primary-action" disabled={voteDeparture.isPending} onClick={() => voteDeparture.mutate({ roomId: onlineRoomId!, vote: "continue" })}>Continuiamo</button><button className="quiet-action" disabled={voteDeparture.isPending} onClick={() => voteDeparture.mutate({ roomId: onlineRoomId!, vote: "end" })}>Concludiamo la partita</button></div> : <p className="overlay-intro">Non restano almeno tre giocatori: la partita verrà annullata senza storico.</p>}</Overlay>}
    {showingClosedHandThrow && <div className="closed-hand-throw" role="status" aria-label="Lancio nervoso delle carte"><strong>Chiuso in mano!</strong><span>Le carte volano sul tavolo</span>{[0, 1, 2, 3, 4].map((index) => <i key={index} style={{ backgroundImage: `url(${BACK_CARD})` }} />)}</div>}
    {started && game.phase === "roundEnd" && !showingClosedHandThrow && <Overlay title="Smazzata conclusa" onClose={startNextDeal}><p className="overlay-intro">{game.closedInHandBy != null ? game.roundAwards[game.closedInHandBy] === 16 ? `${game.players[game.closedInHandBy].name} ha dichiarato Chiuso in mano prima del primo punto intero avversario: +16 punti al dichiarante e 0 agli altri.` : `${game.players[game.closedInHandBy].name} ha dichiarato Chiuso in mano: le prese residue sono state assegnate.` : "I punti di questa mano sono stati registrati. Ricorda: qui vince chi accumula meno."}</p><div className="award-list">{game.players.map((player, index) => <div key={player.id}><span>{player.name}</span><strong className={game.roundAwards[index] < 0 ? "good" : ""}>{game.roundAwards[index] > 0 ? "+" : ""}{game.roundAwards[index]} pt</strong><small>{game.roundAbbuono[index] ? `abbuono −${game.roundAbbuono[index]} · ` : ""}totale {player.score}</small></div>)}</div><button className="primary-action" onClick={startNextDeal}>Distribuisci la prossima mano <ChevronRight size={17} /></button></Overlay>}
    {started && game.phase === "matchEnd" && matchEndVisible && <Overlay title="Partita conclusa" onClose={() => setSetupOpen(true)}><p className="overlay-intro">È arrivato il primo sballo oltre {game.scoreLimit} punti. La vittoria va al punteggio più basso.</p><div className="ranking-list">{ranked.map((player) => <div key={player.id}><b>{player.place}º</b><span>{player.name}</span><strong>{player.score} pt</strong><small>+{player.leaguePoints} classifica</small></div>)}</div><button className="primary-action" onClick={() => { setSetupOpen(true); setStarted(false); }}><RotateCcw size={17} /> Nuova partita</button></Overlay>}
    {scoreOpen && <Overlay title="Classifica del match" onClose={() => setScoreOpen(false)}><p className="overlay-intro">Punteggio più basso in testa. Il limite è {game.scoreLimit} punti.</p><div className="ranking-list compact">{ranked.map((player) => <div key={player.id}><b>{player.place}º</b><span>{player.name}</span><strong>{player.score} pt</strong><small>{player.tricks} prese</small></div>)}</div>{game.discarded.length > 0 && <div className="discard-note"><span>Carte scartate, note al tavolo</span><div>{game.discarded.map((card) => <span key={card.id}>{RANK_LABEL[card.rank]} {SUIT_LABEL[card.suit]}</span>)}</div></div>}</Overlay>}
    {rulesOpen && <Overlay title="Regole al tavolo" onClose={() => setRulesOpen(false)}><div className="rules-copy"><p><strong>Risposta obbligatoria.</strong> Se possiedi il palo della prima carta, devi giocarlo. L’ordine è 3, 2, asso, re, cavallo, fante, 7, 6, 5, 4.</p><p><strong>Conta il meno.</strong> Asso 1 punto; 3, 2 e figure un terzo; l’asso di bastoni è il Pelliccione e vale 6. Dopo la smazzata i punti, tranne l’ultima presa, si arrotondano per difetto.</p><p><strong>Abbuono.</strong> A fine smazzata, chi ha il punteggio minore ottiene una riduzione secondo il numero di giocatori e gli eventuali pari merito. Il cappotto esclude sempre l’abbuono.</p><p><strong>Ultima presa.</strong> Chi la vince riceve il complemento a 16. Con 16 punti fa cappotto: prende −16 e tutti gli altri +16.</p></div></Overlay>}
    {leaderboardOpen && <Overlay title="Classifica stagionale" onClose={() => setLeaderboardOpen(false)}><p className="overlay-intro">{leaderboard.isLoading ? "Calcolo la media dei risultati…" : leaderboard.data ? `Stagione ${leaderboard.data.seasonYear}: media crescente; servono 5 partite per essere validi.` : "La classifica non è disponibile."}</p>{leaderboard.data && <div className="season-list">{leaderboard.data.entries.length ? leaderboard.data.entries.map((entry) => <div className={entry.status === "provisional" ? "provisional" : ""} key={entry.userId}><b>{entry.place ? `${entry.place}º` : "—"}</b><span>{entry.name}</span><strong>{entry.averageScore.toFixed(2)}</strong><small>{entry.resultCount}/5 partite · {entry.status === "valid" ? "valido" : "provvisorio"}</small></div>) : <p className="overlay-intro">Nessun risultato stagionale valido, per ora.</p>}</div>}</Overlay>}
    {onlineRoomId && !onlineSnapshot.data?.game && <Overlay title="Sala d’attesa" onClose={leaveLobby}><p className="overlay-intro">{onlineSnapshot.isLoading ? "Sto collegando il tuo posto al tavolo…" : onlineSnapshot.isError ? "Il tavolo non risponde: continuo a tentare la riconnessione." : `La sala è aperta: partite da tre giocatori. Se tutti i presenti sono pronti, iniziate subito; altrimenti l’attesa termina tra ${Math.ceil(waitSeconds / 60)} min.`}</p><div className="lobby-code"><Wifi size={18} /><span>{onlineSnapshot.data?.room.activePlayerCount ?? 0} partecipanti al tavolo</span></div>{onlineSnapshot.data?.room.visibility === "private" && <div className="invite-card"><KeyRound size={18} /><span>Codice privato <strong>{onlineSnapshot.data.room.inviteCode}</strong></span><button onClick={copyInvite} aria-label="Copia codice invito"><Copy size={15} /> Copia</button></div>}{onlineSnapshot.data?.players?.length ? <div className="ranking-list compact">{onlineSnapshot.data.players.map((player) => <div key={player.userId}><b>{player.seat + 1}</b><span>{player.name}</span><strong>{player.ready ? "Pronto" : "Al tavolo"}</strong></div>)}</div> : !onlineSnapshot.isLoading && <p className="overlay-intro">Nessun posto confermato al momento.</p>}<div className="waiting-chat"><strong><MessageCircle size={14} /> Chat di sala</strong><div>{roomChat.data?.length ? roomChat.data.slice(-4).map((message) => <p key={message.id}><b>{message.userId === user?.id ? "Tu" : message.author}:</b> {message.body}</p>) : <p>Nessun messaggio, per ora.</p>}</div><form onSubmit={sendChatMessage}><input value={chatText} onChange={(event) => setChatText(event.target.value)} maxLength={600} placeholder="Scrivi alla sala…" /><button disabled={sendRoomChat.isPending || !chatText.trim()} aria-label="Invia messaggio"><Send size={14} /></button></form></div><button className="primary-action" disabled={readyOnline.isPending || onlineSnapshot.isLoading || onlineSnapshot.isError} onClick={() => readyOnline.mutate({ roomId: onlineRoomId })}>Sono pronto <ChevronRight size={17} /></button><button className="quiet-action" onClick={enableNotifications}><Bell size={15} /> {notificationsEnabled ? "Avvisi attivi" : "Avvisami quando il tavolo è pronto"}</button><button className="quiet-action" disabled={leaveOnline.isPending} onClick={leaveLobby}>Lascia la sala</button></Overlay>}
    {setupOpen && <div className="setup-overlay"><section className="setup-card"><img src={LOGO_IMAGE} alt="Emblema Cotecchio" className="setup-logo" style={{ width: 100, height: 100, borderRadius: 170, backgroundColor: "#f6efdf", objectFit: "cover" }} /><div><p className="eyebrow">Gioco di carte</p><h1>Cotecchio</h1><p className="setup-subtitle">Il più nobile dei nobili giochi</p></div><div className="setup-mode"><button className={matchMode === "local" ? "selected" : ""} onClick={() => setMatchMode("local")}>Locale · CPU</button><button className={matchMode === "online" ? "selected" : ""} onClick={() => { setMatchMode("online"); setScoreLimit(100); }}><Wifi size={15} /> Online</button></div><ThemePicker value={tableTheme} onChange={setTableTheme} />{matchMode === "online" && <div className="entry-mode"><button className={onlineEntry === "public" ? "selected" : ""} onClick={() => setOnlineEntry("public")}>Pubblica</button><button className={onlineEntry === "private-create" ? "selected" : ""} onClick={() => setOnlineEntry("private-create")}>Crea privata</button><button className={onlineEntry === "private-join" ? "selected" : ""} onClick={() => setOnlineEntry("private-join")}>Entra con codice</button></div>}<div className={`setup-grid ${matchMode === "online" ? "online-grid" : ""}`}>{matchMode === "local" && <label><span><Users size={16} /> Giocatori</span><select value={playersCount} onChange={(event) => setPlayersCount(Number(event.target.value))}>{[3, 4, 5, 6, 7, 8].map((count) => <option key={count} value={count}>{count} giocatori</option>)}</select></label>}<label><span><Trophy size={16} /> Limite partita</span><select value={matchMode === "online" ? 100 : scoreLimit} onChange={(event) => setScoreLimit(Number(event.target.value))} disabled={matchMode === "online"}>{[50, 75, 100, 125, 150].map((limit) => <option key={limit} value={limit}>{limit} punti</option>)}</select></label></div>{matchMode === "online" && onlineEntry === "private-join" && <label className="invite-input"><span><KeyRound size={16} /> Codice invito</span><input value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} placeholder="COTE..." maxLength={16} /></label>}<div className="setup-note">{matchMode === "online" ? <><Wifi size={17} /><span>{loading ? "Controllo dell’accesso in corso…" : authError ? "L’accesso non è disponibile: riprova tra poco." : onlineEntry === "private-create" ? "Crea un tavolo riservato a 100 punti: parte da tre giocatori dopo tre minuti, o subito quando tutti i presenti sono pronti." : onlineEntry === "private-join" ? "Inserisci il codice ricevuto per sederti al tavolo privato da 100 punti." : isAuthenticated ? "Entra in una sala aperta da 100 punti: si gioca da tre partecipanti dopo tre minuti, o subito con tutti pronti." : "Accedi per cercare avversari, creare una sala e giocare online."}</span></> : <><BookOpen size={17} /><span>Ogni giocatore ha 30 secondi e una pausa da un minuto. In questa modalità giochi contro la CPU.</span></>}</div><button className="primary-action large" disabled={joinOnline.isPending || createPrivate.isPending || joinPrivate.isPending || loading || (onlineEntry === "private-join" && !inviteCode.trim())} onClick={matchMode === "online" ? startOnlineMatch : startMatch}>{matchMode === "online" ? loading ? "Controllo accesso…" : !isAuthenticated ? <>Accedi per giocare <LogIn size={18} /></> : onlineEntry === "private-create" ? <>Crea tavolo privato <KeyRound size={18} /></> : onlineEntry === "private-join" ? <>Entra al tavolo <ChevronRight size={18} /></> : <>Cerca avversari <Wifi size={18} /></> : <>Siediti al tavolo <ChevronRight size={18} /></>}</button><button className="quiet-action" onClick={() => setRulesOpen(true)}>Leggi le regole essenziali</button></section></div>}
    {profileOpen && <Overlay title="Foto profilo" onClose={() => setProfileOpen(false)}><p className="overlay-intro">Quando non condividi il video, questa foto appare al tavolo. Incolla un indirizzo HTTPS dell’immagine oppure svuota il campo per usare le iniziali.</p><label className="invite-input"><span>Indirizzo foto profilo</span><input value={avatarInput} onChange={(event) => setAvatarInput(event.target.value)} placeholder="https://…" /></label><button className="primary-action" disabled={saveAvatar.isPending} onClick={() => saveAvatar.mutate({ avatarUrl: avatarInput })}>Salva foto profilo</button></Overlay>}
  </main>;
}
