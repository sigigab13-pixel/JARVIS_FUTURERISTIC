export const api = {
  get: async (path: string) => {
    const response = await fetch(path, { headers: { Accept: 'application/json' } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data?.error || `Request failed with status ${response.status}`), { response: { data } });
    return { data };
  },
  post: async (path: string, body: unknown) => {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data?.error || `Request failed with status ${response.status}`), { response: { data } });
    return { data };
  },
};

export const image = {
  resizeIfNeeded: async (
    file: File,
    options: { maxDimension: number; maxPixels: number; quality: number; mimeType: string },
  ): Promise<{ data: string; mimeType: string }> => {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
      1,
      options.maxDimension / Math.max(bitmap.width, bitmap.height),
      Math.sqrt(options.maxPixels / (bitmap.width * bitmap.height)),
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not prepare image.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, options.mimeType, options.quality));
    if (!blob) throw new Error('Could not encode image.');
    const data = await blobToBase64(blob);
    return { data, mimeType: options.mimeType };
  },
};

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + chunk, bytes.length)));
  }
  return btoa(binary);
}
