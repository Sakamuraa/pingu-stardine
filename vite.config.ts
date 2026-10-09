import { resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL, URL } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Serve the Vercel functions from `npm run dev`.
 *
 * `api/*.ts` are Vercel serverless functions and Vite does not read that folder,
 * so in dev every /api call 404s and the client falls back to its bundled
 * snapshot. That makes the local page look plausible while showing data from the
 * day the snapshot was captured -- which is how a change to a live list can look
 * finished locally and turn out to be untested.
 *
 * The handler modules are loaded in-process rather than reimplemented, so there is
 * no dev version of an endpoint to drift from the deployed one.
 */
const API_ROUTES: Record<string, string> = {
  "/api/content": "api/content.ts",
  "/api/tweets": "api/tweets.ts",
  "/api/fanart": "api/fanart.ts",
  "/api/chat": "api/chat.ts",
};

type Handler = (req: unknown, res: unknown) => Promise<void> | void;

function devApi(): Plugin {
  return {
    name: "pingu:dev-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? "").split("?")[0];
        const relative = API_ROUTES[path];
        if (!relative) return next();

        void (async () => {
          try {
            // process.cwd(), not import.meta.url: Vite bundles this config into
            // node_modules/.vite-temp/, so a URL-relative path resolves outside
            // the project.
            const url = pathToFileURL(resolvePath(process.cwd(), relative)).href;
            const mod = (await import(url)) as { default?: Handler; handler?: Handler };
            const handler = mod.default ?? mod.handler;
            if (!handler) throw new Error(`no export in ${relative}`);

            // Vercel hands the function a req/res pair with status(), json() and
            // setHeader(). Node's ServerResponse has none of them, so they are
            // added here rather than in the handlers: the handler files stay
            // byte-identical to what deploys.
            const query = Object.fromEntries(
              new URL(req.url ?? path, "http://localhost").searchParams,
            );
            const apiReq = { url: req.url, method: req.method, headers: req.headers, query };
            const apiRes = Object.assign(res, {
              status(code: number) {
                res.statusCode = code;
                return apiRes;
              },
              json(body: unknown) {
                res.setHeader("content-type", "application/json; charset=utf-8");
                res.end(JSON.stringify(body));
                return apiRes;
              },
            });

            await handler(apiReq, apiRes);
          } catch (error) {
            // Surfaced in the terminal rather than swallowed: a dev API that fails
            // quietly is indistinguishable from an empty channel.
            server.config.logger.error(
              `[dev-api] ${path} failed: ${(error as Error).stack ?? String(error)}`,
            );
            if (!res.headersSent) {
              res.statusCode = 500;
              res.setHeader("content-type", "application/json; charset=utf-8");
              res.end(JSON.stringify({ error: "dev-api failed", detail: String(error) }));
            }
          }
        })();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devApi()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    target: "es2022",
    cssMinify: "lightningcss",
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        manualChunks: {
          motion: ["motion/react"],
        },
      },
    },
  },
});