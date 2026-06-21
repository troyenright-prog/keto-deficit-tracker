// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { handleAnalyzeFoodPhoto } from '../../functions/api/analyze-food-photo';

function requestWith(file?: Blob, filename = 'food.png'): Request {
  const form = new FormData();
  if (file) form.append('image', file, filename);
  return new Request('https://example.com/api/analyze-food-photo', { method: 'POST', body: form });
}

describe('photo analysis endpoint validation', () => {
  it('rejects a missing image', async () => {
    const response = await handleAnalyzeFoodPhoto(requestWith(), {});
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'No image was selected.' });
  });

  it('rejects unsupported image types', async () => {
    const response = await handleAnalyzeFoodPhoto(requestWith(new Blob(['text'], { type: 'text/plain' }), 'food.txt'), {});
    expect(response.status).toBe(415);
  });

  it('reports a missing server API key without contacting OpenAI', async () => {
    const fetcher = (() => { throw new Error('must not run'); }) as typeof fetch;
    const response = await handleAnalyzeFoodPhoto(requestWith(new Blob(['image'], { type: 'image/png' })), {}, fetcher);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining('OPENAI_API_KEY') });
  });

  it('maps provider quota failures to a safe actionable error', async () => {
    const fetcher = vi.fn(async () => new Response('{}', { status: 429 })) as unknown as typeof fetch;
    const response = await handleAnalyzeFoodPhoto(
      requestWith(new Blob(['image'], { type: 'image/png' })),
      { OPENAI_API_KEY: 'server-only-test-key' },
      fetcher,
    );
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining('quota') });
  });
});
