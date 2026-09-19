import { supabase } from './supabase';

/**
 * Uploads an image to Supabase Storage.
 * @param bucket The bucket name (e.g., 'driver-docs')
 * @param path The path within the bucket (e.g., 'userId/license.jpg')
 * @param uri The local file URI from expo-image-picker
 * @returns The public URL of the uploaded image
 */
export const uploadImage = async (bucket: string, path: string, uri: string): Promise<string> => {
  try {
    const formData = new FormData();
    formData.append('file', {
      uri,
      name: path.split('/').pop(),
      type: 'image/jpeg',
    } as any);

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, formData, {
        upsert: true,
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    return publicUrl;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
};
