import { normalizeBarcode } from '../../src/lib/barcode';
import { MICRONUTRIENT_KEYS, type MicronutrientKey } from '../../src/lib/micronutrients';

type Env = {
  OPENAI_API_KEY?: string;
  OPENAI_NUTRITION_LABEL_MODEL?: string;
};

type UnknownRecord = Record<string, unknown>;

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DEFAULT_MODEL = 'gpt-5.5';

const CORE_NUTRIENT_KEYS = [
  'calories',
  'proteinG',
  'fatG',
  'totalCarbsG',
  'fibreG',
  'sugarAlcoholsG',
  'sodiumMg',
  'potassiumMg',
  'magnesiumMg',
] as const;

const NUTRIENT_KEYS = [...CORE_NUTRIENT_KEYS, ...MICRONUTRIENT_KEYS] as const;

type CoreNutrientKey = typeof CORE_NUTRIENT_KEYS[number];
type NutrientKey = CoreNutrientKey | MicronutrientKey;

type ExtractedNutritionLabel = Record<NutrientKey, number> & {
  productName: string;
  brand: string;
  servingSize: string;
  dataBasis: 'serving' | '100g';
  confidence: number;
  warnings: string[];
};

const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null && !Array.isArray(value);
const asText = (value: unknown): string | undefined => typeof value === 'string' && value.trim() ? value.trim() : undefined;
const safeNumber = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;

const nutrientProperties = NUTRIENT_KEYS.reduce((result, key) => {
  result[key] = { type: 'number' };
  return result;
}, {} as Record<NutrientKey, { type: 'number' }>);

const nutritionLabelSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    productName: { type: 'string' },
    brand: { type: 'string' },
    servingSize: { type: 'string' },
    dataBasis: { type: 'string', enum: ['serving', '100g'] },
    ...nutrientProperties,
    confidence: { type: 'number' },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'productName',
    'brand',
    'servingSize',
    'dataBasis',
    ...NUTRIENT_KEYS,
    'confidence',
    'warnings',
  ],
};

const labelPrompt = [
  'Extract nutrition facts from this photographed nutrition information panel.',
  'Return only facts that are visible on the product label or nutrition panel.',
  'Prefer per-serving values when shown; otherwise use per-100g values and set dataBasis to 100g.',
  'If calories/kcal are not shown but kJ is shown, convert to kcal using kJ / 4.184.',
  'Convert nutrient values into the units named by the JSON keys, such as grams, milligrams, or micrograms.',
  'Use 0 for fields that are not visible. Do not infer missing micronutrients or vitamins.',
  'If the image is not a nutrition label, return empty product, brand, and serving strings, zero nutrients, confidence 0, and a warning.',
].join('\n');

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...corsHeaders(),
    },
  });
}

function noContent(): Response {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function outputTextFromOpenAiResponse(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  const direct = asText(value.output_text);
  if (direct) return direct;

  if (!Array.isArray(value.output)) return undefined;
  for (const output of value.output) {
    if (!isRecord(output) || !Array.isArray(output.content)) continue;
    for (const part of output.content) {
      if (!isRecord(part)) continue;
      const type = asText(part.type);
      if (type === 'output_text' || type === 'text') {
        const text = asText(part.text);
        if (text) return text;
      }
    }
  }
  return undefined;
}

function refusalFromOpenAiResponse(value: unknown): string | undefined {
  if (!isRecord(value) || !Array.isArray(value.output)) return undefined;
  for (const output of value.output) {
    if (!isRecord(output) || !Array.isArray(output.content)) continue;
    for (const part of output.content) {
      if (!isRecord(part)) continue;
      if (asText(part.type) === 'refusal') return asText(part.refusal) ?? 'The nutrition label could not be read from that photo.';
    }
  }
  return undefined;
}

function normalizeWarnings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(asText).filter((item): item is string => Boolean(item)).slice(0, 6);
}

