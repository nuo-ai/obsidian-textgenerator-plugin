import React, { useId, useState } from "react";
import useGlobal from "../../../context/global";
import SettingItem from "../../components/item";
import SettingsSection from "../../components/section";
import type { Register } from "..";
import Input from "../../components/input";
import DropdownSearch from "../../components/dropdownSearch";
import SettingsTextarea from "../../components/textarea";
import clsx from "clsx";

export const WhisperProviderName = "whisper";

export const whisperAuthModes = [
  "bearer",
  "api_key",
  "x_api_key",
  "none",
] as const;

export const whisperAuthModeLabels: Record<(typeof whisperAuthModes)[number], string> =
  {
    bearer: "Bearer token (default, OpenAI-compatible)",
    api_key: "api-key header (e.g. Azure OpenAI)",
    x_api_key: "x-api-key header",
    none: "No auth header",
  };

export const default_values = {
  base_path: "https://api.openai.com/v1",
  model: "whisper-1",
  api_key: "",
  api_version: "",
  auth_mode: "bearer" as (typeof whisperAuthModes)[number],
  transcription_url: "",
  response_format: "",
  extra_headers_json: "",
};

export default function WhisperProviderSetting(props: { register: Register }) {
  const global = useGlobal();
  const sectionId = useId();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const config = (global.plugin.settings.LLMProviderOptions[
    WhisperProviderName
  ] ??= {
    ...default_values,
  });

  return (
    <>
      <SettingsSection
        title="Whisper Settings"
        className="plug-tg-flex plug-tg-w-full plug-tg-flex-col"
        register={props.register}
        id={sectionId}
      >
        <SettingItem
          name="BasePath"
          description="default to openai"
          register={props.register}
          sectionId={sectionId}
        >
          <Input
            value={config.basePath || default_values.base_path}
            placeholder={default_values.base_path}
            setValue={async (val) => {
              config.basePath = val;
              await global.plugin.saveSettings();
              global.triggerReload();
            }}
          />
        </SettingItem>

        <SettingItem
          name="API Key"
          description="default to openai provider's apikey"
          register={props.register}
          sectionId={sectionId}
        >
          <Input
            type="password"
            value={config.api_key || default_values.api_key}
            setValue={async (val) => {
              config.api_key = val;
              await global.plugin.saveSettings();
              global.triggerReload();
            }}
          />
        </SettingItem>

        <SettingItem
          name="Model"
          description="default to whisper-1"
          register={props.register}
          sectionId={sectionId}
        >
          <Input
            value={config.model || default_values.model}
            setValue={async (val) => {
              config.model = val;
              await global.plugin.saveSettings();
              global.triggerReload();
            }}
          />
        </SettingItem>

        <SettingItem
          name="API Version"
          description="Api version (Azure only)"
          register={props.register}
          className={clsx({
            "plug-tg-opacity-60": !config.api_version,
          })}
          sectionId={sectionId}
        >
          <Input
            value={config.api_version || default_values.api_version}
            placeholder="2024-02-01"
            setValue={async (val) => {
              config.api_version = val;
              await global.plugin.saveSettings();
              global.triggerReload();
            }}
          />
        </SettingItem>

        <SettingItem
          name="Language"
          description="default to (none)"
          register={props.register}
          sectionId={sectionId}
        >
          <DropdownSearch
            values={languages}
            value={config.language}
            // placeholder="(none)"
            setValue={async (val) => {
              config.language = val;
              await global.plugin.saveSettings();
              global.triggerReload();
            }}
          />
        </SettingItem>

        <SettingItem
          name="Show advanced options"
          description="Authentication mode, custom transcription URL, response format, and extra HTTP headers."
          register={props.register}
          sectionId={sectionId}
        >
          <Input
            type="checkbox"
            value={showAdvanced ? "true" : "false"}
            setValue={(val) => {
              setShowAdvanced(val === "true");
            }}
          />
        </SettingItem>

        {showAdvanced ? (
          <div className="plug-tg-flex plug-tg-w-full plug-tg-flex-col plug-tg-border-l-2 plug-tg-border-[var(--background-modifier-border)] plug-tg-pl-3">
            <SettingItem
              name="Authentication"
              description="How the API key (or token) is sent. Default is unchanged for existing setups."
              register={props.register}
              sectionId={sectionId}
            >
              <DropdownSearch
                values={[...whisperAuthModes]}
                aliases={whisperAuthModeLabels}
                value={config.auth_mode || default_values.auth_mode}
                setValue={async (val) => {
                  config.auth_mode = val;
                  await global.plugin.saveSettings();
                  global.triggerReload();
                }}
              />
            </SettingItem>

            <SettingItem
              name="Transcription URL (optional)"
              description="If set, this full URL is used instead of BasePath + /audio/transcriptions. For custom gateways or non-standard paths."
              register={props.register}
              sectionId={sectionId}
            >
              <Input
                value={config.transcription_url ?? default_values.transcription_url}
                placeholder="(use BasePath + /audio/transcriptions)"
                setValue={async (val) => {
                  config.transcription_url = val;
                  await global.plugin.saveSettings();
                  global.triggerReload();
                }}
              />
            </SettingItem>

            <SettingItem
              name="Response format (optional)"
              description="OpenAI-style response_format: json, text, verbose_json, vtt, srt. Leave empty for provider default."
              register={props.register}
              sectionId={sectionId}
            >
              <Input
                value={config.response_format ?? default_values.response_format}
                placeholder="(provider default)"
                setValue={async (val) => {
                  config.response_format = val;
                  await global.plugin.saveSettings();
                  global.triggerReload();
                }}
              />
            </SettingItem>

            <SettingItem
              name="Extra headers (JSON, optional)"
              description='Merged after auth; values can override Authorization. Example: {"X-Custom":"value"}'
              register={props.register}
              sectionId={sectionId}
              textArea
            >
              <SettingsTextarea
                rows={4}
                value={config.extra_headers_json ?? default_values.extra_headers_json}
                placeholder='{"Header-Name":"value"}'
                setValue={async (val) => {
                  config.extra_headers_json = val;
                  await global.plugin.saveSettings();
                  global.triggerReload();
                }}
              />
            </SettingItem>
          </div>
        ) : null}
      </SettingsSection>
    </>
  );
}

const languages = [
  "Afrikaans",
  "Arabic",
  "Armenian",
  "Azerbaijani",
  "Belarusian",
  "Bosnian",
  "Bulgarian",
  "Catalan",
  "Chinese",
  "Croatian",
  "Czech",
  "Danish",
  "Dutch",
  "English",
  "Estonian",
  "Finnish",
  "French",
  "Galician",
  "German",
  "Greek",
  "Hebrew",
  "Hindi",
  "Hungarian",
  "Icelandic",
  "Indonesian",
  "Italian",
  "Japanese",
  "Kannada",
  "Kazakh",
  "Korean",
  "Latvian",
  "Lithuanian",
  "Macedonian",
  "Malay",
  "Marathi",
  "Maori",
  "Nepali",
  "Norwegian",
  "Persian",
  "Polish",
  "Portuguese",
  "Romanian",
  "Russian",
  "Serbian",
  "Slovak",
  "Slovenian",
  "Spanish",
  "Swahili",
  "Swedish",
  "Tagalog",
  "Tamil",
  "Thai",
  "Turkish",
  "Ukrainian",
  "Urdu",
  "Vietnamese",
  "Welsh",
];
