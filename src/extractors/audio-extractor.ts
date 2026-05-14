import { App, TAbstractFile } from "obsidian";
import { Extractor } from "./content-extractor";
import TextGeneratorPlugin from "src/main";
import debug from "debug";

const logger = debug("textgenerator:Extractor:AudioExtractor");

import {
  WhisperProviderName,
  default_values,
} from "../ui/settings/sections/otherProviders/whisper";
import { parseTranscriptionResponse } from "./audio-transcription-parse";

function mergeExtraHeadersJson(
  raw: string | undefined
): Record<string, string> | undefined {
  const s = raw?.trim();
  if (!s?.length) return undefined;
  try {
    const parsed = JSON.parse(s) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return undefined;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string" || typeof v === "number")
        out[k] = String(v);
    }
    return Object.keys(out).length ? out : undefined;
  } catch {
    return undefined;
  }
}

function buildTranscriptionUrl(
  whisperProvider: Record<string, any> | undefined,
  plugin: TextGeneratorPlugin
): URL {
  const custom = whisperProvider?.transcription_url?.trim?.();
  if (custom?.length) return new URL(custom);

  const endpoint = new URL(
    whisperProvider?.basePath ||
      plugin.settings.endpoint ||
      plugin.defaultSettings.endpoint
  );

  if (whisperProvider?.api_version?.length) {
    endpoint.searchParams.set("api-version", whisperProvider.api_version);
  }

  endpoint.pathname =
    endpoint.pathname.replace(/\/$/, "") + "/audio/transcriptions";
  return endpoint;
}

export const supportedAudioExtensions = [
  "mp3",
  "mp4",
  "mpeg",
  "mpga",
  "m4a",
  "wav",
  "webm",
  "ogg",
];

export default class AudioExtractor extends Extractor {
  constructor(app: App, plugin: TextGeneratorPlugin) {
    super(app, plugin);
  }

  async convert(docPath: string) {
    logger("convert", { docPath });

    const xt = docPath.split(".");
    const extension = xt[xt.length - 1];

    const audioBuffer = await this.app.vault.adapter.readBinary(docPath);
    const fileSizeInMB = audioBuffer.byteLength / (1024 * 1024);

    if (fileSizeInMB > 24) {
      this.plugin.handelError(new Error("File size exceeds the 24 MB limit."));
      return "";
    }

    const transcript = await this.generateTranscript(audioBuffer, extension);
    logger("convert end", { transcript });
    return transcript ?? "";
  }

  async extract(filePath: string) {
    const embeds = this.app.metadataCache
      .getCache(filePath)
      ?.embeds?.filter((embed) =>
        supportedAudioExtensions.some((ext) =>
          embed.link.toLowerCase().endsWith(`.${ext}`)
        )
      );
    if (!embeds) {
      return [];
    }
    return embeds
      .map(
        (embed) =>
          this.app.metadataCache.getFirstLinkpathDest(embed.link, filePath)
            ?.path
      )
      .filter(Boolean) as string[];
  }

  async generateTranscript(audioBuffer: ArrayBuffer, filetype: string) {
    const whisperProvider = this.plugin.settings.LLMProviderOptions[WhisperProviderName];

    const whisperApiKey = whisperProvider?.api_key || this.plugin.settings.api_key;
    const authModeRaw = whisperProvider?.auth_mode ?? default_values.auth_mode;
    const authMode =
      authModeRaw === "api_key" ||
      authModeRaw === "x_api_key" ||
      authModeRaw === "none"
        ? authModeRaw
        : "bearer";

    try {
      const endpoint = buildTranscriptionUrl(whisperProvider, this.plugin);

      const isOfficialOpenAi =
        endpoint.hostname === "api.openai.com" && authMode === "bearer";
      if (isOfficialOpenAi && whisperApiKey.length < 1)
        throw new Error("OpenAI API Key is not provided.");

      const formData = this.createFormData(audioBuffer, filetype);
      this.plugin.startProcessing(false);

      const headers: Record<string, string> = {};

      const key = whisperApiKey.trim();
      if (authMode === "bearer" && key.length)
        headers.Authorization = `Bearer ${key}`;
      else if (authMode === "api_key" && key.length) headers["api-key"] = key;
      else if (authMode === "x_api_key" && key.length)
        headers["x-api-key"] = key;

      const extra = mergeExtraHeadersJson(whisperProvider?.extra_headers_json);
      if (extra) Object.assign(headers, extra);

      const response = await fetch(endpoint.href, {
        method: "POST",
        headers,
        body: formData,
      });

      const raw = await response.text();
      const contentType = response.headers.get("content-type");

      if (!response.ok) {
        let detail = raw?.slice(0, 500) || response.statusText;
        try {
          const ej = JSON.parse(raw) as { error?: { message?: string } };
          if (ej?.error?.message) detail = ej.error.message;
        } catch {
          /* keep detail */
        }
        this.plugin.handelError(
          new Error(`Transcription failed (${response.status}): ${detail}`)
        );
        return;
      }

      const text = parseTranscriptionResponse(raw, contentType);
      if (text !== undefined) return text;

      this.plugin.handelError(
        new Error(
          "Could not read transcription from response. " +
            (raw.length > 400 ? raw.slice(0, 400) + "…" : raw)
        )
      );
    } catch (err: any) {
      this.plugin.handelError(err);
    } finally {
      this.plugin.endProcessing(false);
    }
  }

  createFormData(audioBuffer: BlobPart, filetype: string) {
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: `audio/${filetype}` });
    formData.append("file", blob, `audio.${filetype}`);
    formData.append(
      "model",
      this.plugin.settings.LLMProviderOptions[WhisperProviderName]?.model ||
      default_values.model
    );

    const lang =
      this.plugin.settings.LLMProviderOptions[WhisperProviderName]?.language;
    if (lang?.length) formData.append("language", lang);

    const rf =
      this.plugin.settings.LLMProviderOptions[WhisperProviderName]
        ?.response_format;
    if (typeof rf === "string" && rf.trim().length)
      formData.append("response_format", rf.trim());

    return formData;
  }
}
