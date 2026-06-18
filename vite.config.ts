// vite.config.ts

import path from "node:path";
import { solidStart } from "@solidjs/start/config";
import { nitroV2Plugin as nitro } from "@solidjs/vite-plugin-nitro-2";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    solidStart(),
    // Tell Nitro to build for Vercel's serverless infrastructure
    nitro({ preset: "vercel" }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@generated": path.resolve(__dirname, "./generated"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (/better-auth[\\/]/.test(id)) return "better-auth";
            if (/@aws-sdk[\\/]/.test(id)) return "aws-sdk";
            if (/@prisma[\\/]/.test(id)) return "prisma";
            if (/@ark-ui[\\/]/.test(id)) return "ark-ui";
            if (/solid-js[\\/]/.test(id)) return "solid-js";
            if (/lucide-solid[\\/]/.test(id)) return "lucide";
          }
        },
      },
    },
  },
});
