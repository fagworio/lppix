export interface PixAnalysisResult {
  isPixReceipt: boolean;
  bank: string | null;
  amountCents: number | null;
  currency: 'BRL' | null;
  confidence: number;
}

export type ValidationStatus = 'approved' | 'rejected' | 'error';

export interface PixValidationOutcome {
  status: ValidationStatus;
  message: string;
  bankLabel: string;
  amountCents: number | null;
  currency: 'BRL' | null;
  confidence: number;
}

export interface AnalyzePixApiResponse {
  status: ValidationStatus;
  message: string;
  bank: string | null;
  amountCents: number | null;
  currency: 'BRL' | null;
  confidence: number;
  whatsappUrl: string | null;
  transactionId: string | null;
}
