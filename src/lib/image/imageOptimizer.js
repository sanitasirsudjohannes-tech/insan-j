/**
 * Client-side image optimization for landing-page gallery uploads.
 *
 * The original file is never modified. The browser creates a resized,
 * compressed WebP Blob before it is sent to Supabase Storage.
 */

const DEFAULT_OPTIONS = {
  maxDimension: 1600,
  quality: 0.8,
  mimeType: 'image/webp',
};

const loadImage = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Gambar tidak dapat diproses oleh browser.'));
    };

    image.src = url;
  });

const canvasToBlob = (canvas, type, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Browser gagal membuat gambar WebP.'));
      },
      type,
      quality,
    );
  });

/**
 * Resize the image while preserving its aspect ratio and encode it as WebP.
 * Falls back to the original file when WebP encoding is unavailable.
 */
export const optimizeImageForUpload = async (file, options = {}) => {
  if (!(file instanceof File)) {
    throw new Error('File gambar tidak valid.');
  }

  if (!file.type.startsWith('image/')) {
    throw new Error('File yang dipilih bukan gambar.');
  }

  const { maxDimension, quality, mimeType } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const image = await loadImage(file);
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);

  const scale = longestSide > maxDimension ? maxDimension / longestSide : 1;
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Browser tidak mendukung pemrosesan gambar.');
  }

  context.drawImage(image, 0, 0, width, height);

  let blob;
  try {
    blob = await canvasToBlob(canvas, mimeType, quality);
  } catch {
    return file;
  }

  // Some browsers may ignore an unsupported MIME type and return PNG.
  if (blob.type !== mimeType) {
    return file;
  }

  const baseName = file.name.replace(/\.[^.]+$/, '') || 'gallery-image';
  return new File([blob], `${baseName}.webp`, {
    type: mimeType,
    lastModified: Date.now(),
  });
};
