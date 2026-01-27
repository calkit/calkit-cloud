import { TanStackRouterVite } from "@tanstack/router-vite-plugin"
import react from "@vitejs/plugin-react-swc"
import path from "path"
import { defineConfig } from "vite"

const hash = Math.floor(Math.random() * 90000) + 10000

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), TanStackRouterVite()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@/chakra": path.resolve(__dirname, "src/chakra.tsx"),
    },
  },
  define: {
    // Polyfill for @chakra-ui/icons using React.forwardRef
    __FORWARDREF__: JSON.stringify(true),
  },
  server: {
    // Bind to all interfaces so it's reachable from host when running in Docker
    host: true, // equivalent to 0.0.0.0
    port: 5173,
    strictPort: true,
    // HMR generally works out-of-the-box when port is forwarded one-to-one.
    // If you run into websocket issues behind proxies, set explicit HMR host/port here.
    // hmr: { host: "localhost", port: 5173, protocol: "ws" },
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `[name]` + hash + `.js`,
        chunkFileNames: `[name]` + hash + `.js`,
        assetFileNames: `[name]` + hash + `.[ext]`,
      },
      external: [],
    },
  },
})
