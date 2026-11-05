import { defineConfig } from "vite";

export default defineConfig({
    // Relative paths, so the build runs from any folder on any host (itch.io
    // serves it from a sub-folder) as well as from the root
    base: "./",
    build: {
        // The three.js bundle is over the default warning size; one chunk is fine
        chunkSizeWarningLimit: 1000,
    },
});
