import type { PixAnalysisResult, PixValidationOutcome } from '@/lib/pix-types';

interface ValidationConfig {
  minPixAmountCents: number;
  minAiConfidence: number;
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

export function formatCurrencyFromCents(amountCents: number | null): string {
  if (amountCents === null) {
    return 'Não identificado';
  }

  return currencyFormatter.format(amountCents / 100);
}

export function formatConfidencePercent(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

export function evaluatePixAnalysis(
  analysis: PixAnalysisResult,
  config: ValidationConfig
): PixValidationOutcome {
  const bankLabel = analysis.bank ?? 'Não identificado';

  if (!analysis.isPixReceipt && analysis.amountCents === null) {
    return {
      status: 'rejected',
      message:
        'Não foi possível analisar o comprovante. Envie uma nova foto ou screenshot com melhor qualidade.',
      bankLabel,
      amountCents: null,
      currency: null,
      confidence: analysis.confidence
    };
  }

  if (!analysis.isPixReceipt) {
    return {
      status: 'rejected',
      message: 'A imagem enviada não parece ser um comprovante Pix válido.',
      bankLabel,
      amountCents: analysis.amountCents,
      currency: analysis.currency,
      confidence: analysis.confidence
    };
  }

  if (analysis.amountCents === null) {
    return {
      status: 'rejected',
      message: 'Não foi possível identificar o valor do comprovante.',
      bankLabel,
      amountCents: null,
      currency: analysis.currency,
      confidence: analysis.confidence
    };
  }

  if (analysis.currency !== 'BRL') {
    return {
      status: 'rejected',
      message: 'A moeda identificada não é compatível com um comprovante Pix em reais.',
      bankLabel,
      amountCents: analysis.amountCents,
      currency: analysis.currency,
      confidence: analysis.confidence
    };
  }

  if (analysis.confidence < config.minAiConfidence) {
    return {
      status: 'rejected',
      message: 'A leitura do comprovante ficou abaixo do nível mínimo de confiança.',
      bankLabel,
      amountCents: analysis.amountCents,
      currency: analysis.currency,
      confidence: analysis.confidence
    };
  }

  if (analysis.amountCents < config.minPixAmountCents) {
    return {
      status: 'rejected',
      message: 'Valor inferior ao mínimo necessário.',
      bankLabel,
      amountCents: analysis.amountCents,
      currency: analysis.currency,
      confidence: analysis.confidence
    };
  }

  return {
    status: 'approved',
    message: 'Comprovante aprovado.',
    bankLabel,
    amountCents: analysis.amountCents,
    currency: analysis.currency,
    confidence: analysis.confidence
  };
}
