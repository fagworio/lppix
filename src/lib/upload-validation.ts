import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';

const ACCEPTED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);
const ACCEPTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_DIMENSION = 1800;

export interface ValidatedUploadFile {
  ok: true;
  buffer: Buffer;
  detectedMime: 'image/jpeg' | 'image/png' | 'image/webp';
}

export interface InvalidUploadFile {
  ok: false;
  message: string;
}

export type UploadValidationResult = ValidatedUploadFile | InvalidUploadFile;

export async function validateUploadFile(file: File, maxUploadSizeMb: number): Promise<UploadValidationResult> {
  if (!file) {
    return {
      ok: false,
      message: 'Selecione uma imagem antes de continuar.'
    };
  }

  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !ACCEPTED_EXTENSIONS.has(extension)) {
    return {
      ok: false,
      message: 'Formato de arquivo não permitido. Envie uma imagem JPG, PNG ou WebP.'
    };
  }

  if (!ACCEPTED_MIME_TYPES.has(file.type)) {
    return {
      ok: false,
      message: 'O tipo de arquivo informado não é compatível com JPG, PNG ou WebP.'
    };
  }

  const maxBytes = maxUploadSizeMb * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      ok: false,
      message: `O arquivo excede o limite de até ${maxUploadSizeMb} MB.`
    };
  }

  const arrayBuffer = typeof file.arrayBuffer === 'function'
    ? await file.arrayBuffer()
    : await new Response(file).arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const buffer = Buffer.from(bytes);
  const detected = await fileTypeFromBuffer(bytes);

  if (!detected || !ACCEPTED_MIME_TYPES.has(detected.mime)) {
    return {
      ok: false,
      message: 'Não foi possível validar a assinatura binária da imagem enviada.'
    };
  }

  try {
    await sharp(buffer).metadata();
  } catch {
    return {
      ok: false,
      message: 'A imagem enviada não pôde ser processada.'
    };
  }

  return {
    ok: true,
    buffer,
    detectedMime: detected.mime as ValidatedUploadFile['detectedMime']
  };
}

export async function preprocessUploadImage(buffer: Buffer): Promise<{ buffer: Buffer; mimeType: 'image/jpeg' }> {
  const processedBuffer = await sharp(buffer)
    .rotate()
    .resize({
      width: MAX_IMAGE_DIMENSION,
      height: MAX_IMAGE_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();

  return {
    buffer: processedBuffer,
    mimeType: 'image/jpeg'
  };
}

export function isAcceptedImageType(type: string): boolean {
  return ACCEPTED_MIME_TYPES.has(type);
}
