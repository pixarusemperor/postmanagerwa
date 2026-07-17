import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

let _r2Client: S3Client | null = null;

export function getR2Client(): S3Client {
  if (!_r2Client) {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error('Missing Cloudflare R2 credentials. Set CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.');
    }

    _r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return _r2Client;
}

export function getBucketName(): string {
  return process.env.R2_BUCKET_NAME || 'postmanagerwa-media';
}

export function getPublicUrl(): string {
  const url = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL;
  if (!url) throw new Error('R2 public URL not configured. Set NEXT_PUBLIC_R2_PUBLIC_URL.');
  return url;
}

export async function getUploadPresignedUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 900
): Promise<string> {
  const client = getR2Client();
  const bucket = getBucketName();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

export function buildStoragePath(
  organizationId: string,
  entityType: string,
  entityId: string,
  filename: string
): string {
  return `uploads/org_${organizationId}/${entityType}/${entityId}/${filename}`;
}

export function buildPublicUrl(storagePath: string): string {
  const base = getPublicUrl();
  if (!base) throw new Error('R2_PUBLIC_URL not configured');
  return `${base.replace(/\/$/, '')}/${storagePath}`;
}

export async function deleteR2Object(key: string): Promise<void> {
  const client = getR2Client();
  const bucket = getBucketName();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
