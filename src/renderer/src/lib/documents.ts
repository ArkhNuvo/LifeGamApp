export function toDataUrl(mime: string, dataBase64: string): string {
  return `data:${mime};base64,${dataBase64}`
}

/** Splits a data URL back into its mime type and base64 payload. */
export function fromDataUrl(dataUrl: string): { mime: string; dataBase64: string } {
  const match = /^data:([^;]+);base64,([\s\S]*)$/.exec(dataUrl)
  return { mime: match?.[1] ?? 'application/octet-stream', dataBase64: match?.[2] ?? '' }
}

// The API rejects images above ~5 MB; phone photos of receipts routinely exceed that.
const MAX_AI_IMAGE_BASE64_LENGTH = 4_500_000
const MAX_AI_IMAGE_SIDE = 2000

/**
 * Shrinks a large photo (to JPEG, longest side 2000 px) before it is sent for
 * recognition. The stored attachment keeps the original; PDFs and small
 * images are returned untouched.
 */
export async function prepareForAi(
  mime: string,
  dataBase64: string
): Promise<{ mime: string; dataBase64: string }> {
  if (!mime.startsWith('image/') || dataBase64.length <= MAX_AI_IMAGE_BASE64_LENGTH) {
    return { mime, dataBase64 }
  }
  const img = new Image()
  img.src = toDataUrl(mime, dataBase64)
  await img.decode()
  const scale = Math.min(1, MAX_AI_IMAGE_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.naturalWidth * scale)
  canvas.height = Math.round(img.naturalHeight * scale)
  canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
  return fromDataUrl(canvas.toDataURL('image/jpeg', 0.85))
}
