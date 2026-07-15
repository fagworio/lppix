const DEFAULT_MAX_UPLOAD_SIZE_MB = 8;
const DEFAULT_MIN_PIX_AMOUNT_CENTS = 9700;
const DEFAULT_MIN_AI_CONFIDENCE = 0.75;

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getClientConfig() {
  return {
    maxUploadSizeMb: parseNumber(process.env.MAX_UPLOAD_SIZE_MB, DEFAULT_MAX_UPLOAD_SIZE_MB),
    minPixAmountCents: parseNumber(process.env.MIN_PIX_AMOUNT_CENTS, DEFAULT_MIN_PIX_AMOUNT_CENTS),
    ga4MeasurementId: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID?.trim() ?? '',
    metaPixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? ''
  };
}

export function getServerConfig() {
  const maxUploadSizeMb = parseNumber(process.env.MAX_UPLOAD_SIZE_MB, DEFAULT_MAX_UPLOAD_SIZE_MB);
  const minPixAmountCents = parseNumber(process.env.MIN_PIX_AMOUNT_CENTS, DEFAULT_MIN_PIX_AMOUNT_CENTS);
  const minAiConfidence = parseNumber(process.env.MIN_AI_CONFIDENCE, DEFAULT_MIN_AI_CONFIDENCE);
  const whatsappBaseUrl = process.env.WHATSAPP_URL?.trim() ?? '';
  const whatsappMessage = process.env.WHATSAPP_MESSAGE?.trim() ??
    'Olá, meu comprovante foi analisado e quero acessar o Grupo VIP.';
  const ocrProvider = (process.env.OCR_PROVIDER?.trim() ?? 'mock') as 'mock' | 'openai';
  const openAiApiKey = process.env.OPENAI_API_KEY?.trim() ?? '';

  if (!whatsappBaseUrl) {
    throw new Error('WHATSAPP_URL não foi configurada no servidor.');
  }

  return {
    maxUploadSizeMb,
    minPixAmountCents,
    minAiConfidence,
    whatsappBaseUrl,
    whatsappMessage,
    ocrProvider,
    openAiApiKey
  };
}

export function buildWhatsAppUrl(baseUrl: string, message: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set('text', message);
  return url.toString();
}
