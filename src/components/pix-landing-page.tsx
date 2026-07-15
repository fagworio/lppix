'use client';

import Image from 'next/image';
import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { formatConfidencePercent, formatCurrencyFromCents } from '@/lib/pix-validation';
import type { AnalyzePixApiResponse } from '@/lib/pix-types';
import { trackBeginCheckout, trackPageView, trackPixPurchase } from '@/lib/tracking';

interface PixLandingPageProps {
  minPixAmountCents: number;
  maxUploadSizeMb: number;
  initialAgeVerified?: boolean;
}

type AgeGateStatus = 'pending' | 'verified' | 'denied';

const AGE_VERIFIED_STORAGE_KEY = 'age_verified';
const AGE_VERIFIED_COOKIE_KEY = 'age_verified';
const AGE_VERIFICATION_EVENT = 'age-verification-change';

function subscribeToAgeVerification(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handleChange = () => onStoreChange();
  window.addEventListener('storage', handleChange);
  window.addEventListener(AGE_VERIFICATION_EVENT, handleChange);

  return () => {
    window.removeEventListener('storage', handleChange);
    window.removeEventListener(AGE_VERIFICATION_EVENT, handleChange);
  };
}

function getAgeVerificationSnapshot() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(AGE_VERIFIED_STORAGE_KEY) === 'true';
}

function dispatchAgeVerificationChange() {
  window.dispatchEvent(new Event(AGE_VERIFICATION_EVENT));
}

function persistAgeVerification() {
  window.localStorage.setItem(AGE_VERIFIED_STORAGE_KEY, 'true');
  document.cookie = `${AGE_VERIFIED_COOKIE_KEY}=true; Path=/; Max-Age=31536000; SameSite=Lax`;
  dispatchAgeVerificationChange();
}

