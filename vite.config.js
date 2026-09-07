import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  return {
  plugins: [react(), tailwindcss()],
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  // SUPABASE_ también incluye secretos del servidor: exponer sólo valores públicos.
  define: Object.fromEntries(["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY"]
    .filter((key) => env[key])
    .map((key) => [`import.meta.env.${key}`, JSON.stringify(env[key])])),
  build: {
    rollupOptions: {
      output: {
        // React aparte: se cachea y no se re-descarga en cada deploy
        manualChunks: {
          vendor: ["react", "react-dom"],
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    hmr: {
      port: 3000,
    },
  },
  };
});
