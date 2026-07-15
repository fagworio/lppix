import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { AnalyticsScripts } from '@/components/analytics-scripts';
import { getClientConfig } from '@/lib/env';

export const metadata: Metadata = {
  title: 'LP Pix',
  description: 'Validação de comprovante Pix para liberação do Grupo VIP.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const { ga4MeasurementId, metaPixelId } = getClientConfig();

  return (
    <html lang="pt-BR">
      <body>
        <AnalyticsScripts ga4MeasurementId={ga4MeasurementId} metaPixelId={metaPixelId} />
        {children}
      </body>
    </html>
  );
}
