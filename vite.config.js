import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  // SheetJS (Excel import/export) is ~500 kB but only loads when a file is imported or exported
  build: { chunkSizeWarningLimit: 600 },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  base: "/bsv-training-prototype/",
});
