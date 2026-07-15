import { randomUUID } from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';

import { analyzePixReceiptWithProvider } from '@/lib/ocr-provider';
import { buildWhatsAppUrl, getServerConfig } from '@/lib/env';
import { evaluatePixAnalysis } from '@/lib/pix-validation';
import { isRateLimited } from '@/lib/rate-limit';
import type { AnalyzePixApiResponse } from '@/lib/pix-types';
import { preprocessUploadImage, validateUploadFile } from '@/lib/upload-validation';

function jsonResponse(statusCode: number, payload: AnalyzePixApiResponse) {
  return NextResponse.json(payload, { status: statusCode });
}

export async function POST(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const requestIdentifier = forwardedFor || 'unknown-client';

  if (isRateLimited(requestIdentifier)) {
    return jsonResponse(429, {
      status: 'error',
      message: 'Muitas tentativas em sequência. Aguarde um minuto e tente novamente.',
      bank: null,
      amountCents: null,
      currency: null,
      confidence: 0,
      whatsappUrl: null,
      transactionId: null
    });
  }

  const serverConfig = getServerConfig();
  const formData = await request.formData();
  const file = formData.get('receipt');

  if (!(file instanceof File)) {
    return jsonResponse(400, {
      status: 'error',
      message: 'Selecione uma imagem do comprovante Pix antes de continuar.',
      bank: null,
      amountCents: null,
      currency: null,
      confidence: 0,
      whatsappUrl: null,
      transactionId: null
    });
  }

  const validation = await validateUploadFile(file, serverConfig.maxUploadSizeMb);
  if (!validation.ok) {
    return jsonResponse(400, {
      status: 'error',
      message: validation.message,
      bank: null,
      amountCents: null,
      currency: null,
      confidence: 0,
      whatsappUrl: null,
      transactionId: null
    });
  }

  try {
    const processed = await preprocessUploadImage(validation.buffer);
    const analysis = await analyzePixReceiptWithProvider({
      buffer: processed.buffer,
      mimeType: processed.mimeType,
      provider: serverConfig.ocrProvider,
      openAiApiKey: serverConfig.openAiApiKey,
      fileName: file.name
    });

    const outcome = evaluatePixAnalysis(analysis, {
      minPixAmountCents: serverConfig.minPixAmountCents,
      minAiConfidence: serverConfig.minAiConfidence
    });

    return jsonResponse(200, {
      status: outcome.status,
      message: outcome.message,
      bank: analysis.bank,
      amountCents: analysis.amountCents,
      currency: analysis.currency,
      confidence: analysis.confidence,
      transactionId: randomUUID(),
      whatsappUrl:
        outcome.status === 'approved'
          ? buildWhatsAppUrl(serverConfig.whatsappBaseUrl, serverConfig.whatsappMessage)
          : null
    });
  } catch {
    return jsonResponse(500, {
      status: 'error',
      message: 'Ocorreu um erro ao processar o comprovante. Tente novamente.',
      bank: null,
      amountCents: null,
      currency: null,
      confidence: 0,
      whatsappUrl: null,
      transactionId: null
    });
  }
}
