'use client';

const API_BASE = '';

export interface UploadedMedia {
  storagePath: string;
  publicUrl: string;
  filename: string;
  contentType: string;
  fileSize: number;
}

export async function uploadProductImage(
  file: File,
  orgId: string,
  productId: string,
  accessToken: string
): Promise<UploadedMedia> {
  // Step 1: Get presigned URL from our API
  const presignedRes = await fetch(`${API_BASE}/api/pm/media/upload-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      entityType: 'products',
      entityId: productId,
    }),
  });

  if (!presignedRes.ok) {
    const err = await presignedRes.json().catch(() => ({ error: 'Upload setup failed' }));
    throw new Error(err.error || 'Upload setup failed');
  }

  const { presignedUrl, storagePath } = await presignedRes.json();

  // Step 2: Upload directly to R2
  const uploadRes = await fetch(presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });

  if (!uploadRes.ok) {
    throw new Error(`Upload failed: ${uploadRes.status}`);
  }

  // Step 3: Insert media record via API route (avoids direct REST with anon key complexity)
  const mediaRes = await fetch(`/api/pm/media/attach`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      storagePath,
      orgId,
      productId,
      fileType: file.type,
      fileSize: file.size,
    }),
  });

  if (!mediaRes.ok) {
    const errBody = await mediaRes.text();
    console.error('Media attach failed:', errBody);
    throw new Error('Failed to attach media to product');
  }

  return {
    storagePath,
    publicUrl: getMediaPublicUrl(storagePath),
    filename: file.name,
    contentType: file.type,
    fileSize: file.size,
  };
}

export function getMediaPublicUrl(storagePath: string): string {
  return `/api/pm/media/static/${storagePath}`;
}
