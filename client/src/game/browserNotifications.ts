export type BrowserNotificationApi = {
  permission: NotificationPermission;
  requestPermission: () => Promise<NotificationPermission>;
  create: (title: string, options: NotificationOptions) => void;
};

export async function requestTableNotificationPermission(api: BrowserNotificationApi | null) {
  if (!api) return { enabled: false, reason: "unsupported" as const };
  const permission = api.permission === "default" ? await api.requestPermission() : api.permission;
  return { enabled: permission === "granted", reason: permission === "granted" ? "granted" as const : "denied" as const };
}

export function dispatchTableReadyNotification(api: BrowserNotificationApi | null, enabled: boolean) {
  if (!api || !enabled || api.permission !== "granted") return false;
  api.create("Cotecchio", { body: "Il tuo tavolo è pronto: entra in partita." });
  return true;
}
