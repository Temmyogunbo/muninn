const MAX_JSON_UNWRAP = 4;

/**
 * If the value was JSON-stringified (or double-encoded), peel string layers so we get the raw text.
 */
function unwrapJsonStringLayers(s: string, depth: number): string {
  if (depth <= 0) return s;
  const t = s.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(t);
      if (typeof parsed === "string") {
        return unwrapJsonStringLayers(parsed, depth - 1);
      }
    } catch {
      /* not valid JSON string */
    }
  }
  return s;
}

/**
 * Many pipelines store or emit literal escape sequences in the string body (`\` + `n`, etc.) instead
 * of real newlines. Without this, ReactMarkdown sees a single line and never treats `#` as a heading.
 */
function unescapeEmbeddedEscapes(s: string): string {
  let out = s;
  // Order: longer sequences first
  out = out.replace(/\\r\\n/g, "\n");
  out = out.replace(/\\n/g, "\n");
  out = out.replace(/\\r/g, "\n");
  out = out.replace(/\\t/g, "\t");
  // Some models emit `\#` for headings; after real newlines exist, make headings work
  out = out.replace(/(^|\n)\\#/g, "$1#");
  return out;
}

function normalizeMarkdownSourceString(s: string): string {
  let out = unwrapJsonStringLayers(s, MAX_JSON_UNWRAP);
  out = unescapeEmbeddedEscapes(out);
  // Normalize line endings; trim only outer whitespace, not each line
  out = out.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return out.trim();
}

/** Normalize API `report_payload` (string, JSON, or object) to markdown for display. */
export function reportPayloadToMarkdown(payload: unknown): string {
  if (payload == null || payload === "") {
    return "_No report content was returned._";
  }
  if (typeof payload === "string") {
    return normalizeMarkdownSourceString(payload);
  }
  if (typeof payload === "object" && payload !== null) {
    const o = payload as Record<string, unknown>;
    for (const k of ["markdown", "content", "body", "text", "report"] as const) {
      const v = o[k];
      if (typeof v === "string") {
        return normalizeMarkdownSourceString(v);
      }
    }
  }
  return ["```json", JSON.stringify(payload, null, 2), "```"].join("\n");
}
