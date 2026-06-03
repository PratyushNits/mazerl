import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/auth":   "http://localhost:8000",
      "/mazes":  "http://localhost:8000",
      "/maze":   "http://localhost:8000",
      "/race":   "http://localhost:8000",
      "/scores": "http://localhost:8000",
      "/assets": "http://localhost:8000",
      "/race/stream": {
        target: "ws://localhost:8000",
        ws: true,
      },
    },
  },
});
