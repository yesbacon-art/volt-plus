import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

cpSync(join(root, "static"), dist, { recursive: true });

const brandSource = join(root, "public", "brand");
if (existsSync(brandSource)) {
  cpSync(brandSource, join(dist, "brand"), { recursive: true });
}

console.log("VOLT+ static Vercel build written to dist/");
