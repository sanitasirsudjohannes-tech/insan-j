import { supabase } from '../../../lib/supabase';
import { getSetting, setSetting } from '../../../lib/api';
import { optimizeImageForUpload } from '../../../lib/image/imageOptimizer';

const DEFAULT_GALLERY = [
  { id: '1', type: 'youtube', url: 'md9iaur645M' },
  { id: '2', type: 'youtube', url: 'DWBzpEFwcQw' },
  { id: '3', type: 'youtube', url: 'u8jKbiJrPX8' },
];

export const getGalleryItems = async () => {
  return await getSetting('landing_gallery', DEFAULT_GALLERY);
};

export const saveGalleryItems = async (items) => {
  await setSetting('landing_gallery', items);
};

export const uploadGalleryImage = async (file) => {
  const optimizedFile = await optimizeImageForUpload(file, {
    maxDimension: 1600,
    quality: 0.8,
  });

  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.webp`;
  const filePath = `gallery/${fileName}`;
  const bucketName = 'landing_assets';

  const { error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(filePath, optimizedFile, {
      contentType: 'image/webp',
      cacheControl: '31536000',
      upsert: false,
    });

  if (uploadError) {
    if (uploadError.message.includes('Bucket not found') || uploadError.message.includes('NoSuchBucket')) {
      throw new Error(`Bucket '${bucketName}' belum dibuat di Supabase Storage. Harap buat bucket tersebut terlebih dahulu (dan set ke Public).`);
    }
    throw uploadError;
  }

  const { data } = supabase.storage
    .from(bucketName)
    .getPublicUrl(filePath);

  return data.publicUrl;
};

export const deleteGalleryImage = async (url) => {
  if (!url || typeof url !== 'string' || !url.includes('/landing_assets/')) return;
  try {
    const filePath = url.split('/landing_assets/')[1];
    if (filePath) {
      await supabase.storage.from('landing_assets').remove([filePath]);
    }
  } catch (error) {
    console.error('Gagal menghapus file dari storage:', error);
  }
};
