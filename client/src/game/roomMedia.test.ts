import { describe, expect, it, vi } from "vitest";
import { normalizeRoomMediaOptions, requestRoomMedia, stopRoomMedia } from "./roomMedia";

describe("consenso audio e video della sala", () => {
  it("mantiene il flusso quando il browser concede il consenso", async () => {
    const stream = { getTracks: () => [] } as unknown as MediaStream;
    const result = await requestRoomMedia(vi.fn().mockResolvedValue(stream), { audio: true, video: false });
    expect(result.stream).toBe(stream);
    expect(result.error).toBeNull();
  });

  it("espone un messaggio chiaro quando il consenso è negato", async () => {
    const result = await requestRoomMedia(vi.fn().mockRejectedValue(new Error("denied")), { audio: true, video: true });
    expect(result.stream).toBeNull();
    expect(result.error).toContain("non ha autorizzato");
  });

  it("ferma tutte le tracce quando l’utente revoca la condivisione", () => {
    const stop = vi.fn();
    stopRoomMedia({ getTracks: () => [{ stop }] } as unknown as MediaStream);
    expect(stop).toHaveBeenCalledOnce();
  });

  it("richiede solo l’audio su mobile anche quando l’utente attiva il video", () => {
    expect(normalizeRoomMediaOptions({ audio: true, video: true }, true)).toEqual({ audio: true, video: false });
  });
});
