// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';

import { analyzePixReceiptWithProvider } from '@/lib/ocr-provider';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('mock OCR provider', () => {
  it('returns a rejected low-amount scenario based on the file name', async () => {
    const result = await analyzePixReceiptWithProvider({
      buffer: Buffer.from('test'),
      mimeType: 'image/jpeg',
      provider: 'mock',
      fileName: 'low-amount-comprovante.jpg'
    });

    expect(result.amountCents).toBe(5000);
    expect(result.currency).toBe('BRL');
    expect(result.confidence).toBe(0.91);
  });

  it('parses the OpenAI responses API output message content shape', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: '{"isPixReceipt":true,"bank":"Nubank","amountCents":9700,"currency":"BRL","confidence":0.95}'
              }
            ]
          }
        ]
      })
    } as Response);

    const result = await analyzePixReceiptWithProvider({
      buffer: Buffer.from('test'),
      mimeType: 'image/png',
      provider: 'openai',
      openAiApiKey: 'test-key'
    });

    expect(result).toEqual({
      isPixReceipt: true,
      bank: 'Nubank',
      amountCents: 9700,
      currency: 'BRL',
      confidence: 0.95
    });
  });

  it('instructs the OCR prompt to prioritize the sender origin or app issuer when identifying bank', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: '{"isPixReceipt":true,"bank":"Nubank","amountCents":9700,"currency":"BRL","confidence":0.95}'
      })
    } as Response);

    await analyzePixReceiptWithProvider({
      buffer: Buffer.from('test'),
      mimeType: 'image/png',
      provider: 'openai',
      openAiApiKey: 'test-key'
    });

    const [, requestInit] = fetchSpy.mock.calls[0] ?? [];
    const body = JSON.parse(String(requestInit?.body ?? '{}'));
    const prompt = body.input?.[0]?.content?.find((item: { type?: string }) => item.type === 'input_text')?.text ?? '';

    expect(prompt).toContain('Priorize o banco do app, instituição emissora ou carteira usada para enviar o Pix');
    expect(prompt).toContain('logo, cabeçalho ou nome da instituição emissora do app');
    expect(prompt).toContain('Só use a seção "Origem"');
    expect(prompt).toContain('Retorne o nome comercial mais reconhecível da instituição');
  });
});
