/** Parse OpenAI-style JSON, common alternates, or plain-text / SRT bodies. */
export function parseTranscriptionResponse(
  raw: string,
  contentType: string | null
): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  const ct = (contentType || "").toLowerCase();
  const looksLikeJson =
    ct.includes("application/json") ||
    (trimmed.startsWith("{") && trimmed.endsWith("}"));

  if (looksLikeJson) {
    try {
      const j = JSON.parse(raw) as Record<string, unknown>;
      if (typeof j.text === "string") return j.text;
      if (typeof j.transcript === "string") return j.transcript;
      if (typeof j.result === "string") return j.result;
      const nested = j.result;
      if (nested && typeof nested === "object" && "text" in nested) {
        const t = (nested as { text?: unknown }).text;
        if (typeof t === "string") return t;
      }
      return undefined;
    } catch {
      /* treat as plain text below */
    }
  }

  return trimmed;
}