function clearAgeVerification() {
  window.localStorage.removeItem(AGE_VERIFIED_STORAGE_KEY);
  document.cookie = `${AGE_VERIFIED_COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
  dispatchAgeVerificationChange();
}

function formatFileSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function PixLandingPage({
  minPixAmountCents,
  maxUploadSizeMb,
  initialAgeVerified = false
}: PixLandingPageProps) {
  const uploadSectionRef = useRef<HTMLElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzePixApiResponse | null>(null);
  const [ageGateStatus, setAgeGateStatus] = useState<AgeGateStatus>(initialAgeVerified ? 'verified' : 'pending');
  const hasTrackedPageViewRef = useRef(false);
  const lastTrackedPurchaseRef = useRef<string | null>(null);
  const storedAgeVerified = useSyncExternalStore(
    subscribeToAgeVerification,
    getAgeVerificationSnapshot,
    () => initialAgeVerified
  );

  const minimumAmountLabel = useMemo(() => formatCurrencyFromCents(minPixAmountCents), [minPixAmountCents]);
  const isAgeVerified = storedAgeVerified || ageGateStatus === 'verified';

  useEffect(() => {
    if (hasTrackedPageViewRef.current) {
      return;
    }

    trackPageView();
    hasTrackedPageViewRef.current = true;
  }, []);

  useEffect(() => {
    if (result?.status !== 'approved' || !result.transactionId) {
      return;
    }

    if (lastTrackedPurchaseRef.current === result.transactionId) {
      return;
    }

    trackPixPurchase({
      amountCents: result.amountCents,
      currency: result.currency,
      transactionId: result.transactionId
    });
    lastTrackedPurchaseRef.current = result.transactionId;
  }, [result]);

  function confirmAge() {
    persistAgeVerification();
    setAgeGateStatus('verified');
  }

  function denyAge() {
    clearAgeVerification();
    setAgeGateStatus('denied');
  }

  function resetPreview() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
  }

  function clearSelection() {
    resetPreview();
    setSelectedFile(null);
    setUploadError(null);
    setResult(null);
    lastTrackedPurchaseRef.current = null;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function handleUploadButtonClick() {
    trackBeginCheckout(minPixAmountCents);
    fileInputRef.current?.click();
  }

  async function handleSelect(file: File | null) {
    setUploadError(null);
    setResult(null);

    if (!file) {
      clearSelection();
      return;
    }

    const extension = file.name.split('.').pop()?.toLowerCase();
    const allowedExtensions = new Set(['jpg', 'jpeg', 'png', 'webp']);
    const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

    if (!extension || !allowedExtensions.has(extension) || !allowedMimeTypes.has(file.type)) {
      clearSelection();
      setUploadError('Formato de arquivo não permitido. Envie uma imagem JPG, PNG ou WebP.');
      return;
    }

    if (file.size > maxUploadSizeMb * 1024 * 1024) {
      clearSelection();
      setUploadError(`O arquivo excede o limite de até ${maxUploadSizeMb} MB.`);
      return;
    }

    resetPreview();
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setSelectedFile(file);
    await handleAnalyze(file);
  }

  async function handleAnalyze(fileOverride?: File) {
    const fileToAnalyze = fileOverride ?? selectedFile;

    if (!fileToAnalyze || isAnalyzing) {
      return;
    }

    const formData = new FormData();
    formData.append('receipt', fileToAnalyze);

    setIsAnalyzing(true);
    setUploadError(null);
    setResult(null);

    try {
      const response = await fetch('/api/pix/analyze', {
        method: 'POST',
        body: formData
      });

      const payload = (await response.json()) as AnalyzePixApiResponse;
      setResult(payload);

      if (!response.ok && payload.message) {
        setUploadError(payload.message);
      }
    } catch {
      const errorResult: AnalyzePixApiResponse = {
        status: 'error',
        message: 'Ocorreu um erro ao processar o comprovante. Tente novamente.',
        bank: null,
        amountCents: null,
        currency: null,
        confidence: 0,
        whatsappUrl: null,
        transactionId: null
      };
      setResult(errorResult);
      setUploadError(errorResult.message);
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <>
      {!isAgeVerified ? (
        <div className="age-gate-overlay" role="dialog" aria-modal="true" aria-labelledby="age-gate-title">
          <div className="age-gate-card">
            <h2 id="age-gate-title">Você tem 18 anos ou mais?</h2>
            <p>Este conteúdo é destinado exclusivamente a maiores de 18 anos.</p>
            {ageGateStatus === 'denied' ? (
              <div className="age-gate-denied">
                <h2>Acesso não permitido</h2>
                <p>Este conteúdo é destinado exclusivamente a maiores de 18 anos.</p>
                <strong>Volte quando completar 18 anos.</strong>
              </div>
            ) : ageGateStatus === 'pending' ? (
              <div className="age-gate-actions">
                <button className="primary-button" type="button" onClick={confirmAge}>
                  Sim, tenho 18 anos ou mais
                </button>
                <button className="secondary-button" type="button" onClick={denyAge}>
                  Não tenho 18 anos
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <main className={`page-shell ${isAgeVerified ? '' : 'page-shell--locked'}`} aria-hidden={!isAgeVerified}>
      <section className="hero-card">
        <p className="eyebrow">01. Faça parte de um grupo exclusivo!</p>
        <h1>Entre para o Grupo VIP de Dicas Esportivas</h1>
        <p className="hero-copy">
          Receba análises, informações e conteúdos exclusivos diretamente pelo WhatsApp.
        </p>
        <p className="hero-copy emphasis">
          Envie um comprovante Pix no valor mínimo de {minimumAmountLabel} para solicitar o acesso.
        </p>
        <p className="hero-copy">
          Faça o upload da imagem do comprovante para liberar o envio para análise.
        </p>
        <div className="alert-list" aria-label="Avisos obrigatórios">
          <ul>
            <li><p>Conteúdo destinado exclusivamente a maiores de 18 anos.</p></li>
            <li><p>Aposte com responsabilidade.</p></li>
            <li><p>Não existe garantia de lucro ou retorno financeiro.</p></li>
            <li><p>A validação analisa apenas as informações visíveis no comprovante.</p></li>
          </ul>
        </div>
      </section>

      <section
        ref={uploadSectionRef}
        tabIndex={-1}
        className="upload-card"
        aria-labelledby="upload-title"
      >
        <div className="section-header">
          <p className="section-step">02. Envie seu comprovante</p>
          <h2 id="upload-title">Selecione o comprovante Pix</h2>
          <p>Envie uma imagem JPG, PNG ou WebP de até {maxUploadSizeMb} MB.</p>
          <p>Abra a galeria ou selecione um screenshot do comprovante salvo no celular.</p>
        </div>

        <div className="upload-trigger-group">
          <button type="button" className="primary-button upload-trigger-button" onClick={handleUploadButtonClick}>
            Selecione comprovante Pix
          </button>
          <span className="upload-trigger-status">{selectedFile ? selectedFile.name : 'Nenhum arquivo selecionado'}</span>
        </div>
        <input
          ref={fileInputRef}
          className="visually-hidden-file-input"
          id="receipt-upload"
          aria-label="Arquivo do comprovante Pix"
          name="receipt"
          type="file"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          onChange={(event) => handleSelect(event.target.files?.[0] ?? null)}
        />

        {uploadError ? <p className="error-banner">{uploadError}</p> : null}

        {selectedFile && previewUrl ? (
          <div className="preview-card">
            <div className="section-header section-header--compact">
              <p className="section-step">03. Análise gerada por IA</p>
              <p>
                Após o upload, a análise acontece automaticamente para detectar texto, identificar banco, valor
                monetário e confiança da leitura.
              </p>
            </div>
            <Image
              className="preview-image"
              src={previewUrl}
              alt="Pré-visualização do comprovante selecionado"
              width={1200}
              height={900}
              unoptimized
            />
            <div className="preview-details">
              <strong>{selectedFile.name}</strong>
              <span>{formatFileSize(selectedFile.size)}</span>
            </div>
            {isAnalyzing ? (
              <div className="analysis-loading-card" role="status" aria-live="polite">
                <span className="analysis-loading-spinner" aria-hidden="true" />
                <div>
                  <strong>Processando comprovante...</strong>
                  <p>Aguarde enquanto a IA/OCR analisa a imagem enviada.</p>
                </div>
              </div>
            ) : null}
            <div className="preview-actions">
              <button type="button" className="secondary-button remove" onClick={clearSelection}>
                Remover imagem
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={handleUploadButtonClick}
              >
                Enviar nova imagem
              </button>
            </div>
          </div>
        ) : null}

        {result ? (
          <section className="result-card" aria-live="polite">
            <p className="section-step">04. Resultado</p>
            <h3>{result.status === 'approved' ? 'Comprovante aprovado' : result.status === 'rejected' ? 'Comprovante não aprovado' : 'Erro na análise'}</h3>
            <p>{result.message}</p>
            <dl className="result-grid">
              <div>
                <dt>Banco identificado</dt>
                <dd>{result.bank ?? 'Não identificado'}</dd>
              </div>
              <div>
                <dt>Valor identificado</dt>
                <dd>{formatCurrencyFromCents(result.amountCents)}</dd>
              </div>
              <div>
                <dt>Confiança da leitura</dt>
                <dd>{formatConfidencePercent(result.confidence)}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd className={result.status === 'approved' ? 'aproved' : 'rejected'}>{result.status === 'approved' ? 'Aprovado' : result.status === 'rejected' ? 'Rejeitado' : 'Erro'}</dd>
              </div>
            </dl>
            <p className="privacy-note">
              A análise verifica apenas as informações visíveis na imagem. Ela não confirma diretamente o recebimento do pagamento pela instituição financeira.
            </p>
            {result.status === 'approved' && result.whatsappUrl ? (
              <div className="whatsapp-cta-block">
                <p className="section-step">05. WhatsApp</p>
                <a className="primary-button link-button" href={result.whatsappUrl} target="_blank" rel="noreferrer">
                  Continuar pelo WhatsApp
                </a>
              </div>
            ) : null}
          </section>
        ) : null}
      </section>
    </main>
    </>
  );
}
