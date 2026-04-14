import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.reparilo.app",
  appName: "Reparilo",
  webDir: "dist",
  server: {
    ...(process.env.NODE_ENV === "development" && {
      url: "http://localhost:5173",
      cleartext: true,
    }),
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
    },
  },
};

export default config;
