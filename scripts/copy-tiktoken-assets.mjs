import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const pkg = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8")
);
const version = pkg.dependencies["@dqbd/tiktoken"].replace(/^[\^~]/, "");
const srcRoot = path.join(
  root,
  "node_modules",
  "@dqbd",
  "tiktoken"
);

const destRoot = path.join(root, "assets", "tiktoken");

const files = [
  ["lite/tiktoken_bg.wasm", "lite/tiktoken_bg.wasm"],
  ["encoders/cl100k_base.json", "encoders/cl100k_base.json"],
  ["encoders/r50k_base.json", "encoders/r50k_base.json"],
  ["encoders/p50k_base.json", "encoders/p50k_base.json"],
];

if (!fs.existsSync(srcRoot)) {
  console.error(`@dqbd/tiktoken not found at ${srcRoot}. Run pnpm install first.`);
  process.exit(1);
}

for (const [from, to] of files) {
  const src = path.join(srcRoot, from);
  const dest = path.join(destRoot, to);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`copied ${to}`);
}

console.log(`Done (@dqbd/tiktoken@${version})`);
