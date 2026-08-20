import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.alce.cotecchio",
  appName: "Cotecchio",
  webDir: "dist/public",
  server: {
    url: "https://cotecchio-game--cotecchio-5f16c.europe-west4.hosted.app",
    cleartext: true,
    allowNavigation: ["cotecchio-game--cotecchio-5f16c.europe-west4.hosted.app", "*.hosted.app", "accounts.google.com"],
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
};

export default config;
