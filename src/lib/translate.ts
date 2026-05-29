// DeepL translation client (Free or Pro tier, auto-detected from the key).
// Used by the sync-anime cron to translate English synopses to Japanese.
// Free API keys end with ":fx" and use the api-free.deepl.com endpoint.

const DEEPL_FREE_URL = "https://api-free.deepl.com/v2/translate";
const DEEPL_PRO_URL = "https://api.deepl.com/v2/translate";

/** Thrown on DeepL API errors so callers can react to quota/rate limits. */
export class DeepLError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "DeepLError";
  }
}

interface DeepLResponse {
  translations: { detected_source_language: string; text: string }[];
}

/**
 * Translate English text to Japanese via DeepL.
 * @throws {DeepLError} when the key is missing or the API returns a non-2xx status.
 */
export async function translateToJapanese(text: string): Promise<string> {
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) {
    throw new DeepLError(0, "DEEPL_API_KEY not configured");
  }

  const url = apiKey.endsWith(":fx") ? DEEPL_FREE_URL : DEEPL_PRO_URL;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: [text],
      source_lang: "EN",
      target_lang: "JA",
    }),
  });

  if (!res.ok) {
    throw new DeepLError(res.status, `DeepL API error: ${res.status}`);
  }

  const json = (await res.json()) as DeepLResponse;
  const translated = json.translations?.[0]?.text;
  if (!translated) {
    throw new DeepLError(res.status, "DeepL API returned no translation");
  }
  return translated;
}
