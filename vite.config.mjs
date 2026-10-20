import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { DatabaseSync } from "node:sqlite";
import { readdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import worker from "./worker/index.js";

function devApiPlugin() {
  let dbInstance = null;

  function getDB() {
    if (dbInstance) return dbInstance;
    let sql;
    const wranglerDir = path.resolve(".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
    if (existsSync(wranglerDir)) {
      const files = readdirSync(wranglerDir);
      const sqliteFile = files.find((f) => f.endsWith(".sqlite") && !f.startsWith("metadata"));
      if (sqliteFile) {
        sql = new DatabaseSync(path.join(wranglerDir, sqliteFile));
      }
    }
    if (!sql) {
      sql = new DatabaseSync(":memory:");
      const migration = readFileSync(path.resolve("drizzle/0000_empty_stone_men.sql"), "utf8");
      sql.exec(migration);
    }
    const wrap = (q, args = []) => ({
      bind(...a) {
        return wrap(q, a);
      },
      async first() {
        return sql.prepare(q).get(...args) || null;
      },
      async all() {
        return { results: sql.prepare(q).all(...args) };
      },
      async run() {
        const r = sql.prepare(q).run(...args);
        return { meta: { changes: Number(r.changes) } };
      },
      q,
      args,
    });
    const DB = {
      prepare: (q) => wrap(q),
      async batch(list) {
        sql.exec("BEGIN");
        try {
          const r = [];
          for (const x of list) r.push(await x.run());
          sql.exec("COMMIT");
          return r;
        } catch (e) {
          sql.exec("ROLLBACK");
          throw e;
        }
      },
    };
    dbInstance = { DB, sql };
    return dbInstance;
  }

  return {
    name: "dev-api-middleware",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, "http://" + (req.headers.host || "localhost"));
        if (url.pathname === "/signin-with-chatgpt" || url.pathname === "/signout-with-chatgpt") {
          res.statusCode = 302;
          res.setHeader("Location", "/login");
          return res.end();
        }
        if (!url.pathname.startsWith("/api/")) {
          return next();
        }
        try {
          const buffers = [];
          for await (const chunk of req) buffers.push(chunk);
          const body = ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(buffers);

          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) {
            if (Array.isArray(v)) v.forEach((val) => headers.append(k, val));
            else if (v !== undefined) headers.set(k, v);
          }
          const devAdminRequested = req.headers["x-dev-admin"] === "true";
          if (!headers.has("oai-authenticated-user-id") && devAdminRequested) {
            headers.set("oai-authenticated-user-id", "local-development-admin");
            headers.set("oai-authenticated-user-email", "local-admin@example.test");
            headers.set("oai-authenticated-user-full-name", "Jace Roman");
          }

          const { DB } = getDB();
          const clientEmail = headers.get("oai-authenticated-user-email")?.toLowerCase();
          const isAdminEmail = clientEmail === "admin@temple.edu" || clientEmail === "local-admin@example.test";
          const env = {
            DB,
            ADMIN_EMAIL: isAdminEmail ? clientEmail : "local-admin@example.test",
            EBOARD_PASSWORD_SHA256: "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",
            ASSETS: { fetch: () => new Response("app") },
          };

          const webReq = new Request(url, {
            method: req.method,
            headers,
            body,
          });

          const webRes = await worker.fetch(webReq, env);
          res.statusCode = webRes.status;
          webRes.headers.forEach((val, key) => res.setHeader(key, val));
          const resBody = await webRes.arrayBuffer();
          res.end(Buffer.from(resBody));
        } catch (err) {
          console.error("Dev API error:", err);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    },
  };
}

export default defineConfig({
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react(), devApiPlugin()],
});

