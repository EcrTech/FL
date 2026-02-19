/**
 * Shared Gemini API client for Supabase Edge Functions.
 *
 * Accepts OpenAI-style messages and translates them to Gemini's native
 * generateContent format, so each calling function needs minimal changes.
 */

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** OpenAI-style content part */
type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename?: string; file_data: string } };

/** OpenAI-style message */
interface Message {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

/** OpenAI-style function tool */
interface Tool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

interface CallGeminiOptions {
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: "json_object" };
  tools?: Tool[];
  toolChoice?: { type: "function"; function: { name: string } } | "auto";
}

interface GeminiResult {
  text: string;
  toolCall?: { name: string; arguments: string };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse a data-URI into { mimeType, data } */
function parseDataUri(uri: string): { mimeType: string; data: string } {
  const match = uri.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) throw new Error("Invalid data URI");
  return { mimeType: match[1], data: match[2] };
}

/** Convert OpenAI content parts to Gemini parts */
function toGeminiParts(content: string | ContentPart[]): any[] {
  if (typeof content === "string") {
    return [{ text: content }];
  }

  return content.map((part) => {
    if (part.type === "text") {
      return { text: part.text };
    }
    if (part.type === "image_url") {
      const { mimeType, data } = parseDataUri(part.image_url.url);
      return { inlineData: { mimeType, data } };
    }
    if (part.type === "file") {
      const { mimeType, data } = parseDataUri(part.file.file_data);
      return { inlineData: { mimeType, data } };
    }
    return { text: JSON.stringify(part) };
  });
}

/** Translate OpenAI tools to Gemini functionDeclarations */
function toGeminiFunctionDeclarations(tools: Tool[]) {
  return tools.map((t) => ({
    name: t.function.name,
    description: t.function.description || "",
    parameters: t.function.parameters,
  }));
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Call the Gemini API, translating from OpenAI-style params.
 *
 * Built-in retry on 429 with exponential backoff (2 retries max).
 */
export async function callGemini(
  model: string,
  opts: CallGeminiOptions,
): Promise<GeminiResult> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  // Separate system message from the rest
  const systemParts: string[] = [];
  const contents: any[] = [];

  for (const msg of opts.messages) {
    if (msg.role === "system") {
      const text = typeof msg.content === "string"
        ? msg.content
        : msg.content.filter((p) => p.type === "text").map((p) => (p as any).text).join("\n");
      systemParts.push(text);
    } else {
      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: toGeminiParts(msg.content),
      });
    }
  }

  // Build request body
  const body: Record<string, any> = { contents };

  if (systemParts.length > 0) {
    body.systemInstruction = {
      parts: systemParts.map((text) => ({ text })),
    };
  }

  // Generation config
  const genConfig: Record<string, any> = {};
  if (opts.temperature !== undefined) genConfig.temperature = opts.temperature;
  if (opts.maxTokens !== undefined) genConfig.maxOutputTokens = opts.maxTokens;
  if (opts.responseFormat?.type === "json_object") {
    genConfig.responseMimeType = "application/json";
  }
  if (Object.keys(genConfig).length > 0) {
    body.generationConfig = genConfig;
  }

  // Tool calling
  if (opts.tools && opts.tools.length > 0) {
    body.tools = [
      { functionDeclarations: toGeminiFunctionDeclarations(opts.tools) },
    ];
    if (opts.toolChoice && typeof opts.toolChoice === "object" && opts.toolChoice.type === "function") {
      body.toolConfig = {
        functionCallingConfig: {
          mode: "ANY",
          allowedFunctionNames: [opts.toolChoice.function.name],
        },
      };
    }
  }

  const url = `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`;

  // Retry loop (max 2 retries on 429)
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      const delay = 2000 * Math.pow(2, attempt - 1); // 2s, 4s
      console.warn(`[GeminiClient] Retry ${attempt}/2 after ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (response.status === 429 && attempt < 2) {
      console.warn(`[GeminiClient] Rate limited (429), will retry...`);
      lastError = new Error("Rate limit exceeded");
      continue;
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[GeminiClient] API error ${response.status}:`, errText);
      throw new Error(`Gemini API error: ${response.status} — ${errText}`);
    }

    const result = await response.json();
    const candidate = result.candidates?.[0];
    if (!candidate) {
      throw new Error("No candidates returned from Gemini API");
    }

    const parts = candidate.content?.parts || [];

    // Check for function call response
    const fnCall = parts.find((p: any) => p.functionCall);
    if (fnCall) {
      return {
        text: "",
        toolCall: {
          name: fnCall.functionCall.name,
          arguments: JSON.stringify(fnCall.functionCall.args),
        },
      };
    }

    // Text response
    const text = parts
      .filter((p: any) => p.text)
      .map((p: any) => p.text)
      .join("");

    return { text };
  }

  throw lastError || new Error("Gemini API call failed after retries");
}
