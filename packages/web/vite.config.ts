import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

export default defineConfig({
  base: process.env.VITE_BASE_URL ?? "/",
  plugins: [react()],
  css: {
    postcss: {
      plugins: [tailwindcss, autoprefixer],
    },
  },
  server: {
    port: 5173,
    proxy: {
      "^/(query|formats|moves|abilities|health)": {
        target: process.env.API_TARGET ?? "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
