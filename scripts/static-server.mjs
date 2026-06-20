import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const staticRoot = join(root, "static");
const publicRoot = join(root, "public");
const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST ?? "127.0.0.1";

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `${host}:${port}`}`);
  const path = decodeURIComponent(url.pathname);
  const filePath = resolvePath(path);

  if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "Content-Type": contentTypes[extname(filePath)] ?? "application/octet-stream"
  });
  createReadStream(filePath).pipe(response);
});

server.listen(port, host, () => {
  console.log(`VOLT+ static site running at http://${host}:${port}`);
});

function resolvePath(path) {
  if (path === "/" || path === "/index.html") return join(staticRoot, "index.html");
  if (path.startsWith("/brand/")) return safeJoin(publicRoot, path.slice(1));
  return safeJoin(staticRoot, path.slice(1));
}

function safeJoin(base, requested) {
  const target = normalize(join(base, requested));
  return target.startsWith(base) ? target : null;
}