function normalizeExtractedLabel(value: unknown): ExtractedNutritionLabel | null {
  if (!isRecord(value)) return null;
  const dataBasis = value.dataBasis === '100g' ? '100g' : 'serving';
  const result = {
    productName: asText(value.productName) ?? '',
    brand: asText(value.brand) ?? '',
    servingSize: asText(value.servingSize) ?? '',
    dataBasis,
    confidence: Math.min(1, safeNumber(value.confidence)),
    warnings: normalizeWarnings(value.warnings),
  } as ExtractedNutritionLabel;

  for (const key of NUTRIENT_KEYS) {
    result[key] = safeNumber(value[key]);
  }
  return result;
}

async function parseWithOpenAi(image: File, env: Env, fetcher: typeof fetch): Promise<ExtractedNutritionLabel> {
  const bytes = new Uint8Array(await image.arrayBuffer());
  const dataUrl = `data:${image.type};base64,${bytesToBase64(bytes)}`;
  const response = await fetcher('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: env.OPENAI_NUTRITION_LABEL_MODEL?.trim() || DEFAULT_MODEL,
      input: [{
        role: 'user',
        content: [
          { type: 'input_text', text: labelPrompt },
          { type: 'input_image', image_url: dataUrl },
        ],
      }],
      text: {
        format: {
          type: 'json_schema',
          name: 'nutrition_label',
          schema: nutritionLabelSchema,
          strict: true,
        },
      },
    }),
  });

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }

  if (!response.ok) throw new Error('Nutrition label import failed. Try another photo or enter the food manually.');
  const refusal = refusalFromOpenAiResponse(body);
  if (refusal) throw new Error(refusal);

  const outputText = outputTextFromOpenAiResponse(body);
  if (!outputText) throw new Error('Nutrition label import returned no readable nutrition data.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(outputText);
  } catch {
    throw new Error('Nutrition label import returned unreadable nutrition data.');
  }

  const normalized = normalizeExtractedLabel(parsed);
  if (!normalized) throw new Error('Nutrition label import returned incomplete nutrition data.');
  return normalized;
}

function foodFromExtractedLabel(label: ExtractedNutritionLabel, barcode: string): UnknownRecord {
  const result: UnknownRecord = {
    barcode,
    name: label.productName || 'Scanned nutrition label',
    brand: label.brand || undefined,
    servingSize: label.servingSize || (label.dataBasis === '100g' ? '100g' : '1 serving'),
    dataBasis: label.dataBasis,
    attribution: 'Nutrition label photo',
    confidence: label.confidence,
    warnings: label.warnings,
  };
  for (const key of NUTRIENT_KEYS) {
    result[key] = label[key];
  }
  return result;
}

export async function handleParseNutritionLabel(request: Request, env: Env = {}, fetcher: typeof fetch = fetch): Promise<Response> {
  if (request.method === 'OPTIONS') return noContent();
  if (request.method !== 'POST') return json({ error: 'Use POST for nutrition label import.' }, 405);
  if (!env.OPENAI_API_KEY?.trim()) {
    return json({ error: 'Nutrition label photo import is not configured yet.' }, 501);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'Upload a nutrition label photo.' }, 400);
  }

  const image = form.get('image');
  if (!(image instanceof File)) return json({ error: 'Upload a nutrition label photo.' }, 400);
  if (!ALLOWED_IMAGE_TYPES.has(image.type)) return json({ error: 'Upload a JPG, PNG, or WebP nutrition label photo.' }, 400);
  if (image.size > MAX_IMAGE_BYTES) return json({ error: 'Nutrition label photo must be smaller than 8 MB.' }, 413);

  const barcode = normalizeBarcode(asText(form.get('barcode')) ?? '');
  try {
    const label = await parseWithOpenAi(image, env, fetcher);
    return json(foodFromExtractedLabel(label, barcode));
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Nutrition label import failed.' }, 502);
  }
}

export const onRequestPost = ({ request, env }: { request: Request; env: Env }) => handleParseNutritionLabel(request, env);
export const onRequestOptions = () => noContent();
