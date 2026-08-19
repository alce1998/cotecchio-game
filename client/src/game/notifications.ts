export function shouldNotifyTableReady(roomId: string | null, status: string | undefined, notifiedRoomId: string | null) {
  return Boolean(roomId && status === "playing" && notifiedRoomId !== roomId);
}
