import { normalizePhotoEstimate } from '../../src/lib/photo-estimate';

interface Env {
  OPENAI_API_KEY?: string;
  OPENAI_FOOD_VISION_MODEL?: string;
}

interface PagesContext {
  request: Request;
  env: Env;
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const NUTRITION_PROPERTIES = {
  calories: { type: 'number', minimum: 0 },
  protein: { type: 'number', minimum: 0 },
  fat: { type: 'number', minimum: 0 },
  totalCarbs: { type: 'number', minimum: 0 },
  fibre: { type: 'number', minimum: 0 },
  sugarAlcohols: { type: 'number', minimum: 0 },
  netCarbs: { type: 'number', minimum: 0 },
  sodium: { type: 'number', minimum: 0 },
  potassium: { type: 'number', minimum: 0 },
  magnesium: { type: 'number', minimum: 0 },
  calciumMg: { type: ['number', 'null'], minimum: 0 },
  ironMg: { type: ['number', 'null'], minimum: 0 },
  zincMg: { type: ['number', 'null'], minimum: 0 },
  vitaminDMcg: { type: ['number', 'null'], minimum: 0 },
  vitaminB12Mcg: { type: ['number', 'null'], minimum: 0 },
  omega3G: { type: ['number', 'null'], minimum: 0 },
  omega6G: { type: ['number', 'null'], minimum: 0 },
};
const NUTRITION_REQUIRED = Object.keys(NUTRITION_PROPERTIES);

const PHOTO_ESTIMATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    analysisId: { type: 'string' },
    createdAt: { type: 'string' },
    overallConfidence: { type: 'number', minimum: 0, maximum: 1 },
    summaryName: { type: 'string' },
    servingDescription: { type: 'string' },
    items: {
      type: 'array', minItems: 1,
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          name: { type: 'string' }, portionEstimate: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          ...NUTRITION_PROPERTIES,
        },
        required: ['name', 'portionEstimate', 'confidence', ...NUTRITION_REQUIRED],
      },
    },
    totals: {
      type: 'object', additionalProperties: false,
      properties: NUTRITION_PROPERTIES, required: NUTRITION_REQUIRED,
    },
    assumptions: { type: 'array', items: { type: 'string' } },
    warnings: { type: 'array', items: { type: 'string' } },
    needsUserReview: { type: 'boolean' },
  },
  required: ['analysisId', 'createdAt', 'overallConfidence', 'summaryName', 'servingDescription', 'items', 'totals', 'assumptions', 'warnings', 'needsUserReview'],
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

function outputText(response: Record<string, unknown>): string | null {
  if (typeof response.output_text === 'string') return response.output_text;
  if (!Array.isArray(response.output)) return null;
  for (const output of response.output) {
    if (!output || typeof output !== 'object' || !Array.isArray((output as { content?: unknown }).content)) continue;
    for (const content of (output as { content: unknown[] }).content) {
      if (content && typeof content === 'object' && typeof (content as { text?: unknown }).text === 'string') return (content as { text: string }).text;
    }
  }
  return null;
}

function isUploadedFile(value: unknown): value is File {
  return typeof value === 'object' && value !== null &&
    typeof (value as { size?: unknown }).size === 'number' &&
    typeof (value as { type?: unknown }).type === 'string' &&
    typeof (value as { arrayBuffer?: unknown }).arrayBuffer === 'function';
}

export async function handleAnalyzeFoodPhoto(
  request: Request,
  env: Env,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'Upload a valid image using multipart form data.' }, 400);
  }
  const image = form.get('image');
  if (!isUploadedFile(image) || image.size === 0) return json({ error: 'No image was selected.' }, 400);
  if (!ALLOWED_IMAGE_TYPES.has(image.type)) return json({ error: 'Unsupported image type. Use JPEG, PNG, WebP, or GIF.' }, 415);
  if (image.size > MAX_IMAGE_BYTES) return json({ error: 'Image is too large. Choose an image under 8 MB.' }, 413);
  if (!env.OPENAI_API_KEY) return json({ error: 'Photo analysis is not configured. The server is missing OPENAI_API_KEY.' }, 503);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const imageUrl = `data:${image.type};base64,${toBase64(await image.arrayBuffer())}`;
    const aiResponse = await fetcher('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: env.OPENAI_FOOD_VISION_MODEL || 'gpt-4.1-mini',
        input: [{
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: 'Estimate the visible foods and nutrition in this image conservatively. Account for uncertain portions, hidden oils, sauces, and mixed dishes. Return one editable best estimate, list assumptions and warnings, use confidence from 0 to 1, avoid medical claims, and always set needsUserReview true when ingredients or portions are unclear. Nutrition units: calories kcal; protein, fat, totalCarbs, fibre, sugarAlcohols, netCarbs, omega3G and omega6G in grams; sodium, potassium, magnesium, calciumMg, ironMg and zincMg in milligrams; vitaminDMcg and vitaminB12Mcg in micrograms. Return null for optional micronutrients that cannot be reasonably estimated. Net carbs must be max(0, totalCarbs - fibre - sugarAlcohols). This is an approximation and must not be described as exact.',
            },
            { type: 'input_image', image_url: imageUrl, detail: 'high' },
          ],
        }],
        text: {
          format: {
            type: 'json_schema', name: 'food_photo_estimate', strict: true,
            schema: PHOTO_ESTIMATE_SCHEMA,
          },
        },
      }),
    });
    if (!aiResponse.ok) return json({ error: 'The AI provider could not analyse this photo. Try again later.' }, 502);
    const raw = await aiResponse.json() as Record<string, unknown>;
    const text = outputText(raw);
    if (!text) return json({ error: 'The AI provider returned no usable estimate.' }, 502);
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { return json({ error: 'The AI provider returned an invalid estimate.' }, 502); }
    if (parsed && typeof parsed === 'object') {
      (parsed as Record<string, unknown>).analysisId = crypto.randomUUID();
      (parsed as Record<string, unknown>).createdAt = new Date().toISOString();
    }
    const estimate = normalizePhotoEstimate(parsed);
    if (!estimate) return json({ error: 'The AI estimate failed safety validation. Try another photo.' }, 502);
    return json(estimate);
  } catch (error) {
    return json({ error: error instanceof DOMException && error.name === 'AbortError' ? 'Photo analysis timed out. Try again.' : 'Photo analysis failed because of a network or server error.' }, 502);
  } finally {
    clearTimeout(timeout);
  }
}

export const onRequestPost = (context: PagesContext) => handleAnalyzeFoodPhoto(context.request, context.env);
