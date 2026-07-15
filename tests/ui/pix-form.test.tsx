import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PixLandingPage } from '@/components/pix-landing-page';

async function unlockAgeGate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Sim, tenho 18 anos ou mais' }));
}

function installTrackingSpies() {
  const fbq = vi.fn();
  const gtag = vi.fn();

  Object.assign(window, { fbq, gtag });

  return { fbq, gtag };
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('PixLandingPage', () => {
  it('blocks the application with an age confirmation overlay on first access', () => {
    render(<PixLandingPage minPixAmountCents={9700} maxUploadSizeMb={8} />);

    expect(screen.getByText('Você tem 18 anos ou mais?')).toBeVisible();
    expect(screen.getByText(/Este conteúdo é destinado exclusivamente a maiores de 18 anos/i)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sim, tenho 18 anos ou mais' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Não tenho 18 anos' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Enviar comprovante Pix' })).not.toBeInTheDocument();
  });

  it('stores positive age confirmation and unlocks the application', async () => {
    const user = userEvent.setup();
    render(<PixLandingPage minPixAmountCents={9700} maxUploadSizeMb={8} />);

    await user.click(screen.getByRole('button', { name: 'Sim, tenho 18 anos ou mais' }));

    expect(window.localStorage.getItem('age_verified')).toBe('true');
    expect(document.cookie).toContain('age_verified=true');
    expect(screen.queryByText('Você tem 18 anos ou mais?')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Selecione o comprovante Pix' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Enviar comprovante Pix' })).not.toBeInTheDocument();
  });

  it('keeps the application blocked after a negative age confirmation without persisting it', async () => {
    const user = userEvent.setup();
    render(<PixLandingPage minPixAmountCents={9700} maxUploadSizeMb={8} />);

    await user.click(screen.getByRole('button', { name: 'Não tenho 18 anos' }));

    expect(window.localStorage.getItem('age_verified')).toBeNull();
    expect(document.cookie).not.toContain('age_verified=true');
    expect(screen.getByText('Acesso não permitido')).toBeVisible();
    expect(screen.getByText('Volte quando completar 18 anos.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Sim, tenho 18 anos ou mais' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Não tenho 18 anos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar comprovante Pix' })).not.toBeInTheDocument();
  });

  it('skips the age popup when the server already knows the age confirmation', () => {
    window.localStorage.setItem('age_verified', 'true');

    render(<PixLandingPage minPixAmountCents={9700} maxUploadSizeMb={8} initialAgeVerified />);

    expect(screen.queryByText('Você tem 18 anos ou mais?')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Selecione o comprovante Pix' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Enviar comprovante Pix' })).not.toBeInTheDocument();
  });

  it('renders the upload trigger as a button labeled Selecione comprovante Pix', async () => {
    const user = userEvent.setup();
    render(<PixLandingPage minPixAmountCents={9700} maxUploadSizeMb={8} />);
    await unlockAgeGate(user);

    expect(screen.getByRole('button', { name: 'Selecione comprovante Pix' })).toBeVisible();
  });

  it('tracks page view once on page load', () => {
    const { fbq, gtag } = installTrackingSpies();

    render(<PixLandingPage minPixAmountCents={9700} maxUploadSizeMb={8} initialAgeVerified />);

    expect(fbq).toHaveBeenCalledWith('track', 'PageView');
    expect(gtag).toHaveBeenCalledWith('event', 'page_view', expect.objectContaining({
      page_title: 'LP Pix'
    }));
  });

  it('tracks begin checkout when the upload flow starts from the button', async () => {
    const user = userEvent.setup();
    const { fbq, gtag } = installTrackingSpies();

    render(<PixLandingPage minPixAmountCents={9700} maxUploadSizeMb={8} />);
    await unlockAgeGate(user);
    await user.click(screen.getByRole('button', { name: 'Selecione comprovante Pix' }));

    expect(fbq).toHaveBeenCalledWith('track', 'InitiateCheckout', expect.objectContaining({
      content_name: 'Grupo VIP de Dicas em Bet',
      currency: 'BRL'
    }));
    expect(gtag).toHaveBeenCalledWith('event', 'begin_checkout', expect.objectContaining({
      currency: 'BRL',
      item_name: 'Grupo VIP de Dicas em Bet'
    }));
  });

  it('shows preview actions after a valid file is selected', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'approved',
        message: 'Comprovante aprovado.',
        bank: null,
        amountCents: 9700,
        confidence: 0.91,
        whatsappUrl: 'https://wa.me/5500000000000?text=ok'
      })
    } as Response);

    render(<PixLandingPage minPixAmountCents={9700} maxUploadSizeMb={8} />);
    await unlockAgeGate(user);

    const fileInput = screen.getByLabelText(/Arquivo do comprovante Pix/i);
    const file = new File([new Uint8Array([1, 2, 3])], 'comprovante.png', { type: 'image/png' });

    await user.upload(fileInput, file);

    expect((await screen.findAllByText('comprovante.png')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Remover imagem' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Enviar nova imagem' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Enviar comprovante Pix' })).not.toBeInTheDocument();
    expect(await screen.findByText('Comprovante aprovado')).toBeVisible();
    expect(fetchSpy).toHaveBeenCalledOnce();

    fetchSpy.mockRestore();
  });

  it('shows a loading state while the image analysis request is still processing', async () => {
    const user = userEvent.setup();
    let resolveResponse: ((value: Response) => void) | null = null;
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveResponse = resolve;
        })
    );

    render(<PixLandingPage minPixAmountCents={9700} maxUploadSizeMb={8} />);
    await unlockAgeGate(user);

    const fileInput = screen.getByLabelText(/Arquivo do comprovante Pix/i);
    const file = new File([new Uint8Array([1, 2, 3])], 'carregando.png', { type: 'image/png' });

    await user.upload(fileInput, file);

    expect(await screen.findByText('Processando comprovante...')).toBeVisible();
    expect(screen.getByText('Aguarde enquanto a IA/OCR analisa a imagem enviada.')).toBeVisible();

    resolveResponse?.({
      ok: true,
      json: async () => ({
        status: 'approved',
        message: 'Comprovante aprovado.',
        bank: 'Nubank',
        amountCents: 9700,
        currency: 'BRL',
        confidence: 0.91,
        whatsappUrl: 'https://wa.me/5500000000000?text=ok',
        transactionId: 'loading-test-id'
      })
    } as Response);

    expect(await screen.findByText('Comprovante aprovado')).toBeVisible();

    fetchSpy.mockRestore();
  });

  it('reveals the WhatsApp button only after an approved backend response', async () => {
    const user = userEvent.setup();
    const { fbq, gtag } = installTrackingSpies();
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'approved',
        message: 'Comprovante aprovado.',
        bank: null,
        amountCents: 9700,
        currency: 'BRL',
        confidence: 0.91,
        whatsappUrl: 'https://wa.me/5500000000000?text=ok',
        transactionId: 'pix_validation_unique_id'
      })
    } as Response);

    render(<PixLandingPage minPixAmountCents={9700} maxUploadSizeMb={8} />);
    await unlockAgeGate(user);

    const fileInput = screen.getByLabelText(/Arquivo do comprovante Pix/i);
    const file = new File([new Uint8Array([1, 2, 3])], 'comprovante.png', { type: 'image/png' });

    await user.upload(fileInput, file);

    const whatsappButton = await screen.findByRole('link', { name: 'Continuar pelo WhatsApp' });

    expect(whatsappButton).toHaveAttribute('href', 'https://wa.me/5500000000000?text=ok');
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Enviar nova imagem' })).toBeVisible();
    expect(fbq).toHaveBeenCalledWith('track', 'Purchase', {
      value: 97,
      currency: 'BRL',
      content_name: 'Grupo VIP de Dicas em Bet',
      payment_method: 'pix'
    });
    expect(gtag).toHaveBeenCalledWith('event', 'purchase', {
      transaction_id: 'pix_validation_unique_id',
      value: 97,
      currency: 'BRL',
      items: [{
        item_id: 'grupo-vip-bet',
        item_name: 'Grupo VIP de Dicas em Bet'
      }]
    });

    fetchSpy.mockRestore();
  });

  it('keeps WhatsApp hidden after a rejected response', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'rejected',
        message: 'Valor inferior ao mínimo necessário.',
        bank: 'Nubank',
        amountCents: 5000,
        confidence: 0.91,
        whatsappUrl: null
      })
    } as Response);

    render(<PixLandingPage minPixAmountCents={9700} maxUploadSizeMb={8} />);
    await unlockAgeGate(user);

    const fileInput = screen.getByLabelText(/Arquivo do comprovante Pix/i);
    const file = new File([new Uint8Array([1, 2, 3])], 'comprovante.png', { type: 'image/png' });

    await user.upload(fileInput, file);

    expect(await screen.findByText(/Valor inferior ao mínimo necessário/i)).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Continuar pelo WhatsApp' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar nova imagem' })).toBeVisible();

    fetchSpy.mockRestore();
  });

  it('re-analyzes automatically after choosing a new replacement image', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'rejected',
          message: 'Valor inferior ao mínimo necessário.',
          bank: 'Nubank',
          amountCents: 5000,
          confidence: 0.91,
          whatsappUrl: null
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'approved',
          message: 'Comprovante aprovado.',
          bank: null,
          amountCents: 9700,
          confidence: 0.91,
          whatsappUrl: 'https://wa.me/5500000000000?text=ok'
        })
      } as Response);

    render(<PixLandingPage minPixAmountCents={9700} maxUploadSizeMb={8} />);
    await unlockAgeGate(user);

    const fileInput = screen.getByLabelText(/Arquivo do comprovante Pix/i);
    const firstFile = new File([new Uint8Array([1, 2, 3])], 'primeiro.png', { type: 'image/png' });
    const secondFile = new File([new Uint8Array([4, 5, 6])], 'segundo.png', { type: 'image/png' });

    await user.upload(fileInput, firstFile);
    expect(await screen.findByText(/Valor inferior ao mínimo necessário/i)).toBeVisible();

    await user.upload(fileInput, secondFile);

    expect(await screen.findByText('Comprovante aprovado')).toBeVisible();
    expect((await screen.findAllByText('segundo.png')).length).toBeGreaterThan(0);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    fetchSpy.mockRestore();
  });
});
