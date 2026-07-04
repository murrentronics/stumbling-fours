import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.stumblingfours.app",
  appName: "Stumbling Fours",
  webDir: "dist/client",
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      showSpinner: false,
      backgroundColor: "#0a0a0a",
    },
    Browser: {},
    Keyboard: {
      resize: "body",
      style: "dark",
      resizeOnFullScreen: true,
    },
  },
  android: {
    backgroundColor: "#0a0a0a",
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
