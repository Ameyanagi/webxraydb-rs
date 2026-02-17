import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: process.env.BASE_PATH || "/",
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      srcDirectory: "src",
      prerender: {
        enabled: true,
        crawlLinks: true,
      },
    }),
    viteReact(),
  ],
  build: {
    target: "esnext",
  },
  optimizeDeps: {
    exclude: ["webxraydb-wasm"],
  },
});
