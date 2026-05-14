import { describe, expect, it } from "vitest";
import { parseTranscriptionResponse } from "./audio-transcription-parse";

describe("parseTranscriptionResponse", () => {
  it("reads OpenAI JSON text field", () => {
    expect(
      parseTranscriptionResponse(
        JSON.stringify({ text: "hello world" }),
        "application/json"
      )
    ).toBe("hello world");
  });

  it("accepts plain text bodies", () => {
    expect(parseTranscriptionResponse("  plain transcript  ", "text/plain")).toBe(
      "plain transcript"
    );
  });

  it("supports transcript and result aliases", () => {
    expect(
      parseTranscriptionResponse(
        JSON.stringify({ transcript: "from transcript key" }),
        null
      )
    ).toBe("from transcript key");
    expect(
      parseTranscriptionResponse(JSON.stringify({ result: "direct result" }), null)
    ).toBe("direct result");
  });

  it("returns undefined for JSON without a known transcript field", () => {
    expect(
      parseTranscriptionResponse(JSON.stringify({ foo: 1 }), "application/json")
    ).toBeUndefined();
  });
});
