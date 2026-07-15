// @vitest-environment node

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { preprocessUploadImage, validateUploadFile } from '@/lib/upload-validation';

async function createPngBuffer() {
  return sharp({
    create: {
      width: 24,
      height: 24,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  })
    .png()
    .toBuffer();
}

describe('validateUploadFile', () => {
  it('accepts png files within the configured size', async () => {
    const buffer = await createPngBuffer();
    const file = new File([buffer], 'comprovante.png', { type: 'image/png' });

    const result = await validateUploadFile(file, 8);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected valid file');
    }
    expect(result.detectedMime).toBe('image/png');
  });

  it('rejects unsupported extensions', async () => {
    const buffer = await createPngBuffer();
    const file = new File([buffer], 'comprovante.gif', { type: 'image/gif' });

    const result = await validateUploadFile(file, 8);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected invalid file');
    }
    expect(result.message).toContain('Formato de arquivo não permitido');
  });

  it('rejects files larger than the configured size', async () => {
    const file = new File([new Uint8Array(9 * 1024 * 1024)], 'comprovante.png', { type: 'image/png' });

    const result = await validateUploadFile(file, 8);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected invalid file');
    }
    expect(result.message).toContain('até 8 MB');
  });
});

describe('preprocessUploadImage', () => {
  it('returns a processable, metadata-stripped image buffer', async () => {
    const source = await sharp({
      create: {
        width: 2400,
        height: 1600,
        channels: 3,
        background: { r: 240, g: 240, b: 240 }
      }
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();

    const processed = await preprocessUploadImage(source);
    const metadata = await sharp(processed.buffer).metadata();

    expect(processed.mimeType).toBe('image/jpeg');
    expect(metadata.width).toBeLessThanOrEqual(1800);
    expect(metadata.height).toBeLessThanOrEqual(1800);
    expect(metadata.orientation).toBeUndefined();
  });
});
