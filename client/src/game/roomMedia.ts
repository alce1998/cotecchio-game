export type RoomMediaOptions = { audio: boolean; video: boolean };

export function normalizeRoomMediaOptions(options: RoomMediaOptions, mobileAudioOnly: boolean): RoomMediaOptions {
  return { audio: options.audio, video: mobileAudioOnly ? false : options.video };
}

export async function requestRoomMedia(getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>, options: RoomMediaOptions) {
  try {
    const stream = await getUserMedia({ audio: options.audio, video: options.video });
    return { stream, error: null } as const;
  } catch {
    return { stream: null, error: "Il browser non ha autorizzato microfono o videocamera." } as const;
  }
}

export function stopRoomMedia(stream: Pick<MediaStream, "getTracks"> | null) {
  stream?.getTracks().forEach((track) => track.stop());
}
