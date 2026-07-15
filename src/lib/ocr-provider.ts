import { z } from 'zod';

import type { PixAnalysisResult } from '@/lib/pix-types';

const openAiResponseSchema = z.object({
  isPixReceipt: z.boolean(),
  bank: z.string().nullable(),
  amountCents: z.number().int().nullable(),
  currency: z.literal('BRL').nullable(),
  confidence: z.number().min(0).max(1)
});

const OCR_PROMPT = `Você receberá uma imagem de comprovante Pix brasileiro. Retorne exclusivamente JSON válido com o formato: {"isPixReceipt": boolean, "bank": string | null, "amountCents": number | null, "currency": "BRL" | null, "confidence": number}. Regras: amountCents em centavos, currency null se não identificar BRL, confidence entre 0 e 1, bank null quando não identificado. Priorize o banco do app, instituição emissora ou carteira usada para enviar o Pix. Se o comprovante estiver claramente marcado pela marca do app ou instituição emissora, como logo, cabeçalho ou nome da instituição emissora do app, use isso como prioridade para bank. Só use a seção "Origem", pagador, remetente, conta debitada ou dados de quem fez a transferência quando a marca do app não estiver clara ou para confirmar a mesma instituição. Só use banco do destinatário se não houver dados confiáveis do remetente nem do app emissor. Retorne o nome comercial mais reconhecível da instituição quando houver variações societárias ou operacionais, por exemplo preferindo "Nubank" em vez de "Nu Pagamentos". Não inclua texto fora do JSON.`;

function extractOpenAiOutputText(payload: { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }) {
  if (payload.output_text?.trim()) {
    return payload.output_text;
  }

  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && content.text?.trim()) {
        return content.text;
      }
    }
  }

  throw new Error('Resposta do OpenAI sem output_text utilizável.');
}

export async function analyzePixReceiptWithProvider(input: {
  buffer: Buffer;
  mimeType: string;
  provider: 'mock' | 'openai';
  openAiApiKey?: string;
  fileName?: string;
}): Promise<PixAnalysisResult> {
  if (input.provider === 'mock') {
    const normalizedFileName = input.fileName?.toLowerCase() ?? '';

    if (normalizedFileName.includes('low-amount')) {
      return {
        isPixReceipt: true,
        bank: 'Nubank',
        amountCents: 5000,
        currency: 'BRL',
        confidence: 0.91
      };
    }

    if (normalizedFileName.includes('low-confidence')) {
      return {
        isPixReceipt: true,
        bank: 'Itaú',
        amountCents: 9700,
        currency: 'BRL',
        confidence: 0.5
      };
    }

    if (normalizedFileName.includes('not-pix')) {
      return {
        isPixReceipt: false,
        bank: null,
        amountCents: null,
        currency: null,
        confidence: 0.3
      };
    }

    return {
      isPixReceipt: true,
      bank: null,
      amountCents: 9700,
      currency: 'BRL',
      confidence: 0.91
    };
  }

  if (!input.openAiApiKey) {
    throw new Error('OPENAI_API_KEY não configurada para OCR_PROVIDER=openai.');
  }

  const imageData = input.buffer.toString('base64');

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.openAiApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: OCR_PROMPT
            },
            {
              type: 'input_image',
              image_url: `data:${input.mimeType};base64,${imageData}`
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Falha do provedor OCR: ${response.status}`);
  }

  const payload = (await response.json()) as {
    output_text?: string;
    output?: Array<{
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    }>;
  };

  const parsedJson = JSON.parse(extractOpenAiOutputText(payload));
  return openAiResponseSchema.parse(parsedJson);
}
