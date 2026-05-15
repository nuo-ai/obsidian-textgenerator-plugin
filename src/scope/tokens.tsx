import debug from "debug";
import { AI_MODELS } from "src/constants";
import TextGeneratorPlugin from "src/main";
import { loadTiktokenAssets } from "#/lib/tiktoken-assets";
import { Notice } from "obsidian";
import React from "react";
import ReactDOM from "react-dom";
import { createRoot } from "react-dom/client";
const logger = debug("textgenerator:tokens-service");

type TiktokenCtor = import("@dqbd/tiktoken/lite/init").Tiktoken;

export default class TokensScope {
  plugin: TextGeneratorPlugin;
  private readyPromise?: Promise<void>;
  private _Tiktoken?: new (...args: any[]) => TiktokenCtor;
  private _encoders: Record<string, any> = {};

  constructor(plugin: TextGeneratorPlugin) {
    this.plugin = plugin;
  }

  async ensureReady() {
    if (!this.readyPromise) {
      this.readyPromise = (async () => {
        const { Tiktoken, encoders } = await loadTiktokenAssets(this.plugin);
        this._Tiktoken = Tiktoken as any;
        this._encoders = encoders;
      })();
    }
    await this.readyPromise;
  }

  /** @deprecated Prefer ensureReady(); kept for callers that still await setup(). */
  async setup() {
    await this.ensureReady();
    return this;
  }

  getEncoderFromEncoding(encoding: string) {
    if (!this._Tiktoken) {
      throw new Error(
        "[TG] TokensScope.getEncoderFromEncoding called before ensureReady()"
      );
    }
    const model = this._encoders[encoding];
    return new this._Tiktoken(
      model?.bpe_ranks,
      model?.special_tokens,
      model?.pat_str
    );
  }

  async estimate(context: any) {
    await this.ensureReady();
    logger("estimateTokens", context);
    const { options, template } = context;

    const prompt =
      template && !context.context
        ? await template.inputTemplate(options)
        : context.context;

    const { bodyParams } = await
      this.plugin.textGenerator.reqFormatter.getRequestParameters(
        {
          ...this.plugin.settings,
          prompt,
        },
        true,
        ""
      );

    const llmSettings = this.plugin.textGenerator.LLMProvider.getSettings();

    const conf = {
      ...this.plugin.settings,
      ...llmSettings,
      ...bodyParams,
    };

    const { tokens, maxTokens } =
      await this.plugin.textGenerator.LLMProvider.calcTokens(
        bodyParams.messages,
        conf
      );

    const cost = await this.plugin.textGenerator.LLMProvider.calcPrice(
      tokens,
      conf
    );

    const result = {
      // model: this.plugin.textGenerator.LLMProvider.getSettings().model || this.plugin.settings.model || "gpt-3.5-turbo",
      maxTokens,
      completionTokens: this.plugin.settings.max_tokens,
      tokens,
      cost,
    };

    logger("estimateTokens", result);
    return result;
  }

  showTokens(props: {
    tokens: any;
    maxTokens: number;
    cost: number;
    // model: string;
    completionTokens: number;
    // total: number;
  }) {
    // <tr><td><strong>Model</strong></td><td>${props.model}</td></tr>
    // <tr><td><strong>Prompt tokens</strong></td><td>${props.tokens}</td></tr>

    logger("showTokens", props);

    const summaryEl = document.createElement("div");
    summaryEl.classList.add("plug-tg-summary");
    // summaryEl.innerHTML =  as any;

    const provider = createRoot(summaryEl);

    provider.render(
      <div className="plug-tg-flow-root">
        <ul
          role="list"
          className="plug-tg-divide-y plug-tg-divide-gray-200 dark:plug-tg-divide-gray-700"
        >
          <li className="plug-tg-py-3 sm:plug-tg-py-4">
            <div className="plug-tg-flex plug-tg-items-center plug-tg-justify-between plug-tg-space-x-4">
              <div>Total tokens</div>
              <div className="plug-tg-inline-flex plug-tg-items-center plug-tg-pr-3 plug-tg-text-base plug-tg-font-semibold plug-tg-text-gray-900 dark:plug-tg-text-white">
                {props.tokens}
              </div>
            </div>
          </li>

          <li className="plug-tg-py-3 sm:plug-tg-py-4">
            <div className="plug-tg-flex plug-tg-items-center plug-tg-justify-between plug-tg-space-x-4">
              <div>Completion tokens</div>
              <div className="plug-tg-inline-flex plug-tg-items-center plug-tg-pr-3 plug-tg-text-base plug-tg-font-semibold plug-tg-text-gray-900 dark:plug-tg-text-white">
                {props.completionTokens}
              </div>
            </div>
          </li>

          <li className="plug-tg-py-3 sm:plug-tg-py-4">
            <div className="plug-tg-flex plug-tg-items-center plug-tg-justify-between plug-tg-space-x-4">
              <div>Max Tokens</div>
              <div className="plug-tg-inline-flex plug-tg-items-center plug-tg-pr-3 plug-tg-text-base plug-tg-font-semibold plug-tg-text-gray-900 dark:plug-tg-text-white">
                {props.maxTokens}
              </div>
            </div>
          </li>

          <li className="plug-tg-py-3 sm:plug-tg-py-4">
            <div className="plug-tg-flex plug-tg-items-center plug-tg-justify-between plug-tg-space-x-4">
              <div>Estimated Price</div>
              <div className="plug-tg-inline-flex plug-tg-items-center plug-tg-pr-3 plug-tg-text-base plug-tg-font-semibold plug-tg-text-gray-900 dark:plug-tg-text-white">
                ${props.cost.toLocaleString()}
              </div>
            </div>
          </li>
        </ul>
      </div>
    );

    logger("showTokens", { summaryEl });
    logger(summaryEl);
    new Notice(summaryEl as any, 5000);
  }
}
