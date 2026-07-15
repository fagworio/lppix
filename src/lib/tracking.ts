const OFFER_NAME = 'Grupo VIP de Dicas em Bet';
const OFFER_ID = 'grupo-vip-bet';
const DEFAULT_CURRENCY = 'BRL';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

function toCurrencyValue(amountCents: number | null | undefined): number {
  return Number(((amountCents ?? 0) / 100).toFixed(2));
}

export function trackPageView() {
  if (typeof window === 'undefined') {
    return;
  }

  window.fbq?.('track', 'PageView');
  window.gtag?.('event', 'page_view', {
    page_title: document.title || 'LP Pix',
    page_location: window.location.href,
    page_path: window.location.pathname
  });
}

export function trackBeginCheckout(amountCents: number) {
  const value = toCurrencyValue(amountCents);

  window.fbq?.('track', 'InitiateCheckout', {
    value,
    currency: DEFAULT_CURRENCY,
    content_name: OFFER_NAME,
    payment_method: 'pix'
  });

  window.gtag?.('event', 'begin_checkout', {
    currency: DEFAULT_CURRENCY,
    value,
    item_id: OFFER_ID,
    item_name: OFFER_NAME
  });
}

export function trackPixPurchase({
  amountCents,
  currency,
  transactionId
}: {
  amountCents: number | null;
  currency: 'BRL' | null;
  transactionId: string;
}) {
  const resolvedCurrency = currency ?? DEFAULT_CURRENCY;
  const value = toCurrencyValue(amountCents);

  window.fbq?.('track', 'Purchase', {
    value,
    currency: resolvedCurrency,
    content_name: OFFER_NAME,
    payment_method: 'pix'
  });

  window.gtag?.('event', 'purchase', {
    transaction_id: transactionId,
    value,
    currency: resolvedCurrency,
    items: [{
      item_id: OFFER_ID,
      item_name: OFFER_NAME
    }]
  });
}

export function getTrackingOfferName() {
  return OFFER_NAME;
}