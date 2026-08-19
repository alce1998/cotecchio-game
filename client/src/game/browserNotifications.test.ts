import { describe, expect, it, vi } from "vitest";
import { dispatchTableReadyNotification, requestTableNotificationPermission } from "./browserNotifications";

describe("permessi browser per avvisi tavolo", () => {
  it("attiva le notifiche quando il browser concede il permesso", async () => {
    const requestPermission = vi.fn().mockResolvedValue("granted");
    const create = vi.fn();
    const api = { permission: "default" as NotificationPermission, requestPermission, create };
    await expect(requestTableNotificationPermission(api)).resolves.toMatchObject({ enabled: true, reason: "granted" });
    expect(requestPermission).toHaveBeenCalledOnce();
  });

  it("mantiene il fallback quando il browser nega il permesso e avvisa una sola volta quando concesso", async () => {
    const denied = { permission: "denied" as NotificationPermission, requestPermission: vi.fn(), create: vi.fn() };
    await expect(requestTableNotificationPermission(denied)).resolves.toMatchObject({ enabled: false, reason: "denied" });
    expect(dispatchTableReadyNotification(denied, true)).toBe(false);
    const create = vi.fn();
    const granted = { permission: "granted" as NotificationPermission, requestPermission: vi.fn(), create };
    expect(dispatchTableReadyNotification(granted, true)).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
  });
});
