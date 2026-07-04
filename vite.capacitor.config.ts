import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";

const SUPABASE_URL = "https://iiafmwsjvduswcmmsurz.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpYWZtd3NqdmR1c3djbW1zdXJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3MTUzNzksImV4cCI6MjA5ODI5MTM3OX0.BDiUdGpUnXqCGhkwZUg2h3n4m2V9o46cSzUUllK3xcM";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const appVersion = env.VITE_APP_VERSION ?? "1.0.0";

  return {
    plugins: [react(), tailwindcss(), tsconfigPaths()],
    root: ".",
    build: {
      chunkSizeWarningLimit: 3000,
      rollupOptions: {
        input: path.resolve(__dirname, "index.capacitor.html"),
        output: {
          manualChunks(id) {
            if (id.includes("lucide-react")) return "vendor-icons";
            if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/")) return "vendor-react";
            if (id.includes("node_modules/@supabase")) return "vendor-supabase";
            if (id.includes("node_modules/@radix-ui")) return "vendor-radix";
            if (id.includes("node_modules/@tanstack")) return "vendor-tanstack";
            if (id.includes("node_modules/@capacitor")) return "vendor-capacitor";
            if (id.includes("node_modules/zustand")) return "vendor-zustand";
          },
        },
        treeshake: {
          moduleSideEffects: false,
          propertyReadSideEffects: false,
        },
      },
      outDir: "dist/client",
      emptyOutDir: true,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(SUPABASE_URL),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(SUPABASE_KEY),
      "import.meta.env.VITE_APP_VERSION": JSON.stringify(appVersion),
      // TanStack Start SSR globals — not used in Capacitor but prevent undefined errors
      "import.meta.env.SSR": JSON.stringify(false),
    },
  };
});
