import { TanStackRouterVite } from "@tanstack/router-vite-plugin"
import react from "@vitejs/plugin-react-swc"
import { defineConfig } from "vite"

const hash = Math.floor(Math.random() * 90000) + 10000

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), TanStackRouterVite()],
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
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined
          }

          if (id.includes("plotly.js") || id.includes("react-plotly.js")) {
            return "vendor-plotly"
          }

          // Mermaid and its rendering graph (d3, dagre, khroma, cytoscape,
          // elkjs) must stay in ONE chunk. Splitting this tightly-coupled,
          // circular dependency graph across chunks reorders module init and
          // triggers a "Cannot access 'x' before initialization" TDZ error in
          // mermaid's theme code on load.
          if (
            id.includes("mermaid") ||
            id.includes("/d3-") ||
            id.includes("/d3/") ||
            id.includes("dagre") ||
            id.includes("khroma") ||
            id.includes("cytoscape") ||
            id.includes("elkjs") ||
            id.includes("non-layered-tidy-tree-layout")
          ) {
            return "vendor-mermaid"
          }

          if (
            id.includes("react-ipynb-renderer") ||
            id.includes("mathjax") ||
            id.includes("katex")
          ) {
            return "vendor-notebooks"
          }

          if (
            id.includes("@chakra-ui") ||
            id.includes("@emotion") ||
            id.includes("framer-motion")
          ) {
            return "vendor-ui"
          }

          if (id.includes("@tanstack")) {
            return "vendor-routing"
          }

          if (
            id.includes("pdfjs-dist") ||
            id.includes("react-pdf-highlighter")
          ) {
            return "vendor-pdf"
          }

          if (
            id.includes("react-syntax-highlighter") ||
            id.includes("highlight.js") ||
            id.includes("lowlight") ||
            id.includes("refractor")
          ) {
            return "vendor-syntax"
          }

          if (
            id.includes("react-markdown") ||
            id.includes("remark-") ||
            id.includes("rehype-") ||
            id.includes("micromark") ||
            id.includes("mdast-") ||
            id.includes("hast-") ||
            id.includes("unified") ||
            id.includes("unist-")
          ) {
            return "vendor-markdown"
          }

          if (id.includes("react-diff-viewer")) {
            return "vendor-diff"
          }

          return "vendor"
        },
      },
    },
  },
})
