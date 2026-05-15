import { requestUrl, normalizePath } from "obsidian";
import path from "path";
import type TextGeneratorPlugin from "../main";

/** @dqbd/tiktoken@1.0.22 — keep in sync with package.json */
export const TIKTOKEN_PACKAGE_VERSION = "1.0.22";

const CDN_BASE =
  "https://raw.githubusercontent.com/nhaouari/obsidian-textgenerator-plugin/master/assets/tiktoken";

export const TIKTOKEN_ASSET_PATHS = {
  wasm: "lite/tiktoken_bg.wasm",
  cl100k_base: "encoders/cl100k_base.json",
  r50k_base: "encoders/r50k_base.json",
  p50k_base: "encoders/p50k_base.json",
} as const;

type EncoderKey = "cl100k_base" | "r50k_base" | "p50k_base";

function getFs() {
  return {
    fs: require("fs") as typeof import("fs"),
    fsp: require("fs/promises") as typeof import("fs/promises"),
  };
}

/** Absolute path to the plugin folder (where main.js lives). */
export function getPluginRootDir(plugin: TextGeneratorPlugin): string {
  const adapter = plugin.app.vault.adapter as { basePath?: string };
  if (adapter.basePath) {
    return path.join(
      adapter.basePath,
      normalizePath(plugin.app.vault.configDir),
      plugin.manifest.dir
    );
  }
  return path.join(
    normalizePath(plugin.app.vault.configDir),
    plugin.manifest.dir
  );
}

/** Absolute path to `.cache/tiktoken` beside the plugin's main.js */
export function getTiktokenCacheDir(plugin: TextGeneratorPlugin): string {
  return path.join(getPluginRootDir(plugin), ".cache", "tiktoken");
}

/** Bundled assets shipped in-repo at `assets/tiktoken/` (dev / offline). */
function getBundledAssetPath(
  plugin: TextGeneratorPlugin,
  relativePath: string
): string {
  return path.join(getPluginRootDir(plugin), "assets", "tiktoken", relativePath);
}

function cdnUrl(relativePath: string): string {
  return `${CDN_BASE}/${relativePath}`;
}

async function ensureParentDir(filePath: string) {
  const { fsp } = getFs();
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
}

async function readCached(
  localPath: string,
  binary: boolean
): Promise<ArrayBuffer | string | null> {
  const { fs } = getFs();
  if (!fs.existsSync(localPath)) return null;

  if (binary) {
    const buf = fs.readFileSync(localPath);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }
  return fs.readFileSync(localPath, "utf-8");
}

async function writeCache(localPath: string, data: ArrayBuffer | string) {
  const { fsp } = getFs();
  await ensureParentDir(localPath);
  if (typeof data === "string") {
    await fsp.writeFile(localPath, data, "utf-8");
  } else {
    await fsp.writeFile(localPath, Buffer.from(data));
  }
}

async function downloadAsset(relativePath: string): Promise<ArrayBuffer | string> {
  const url = cdnUrl(relativePath);
  const binary = relativePath.endsWith(".wasm");

  const res = await requestUrl({ url, method: "GET" });
  if (res.status >= 400) {
    throw new Error(
      `[TG] Failed to download tiktoken asset (${res.status}): ${url}`
    );
  }

  if (binary) return res.arrayBuffer;
  return res.text;
}

async function getCachedOrDownload(
  plugin: TextGeneratorPlugin,
  relativePath: string,
  binary: boolean
): Promise<ArrayBuffer | string> {
  const cachePath = path.join(getTiktokenCacheDir(plugin), relativePath);

  try {
    const cached = await readCached(cachePath, binary);
    if (cached != null) return cached;
  } catch (err) {
    console.warn("[TG] tiktoken cache read failed", err);
  }

  const bundledPath = getBundledAssetPath(plugin, relativePath);
  try {
    const bundled = await readCached(bundledPath, binary);
    if (bundled != null) {
      try {
        await writeCache(cachePath, bundled);
      } catch {
        /** cache optional */
      }
      return bundled;
    }
  } catch {
    /** no bundled copy */
  }

  const data = await downloadAsset(relativePath);
  try {
    await writeCache(cachePath, data);
  } catch (err) {
    console.warn("[TG] tiktoken cache write failed", err);
  }
  return data;
}

export type LoadedTiktokenAssets = {
  Tiktoken: new (...args: any[]) => import("@dqbd/tiktoken/lite/init").Tiktoken;
  encoders: Record<EncoderKey, any>;
};

/** Load wasm + encoders from disk cache or GitHub CDN (first use only). */
export async function loadTiktokenAssets(
  plugin: TextGeneratorPlugin
): Promise<LoadedTiktokenAssets> {
  const { init, Tiktoken } = await import("@dqbd/tiktoken/lite/init");

  const [wasmData, cl100kText, r50kText, p50kText] = await Promise.all([
    getCachedOrDownload(plugin, TIKTOKEN_ASSET_PATHS.wasm, true),
    getCachedOrDownload(plugin, TIKTOKEN_ASSET_PATHS.cl100k_base, false),
    getCachedOrDownload(plugin, TIKTOKEN_ASSET_PATHS.r50k_base, false),
    getCachedOrDownload(plugin, TIKTOKEN_ASSET_PATHS.p50k_base, false),
  ]);

  await init((imports: WebAssembly.Imports) =>
    WebAssembly.instantiate(wasmData as ArrayBuffer, imports)
  );

  return {
    Tiktoken: Tiktoken as LoadedTiktokenAssets["Tiktoken"],
    encoders: {
      cl100k_base: JSON.parse(cl100kText as string),
      r50k_base: JSON.parse(r50kText as string),
      p50k_base: JSON.parse(p50kText as string),
    },
  };
}
