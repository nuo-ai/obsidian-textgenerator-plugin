import { Client } from "langsmith";

export type HubPromptMessage = {
  prompt: {
    inputVariables: string[];
    template: string;
  };
};

export type HubPromptKwargs = {
  messages?: HubPromptMessage[];
  template?: string;
  input_variables?: string[];
  template_format?: string;
};

export type PullHubPromptOptions = {
  apiKey?: string;
  apiUrl?: string;
  /** Required to pull public prompts by owner/name (LangSmith default). */
  dangerouslyPullPublicPrompt?: boolean;
};

/** Pull prompt manifest kwargs from LangSmith Hub (replaces `langchain/hub` `pull`). */
export async function pullHubPromptKwargs(
  ownerRepoCommit: string,
  options?: PullHubPromptOptions
): Promise<HubPromptKwargs> {
  const client = new Client({
    apiKey: options?.apiKey,
    apiUrl: options?.apiUrl,
  });

  const promptObject = await client.pullPromptCommit(ownerRepoCommit, {
    includeModel: false,
    dangerouslyPullPublicPrompt: options?.dangerouslyPullPublicPrompt,
  });

  const kwargs = {
    ...(promptObject.manifest.kwargs ?? {}),
  } as HubPromptKwargs;

  if (kwargs.template_format === "mustache") {
    const stripDotNotation = (varName: string) => varName.split(".")[0];
    if (Array.isArray(kwargs.input_variables)) {
      kwargs.input_variables = kwargs.input_variables.map(stripDotNotation);
    }
    if (Array.isArray(kwargs.messages)) {
      kwargs.messages = kwargs.messages.map((message) => {
        const nested = (message as any)?.kwargs?.prompt?.kwargs;
        if (nested && Array.isArray(nested.input_variables)) {
          nested.input_variables = nested.input_variables.map(stripDotNotation);
        }
        return message;
      });
    }
  }

  return kwargs;
}

/** Drop-in for `pull()` when scripts expect `.toJSON().kwargs` (e.g. JS sandbox). */
export async function pullHubPromptCompat(
  ownerRepoCommit: string,
  options?: PullHubPromptOptions
) {
  const kwargs = await pullHubPromptKwargs(ownerRepoCommit, options);
  return {
    toJSON() {
      return { kwargs };
    },
  };
}

export function isHubSystemMessage(msg: unknown): boolean {
  const id = (msg as { id?: string[] })?.id;
  return Array.isArray(id) && id.includes("SystemMessagePromptTemplate");
}

/** Normalize hub / LangChain-serialized messages for `compileLangMessages`. */
export function normalizeHubMessages(
  messages: HubPromptKwargs["messages"] | undefined
): HubPromptMessage[] {
  if (!messages?.length) return [];

  return messages.map((msg) => {
    if (msg?.prompt?.template != null) {
      return {
        prompt: {
          template: msg.prompt.template,
          inputVariables: msg.prompt.inputVariables ?? [],
        },
      };
    }

    const nested =
      (msg as any)?.kwargs?.prompt?.kwargs ?? (msg as any)?.kwargs?.prompt;
    return {
      prompt: {
        template: nested?.template ?? "",
        inputVariables:
          nested?.input_variables ?? nested?.inputVariables ?? [],
      },
    };
  });
}
