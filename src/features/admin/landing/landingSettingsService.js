import { supabase } from '../../../lib/supabase';
import { getSetting, setSetting } from '../../../lib/api';

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
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `gallery/${fileName}`;

  // Menggunakan bucket 'public_assets' yang diasumsikan tersedia
  // Anda dapat mengubahnya menjadi bucket yang sesuai jika sudah dibuat
  const bucketName = 'landing_assets'; 
  
  const { error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(filePath, file);

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage
    .from(bucketName)
    .getPublicUrl(filePath);

  return data.publicUrl;
};
