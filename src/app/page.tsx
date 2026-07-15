import { cookies } from 'next/headers';

import { PixLandingPage } from '@/components/pix-landing-page';
import { getClientConfig } from '@/lib/env';

export default async function HomePage() {
  const { maxUploadSizeMb, minPixAmountCents } = getClientConfig();
  const cookieStore = await cookies();
  const initialAgeVerified = cookieStore.get('age_verified')?.value === 'true';

  return (
    <PixLandingPage
      minPixAmountCents={minPixAmountCents}
      maxUploadSizeMb={maxUploadSizeMb}
      initialAgeVerified={initialAgeVerified}
    />
  );
}
