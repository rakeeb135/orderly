import { supabase } from '../supabase';

/**
 * Resizes and compresses an image file to WebP format before uploading.
 */
async function compressImage(file, maxWidth = 1200, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const elem = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        elem.width = width;
        elem.height = height;
        const ctx = elem.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        ctx.canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Canvas compression returned null'));
              return;
            }
            resolve(blob);
          },
          'image/webp',
          quality
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

/**
 * Uploads a file to the 'store-assets' bucket in Supabase Storage.
 * Returns the permanent public URL.
 */
export async function uploadStoreAsset(file, folder = 'branding') {
  if (!file) throw new Error('No file provided for upload.');

  // 1. Client-side compression
  const compressedBlob = await compressImage(file, folder === 'banners' ? 1400 : 800, 0.82);

  // 2. Generate unique filename
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 7);
  const filePath = `${folder}/${timestamp}-${randomStr}.webp`;

  // 3. Upload to Supabase 'store-assets'
  const { data, error } = await supabase.storage
    .from('store-assets')
    .upload(filePath, compressedBlob, {
      contentType: 'image/webp',
      upsert: true,
    });

  if (error) throw error;

  // 4. Retrieve public URL
  const { data: publicUrlData } = supabase.storage
    .from('store-assets')
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
}