import { describe, expect, it } from 'vitest';

import { evaluatePixAnalysis, formatCurrencyFromCents, formatConfidencePercent } from '@/lib/pix-validation';

describe('evaluatePixAnalysis', () => {
  it('approves a valid Pix receipt even when the bank is not identified', () => {
    const result = evaluatePixAnalysis(
      {
        isPixReceipt: true,
        bank: null,
        amountCents: 9700,
        currency: 'BRL',
        confidence: 0.91
      },
      {
        minPixAmountCents: 9700,
        minAiConfidence: 0.75
      }
    );

    expect(result.status).toBe('approved');
    expect(result.message).toBe('Comprovante aprovado.');
    expect(result.bankLabel).toBe('Não identificado');
  });

  it('rejects receipts below the minimum amount', () => {
    const result = evaluatePixAnalysis(
      {
        isPixReceipt: true,
        bank: 'Nubank',
        amountCents: 5000,
        currency: 'BRL',
        confidence: 0.91
      },
      {
        minPixAmountCents: 9700,
        minAiConfidence: 0.75
      }
    );

    expect(result.status).toBe('rejected');
    expect(result.message).toContain('Valor inferior ao mínimo necessário');
  });

  it('returns an error message for unreadable images', () => {
    const result = evaluatePixAnalysis(
      {
        isPixReceipt: false,
        bank: null,
        amountCents: null,
        currency: null,
        confidence: 0.2
      },
      {
        minPixAmountCents: 9700,
        minAiConfidence: 0.75
      }
    );

    expect(result.status).toBe('rejected');
    expect(result.message).toBe('Não foi possível analisar o comprovante. Envie uma nova foto ou screenshot com melhor qualidade.');
  });
});

describe('format helpers', () => {
  it('formats BRL cents safely', () => {
    expect(formatCurrencyFromCents(9700)).toBe('R$ 97,00');
  });

  it('formats confidence percent with rounding', () => {
    expect(formatConfidencePercent(0.914)).toBe('91%');
  });
});
