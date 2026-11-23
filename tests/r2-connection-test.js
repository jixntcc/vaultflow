
'use strict';

require('dotenv').config();

const { testR2Connection, createPresignedPutUrl } = require('../lib/storage/r2');

async function main() {
  try {
    console.log('Checking Cloudflare R2 connection...');

    const result = await testR2Connection();

    console.log('R2 CONNECTION SUCCESS');
    console.log('Bucket:', result.bucket);
    console.log('HTTP status:', result.httpStatusCode);

    const uploadUrl = await createPresignedPutUrl({
      key: 'vault/presign-check-' + require('crypto').randomUUID(),
      contentType: 'application/pdf',
      contentLength: 1024,
      expiresIn: 300
    });
    const signedHeaders = new URL(uploadUrl).searchParams.get('X-Amz-SignedHeaders') || '';
    if (!signedHeaders.split(';').includes('content-length') ||
        !signedHeaders.split(';').includes('content-type')) {
      throw new Error('Presigned URL does not bind content-length and content-type');
    }
    console.log('R2 PRESIGNED PUT SUCCESS');
    console.log('Signed headers: content-length, content-type');
    console.log('URL expiry: 300 seconds');
  } catch (error) {
    console.error('R2 CONNECTION FAILED');
    console.error('Error name:', error.name || 'Unknown');
    console.error('HTTP status:', error.$metadata?.httpStatusCode || 'Unavailable');
    console.error('Request ID:', error.$metadata?.requestId || 'Unavailable');
    process.exitCode = 1;
  }
}

main();
