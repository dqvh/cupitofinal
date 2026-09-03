import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Vite expone a import.meta.env todas las vars con estos prefijos.
  // No usar `define` para inyectarlas: pisaba los valores y dejaba "" quemado en el build.
  envPrefix: ["VITE_", "NEXT_PUBLIC_", "SUPABASE_"],
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    hmr: {
      port: 3000,
    },
  },
});
