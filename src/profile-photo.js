export const MAX_PHOTO_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_PHOTO_DATA_LENGTH = 120000;
export function validatePhotoFile(file) {
 if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG, or WebP photo.');
 if (!file.size || file.size > MAX_PHOTO_FILE_BYTES) throw new Error('Choose a photo smaller than 10 MB.');
}
export async function prepareProfilePhoto(file) {
 validatePhotoFile(file);
 const bitmap = await createImageBitmap(file);
 try {
  const scale = Math.min(1,256 / Math.max(bitmap.width,bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1,Math.round(bitmap.width*scale));
  canvas.height = Math.max(1,Math.round(bitmap.height*scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Your browser could not prepare this photo.');
  context.fillStyle='#ffffff'; context.fillRect(0,0,canvas.width,canvas.height);
  context.drawImage(bitmap,0,0,canvas.width,canvas.height);
  const photo = canvas.toDataURL('image/jpeg',0.8);
  if (photo.length>MAX_PHOTO_DATA_LENGTH) throw new Error('This photo is too detailed. Choose a smaller image.');
  return photo;
 } finally { bitmap.close(); }
}
