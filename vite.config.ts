import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { metaImagesPlugin } from "./vite-plugin-meta-images";

export default defineConfig(async () => {
  const plugins = [
    react(),
    runtimeErrorOverlay(),
    metaImagesPlugin(),
  ];

  if (
    process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
  ) {
    try {
      const cartographerModule = await import("@replit/vite-plugin-cartographer");
      const devBannerModule = await import("@replit/vite-plugin-dev-banner");
      plugins.push(cartographerModule.cartographer());
      plugins.push(devBannerModule.devBanner());
    } catch {}
  }

  return {
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      },
    },
    css: {
      postcss: path.resolve(import.meta.dirname),
    },
    root: path.resolve(import.meta.dirname, "client"),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      host: "0.0.0.0",
      hmr: {
        path: "/__vite_hmr",
      },
      watch: {
        ignored: ["**/.local/**", "**/.cache/**"],
      },
    },
  };
});
