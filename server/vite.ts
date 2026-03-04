import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export async function setupVite(server: Server, app: Express) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server, path: "/__vite_hmr" },
  };

  const vite = await createViteServer({
    configFile: path.resolve(import.meta.dirname, "..", "vite.config.ts"),
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  const clientTemplate = path.resolve(
    import.meta.dirname,
    "..",
    "client",
    "index.html",
  );

  let cachedPage: string | null = null;

  (async () => {
    try {
      await vite.transformRequest("/src/index.css");
      console.log("CSS pre-warmed successfully");
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      cachedPage = await vite.transformIndexHtml("/", template);
      console.log("HTML pre-warmed successfully");
    } catch (e) {
      console.error("Pre-warm failed:", e);
    }
  })();

  app.use("/{*path}", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      if (cachedPage) {
        res.status(200).set({ "Content-Type": "text/html" }).end(cachedPage);
        return;
      }

      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      cachedPage = page;
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });

  vite.watcher.on("change", () => {
    cachedPage = null;
  });
}
