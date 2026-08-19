import { trpc } from "@/lib/trpc";
import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeRoomMediaOptions, requestRoomMedia, stopRoomMedia } from "@/game/roomMedia";

type Participant = { userId: number; audioEnabled: boolean; videoEnabled: boolean };
type SignalKind = "offer" | "answer" | "candidate";

const rtcConfig: RTCConfiguration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

export function useRoomMedia(roomId: string | null, ownUserId: number | undefined) {
  const mobileAudioOnly = typeof window !== "undefined" && window.matchMedia("(max-width: 620px)").matches;
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<number, MediaStream>>({});
  const [error, setError] = useState<string | null>(null);
  const peers = useRef(new Map<number, RTCPeerConnection>());
  const pendingCandidates = useRef(new Map<number, RTCIceCandidateInit[]>());
  const lastSignalId = useRef(0);
  const media = trpc.match.media.useQuery({ roomId: roomId ?? "nessuna-sala" }, { enabled: Boolean(roomId), refetchInterval: roomId ? 1800 : false });
  const signals = trpc.match.signals.useQuery({ roomId: roomId ?? "nessuna-sala", afterId: lastSignalId.current }, { enabled: Boolean(roomId && ownUserId), refetchInterval: roomId ? 1000 : false });
  const setMedia = trpc.match.setMedia.useMutation();
  const sendSignal = trpc.match.signal.useMutation();

  const stopAll = useCallback(async () => {
    stopRoomMedia(localStream);
    peers.current.forEach((peer) => peer.close());
    peers.current.clear();
    setLocalStream(null);
    setRemoteStreams({});
    if (roomId) await setMedia.mutateAsync({ roomId, audioEnabled: false, videoEnabled: false });
  }, [localStream, roomId, setMedia]);

  const send = useCallback((toUserId: number, kind: SignalKind, payload: unknown) => {
    if (!roomId) return;
    sendSignal.mutate({ roomId, toUserId, kind, payload: JSON.stringify(payload) });
  }, [roomId, sendSignal]);

  const peerFor = useCallback((remoteUserId: number) => {
    const existing = peers.current.get(remoteUserId);
    if (existing) return existing;
    const peer = new RTCPeerConnection(rtcConfig);
    peer.addTransceiver("audio", { direction: "recvonly" });
    if (!mobileAudioOnly) peer.addTransceiver("video", { direction: "recvonly" });
    localStream?.getTracks().forEach((track) => peer.addTrack(track, localStream));
    peer.onicecandidate = (event) => { if (event.candidate) send(remoteUserId, "candidate", event.candidate.toJSON()); };
    peer.ontrack = (event) => setRemoteStreams((current) => ({ ...current, [remoteUserId]: event.streams[0] }));
    peer.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(peer.connectionState)) setRemoteStreams((current) => { const next = { ...current }; delete next[remoteUserId]; return next; });
    };
    peers.current.set(remoteUserId, peer);
    return peer;
  }, [localStream, mobileAudioOnly, send]);

  const start = useCallback(async (options: { audio: boolean; video: boolean }) => {
    if (!roomId || !ownUserId || (!options.audio && !options.video)) return;
    try {
      setError(null);
      const effective = normalizeRoomMediaOptions(options, mobileAudioOnly);
      if (localStream) {
        const needAudio = effective.audio && !localStream.getAudioTracks().length;
        const needVideo = effective.video && !localStream.getVideoTracks().length;
        if (!needAudio && !needVideo) {
          localStream.getAudioTracks().forEach((track) => { track.enabled = effective.audio; });
          localStream.getVideoTracks().forEach((track) => { track.enabled = effective.video; });
          await setMedia.mutateAsync({ roomId, audioEnabled: effective.audio, videoEnabled: effective.video });
          return;
        }
        const extra = await requestRoomMedia(navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices), { audio: needAudio, video: needVideo });
        if (!extra.stream) throw new Error(extra.error ?? "Media non disponibile");
        const combined = new MediaStream([...localStream.getTracks(), ...extra.stream.getTracks()]);
        combined.getAudioTracks().forEach((track) => { track.enabled = effective.audio; });
        combined.getVideoTracks().forEach((track) => { track.enabled = effective.video; });
        peers.current.forEach((peer) => peer.close());
        peers.current.clear();
        setRemoteStreams({});
        setLocalStream(combined);
        await setMedia.mutateAsync({ roomId, audioEnabled: effective.audio, videoEnabled: effective.video });
        return;
      }
      const result = await requestRoomMedia(navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices), effective);
      if (!result.stream) throw new Error(result.error ?? "Media non disponibile");
      const stream = result.stream;
      peers.current.forEach((peer) => peer.close());
      peers.current.clear();
      setRemoteStreams({});
      setLocalStream(stream);
      await setMedia.mutateAsync({ roomId, audioEnabled: effective.audio, videoEnabled: effective.video });
    } catch {
      setError("Il browser non ha autorizzato microfono o videocamera.");
      await setMedia.mutateAsync({ roomId, audioEnabled: false, videoEnabled: false });
    }
  }, [localStream, roomId, ownUserId, setMedia]);

  useEffect(() => {
    if (!roomId || !ownUserId) return;
    const remoteParticipants = (media.data ?? []).filter((member: Participant) => member.userId !== ownUserId);
    remoteParticipants.filter((member: Participant) => ownUserId < member.userId).forEach(async (member: Participant) => {
      const peer = peerFor(member.userId);
      if (peer.signalingState !== "stable") return;
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      send(member.userId, "offer", offer);
    });
  }, [localStream, media.data, ownUserId, peerFor, roomId, send]);

  useEffect(() => {
    if (!signals.data || !ownUserId) return;
    signals.data.forEach(async (signal) => {
      if (signal.id <= lastSignalId.current) return;
      lastSignalId.current = signal.id;
      const peer = peerFor(signal.fromUserId);
      const payload = JSON.parse(signal.payload) as RTCSessionDescriptionInit | RTCIceCandidateInit;
      if (signal.kind === "offer") {
        await peer.setRemoteDescription(payload as RTCSessionDescriptionInit);
        const queued = pendingCandidates.current.get(signal.fromUserId) ?? [];
        await Promise.all(queued.map((candidate) => peer.addIceCandidate(candidate).catch(() => undefined)));
        pendingCandidates.current.delete(signal.fromUserId);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        send(signal.fromUserId, "answer", answer);
      } else if (signal.kind === "answer") {
        await peer.setRemoteDescription(payload as RTCSessionDescriptionInit);
        const queued = pendingCandidates.current.get(signal.fromUserId) ?? [];
        await Promise.all(queued.map((candidate) => peer.addIceCandidate(candidate).catch(() => undefined)));
        pendingCandidates.current.delete(signal.fromUserId);
      } else if (peer.remoteDescription) {
        await peer.addIceCandidate(payload as RTCIceCandidateInit).catch(() => undefined);
      } else {
        const queued = pendingCandidates.current.get(signal.fromUserId) ?? [];
        queued.push(payload as RTCIceCandidateInit);
        pendingCandidates.current.set(signal.fromUserId, queued);
      }
    });
  }, [ownUserId, peerFor, send, signals.data]);

  useEffect(() => () => { localStream?.getTracks().forEach((track) => track.stop()); peers.current.forEach((peer) => peer.close()); }, [localStream]);

  return { members: (media.data ?? []) as Participant[], localStream, remoteStreams, error, start, stopAll, isStarting: setMedia.isPending };
}
