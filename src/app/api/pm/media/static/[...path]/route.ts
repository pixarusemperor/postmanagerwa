import { NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

let _s3: S3Client | null = null;
function getS3(): S3Client {
  if (!_s3) {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const key = process.env.R2_ACCESS_KEY_ID;
    const secret = process.env.R2_SECRET_ACCESS_KEY;
    if (!accountId || !key || !secret) throw new Error('R2 creds missing');
    _s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: key, secretAccessKey: secret },
    });
  }
  return _s3;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const key = path.map(p => decodeURIComponent(p)).join('/');
    if (!key) return NextResponse.json({ error: 'Missing path' }, { status: 400 });

    const client = getS3();
    const result = await client.send(new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME || 'postmanagerwa-media',
      Key: key,
    }));

    if (!result.Body) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const bytes = await result.Body.transformToByteArray();
    const contentType = result.ContentType || 'image/jpeg';
    const cacheControl = result.CacheControl || 'public, max-age=86400, immutable';

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': cacheControl,
        'ETag': result.ETag || '',
      },
    });
  } catch (err: any) {
    if (err.name === 'NoSuchKey') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ error: 'Failed to fetch media' }, { status: 500 });
  }
}
