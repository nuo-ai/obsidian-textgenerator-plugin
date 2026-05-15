import esbuild from "esbuild";
import builtins from "builtin-modules";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import obsidianAliasPlugin from "../obsidian-alias/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const wasmPlugin = (config) => ({
  name: "wasm",
  setup(build) {
    build.onResolve({ filter: /\.wasm$/ }, (args) => {
      if (args.resolveDir === "") return;
      return {
        path: path.isAbsolute(args.path)
          ? args.path
          : path.join(args.resolveDir, args.path),
        namespace: `wasm-${config.mode}`,
      };
    });
    build.onLoad({ filter: /.*/, namespace: "wasm-embed" }, async (args) => ({
      contents: await fs.promises.readFile(args.path),
      loader: "binary",
    }));
  },
});

const result = await esbuild.build({
  entryPoints: [path.join(root, "src/main.ts")],
  bundle: true,
  metafile: true,
  write: false,
  minify: true,
  plugins: [wasmPlugin({ mode: "embed" }), obsidianAliasPlugin()],
  inject: [path.join(root, "obsidian-alias/buffer-inject.mjs")],
  external: [
    "obsidian",
    "electron",
    ...builtins.filter((m) => m !== "buffer"),
    "node:url",
    "node:fs",
    "node:fs/promises",
    "node:path",
    "node:module",
    "node:async_hooks",
    "node:crypto",
    "node:stream",
    "node:util",
    "node:events",
    "node:os",
  ],
  format: "cjs",
  target: "es2023",
  loader: { ".css": "empty" },
  absWorkingDir: root,
});

const outBytes = Object.values(result.metafile.outputs)[0]?.bytes ?? 0;

function pkgFromPath(filePath) {
  const nm = filePath.split("node_modules/");
  if (nm.length < 2) {
    if (filePath.includes("/src/")) return "(plugin src)";
    return "(other)";
  }
  let rest = nm[nm.length - 1];
  if (rest.startsWith(".pnpm/")) {
    const match = rest.match(/node_modules\/((?:@[^/]+\/[^/]+|[^/]+))/);
    return match ? match[1] : rest.split("/")[0];
  }
  if (rest.startsWith("@")) {
    const parts = rest.split("/");
    return `${parts[0]}/${parts[1]}`;
  }
  return rest.split("/")[0];
}

const byPkg = new Map();
for (const [file, meta] of Object.entries(result.metafile.inputs)) {
  const pkg = pkgFromPath(file);
  byPkg.set(pkg, (byPkg.get(pkg) ?? 0) + meta.bytes);
}

const sorted = [...byPkg.entries()].sort((a, b) => b[1] - a[1]);

console.log(`\nBundled output (minified): ${(outBytes / 1024 / 1024).toFixed(2)} MB\n`);
console.log("Top packages by contributed source bytes (pre-tree-shake input):\n");
console.log("Rank  Size      Package");
console.log("----  --------  -------");
sorted.slice(0, 40).forEach(([pkg, bytes], i) => {
  const mb = bytes / 1024 / 1024;
  const label = mb >= 0.1 ? `${mb.toFixed(2)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
  console.log(`${String(i + 1).padStart(4)}  ${label.padEnd(9)}  ${pkg}`);
});

const langchain = sorted.filter(([p]) => p.includes("langchain") || p === "langchain");
const lcTotal = langchain.reduce((s, [, b]) => s + b, 0);
console.log(`\nLangChain family total (input bytes): ${(lcTotal / 1024 / 1024).toFixed(2)} MB across ${langchain.length} packages`);
