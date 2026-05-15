// Import text splitters from @langchain/textsplitters in v1
import type { BaseLanguageModelInterface } from "@langchain/core/language_models/base";
import type { SummarizationChainParams } from "@langchain/classic/chains";
import {
  TokenTextSplitter,
  CharacterTextSplitter,
  RecursiveCharacterTextSplitter,
  TextSplitter,
  LatexTextSplitter,
  MarkdownTextSplitter,
} from "@langchain/textsplitters";

/** Lazy-loaded only when summarization chain config is used (not at plugin startup). */
export const chains = {
  loadSummarizationChain: (
    llm: BaseLanguageModelInterface,
    params?: SummarizationChainParams,
  ) =>
    import("@langchain/classic/chains").then((mod) => {
      if (!mod.loadSummarizationChain) {
        throw new Error("loadSummarizationChain is not available");
      }
      return mod.loadSummarizationChain(llm, params);
    }),
};

export const splitters = {
  TokenTextSplitter,
  CharacterTextSplitter,
  LatexTextSplitter,
  MarkdownTextSplitter,
  RecursiveCharacterTextSplitter,
  TextSplitter,
};
