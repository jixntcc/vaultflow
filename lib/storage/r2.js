
'use strict';

const {
  S3Client,
  HeadBucketCommand,
  PutObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

function getR2Config() {
  const required = [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME',
    'R2_ENDPOINT'
  ];

  const missing = required.filter(
    key => !process.env[key] || !process.env[key].trim()
  );

  if (missing.length) {
    throw new Error(
      `Missing R2 configuration: ${missing.join(', ')}`
    );
  }

  const endpoint = new URL(process.env.R2_ENDPOINT);

  if (
    endpoint.protocol !== 'https:' ||
    endpoint.hostname !== `${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  ) {
    throw new Error('Invalid R2 endpoint configuration');
  }

  return {
    region: 'auto',
    endpoint: endpoint.toString(),
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
  };
}

let client;

function getR2Client() {
  if (!client) {
    client = new S3Client({
      ...getR2Config(),
      requestChecksumCalculation: 'WHEN_REQUIRED'
    });
  }

  return client;
}

async function createPresignedPutUrl({ key, contentType, contentLength, expiresIn = 300 }) {
  if (typeof key !== 'string' || !key || key.startsWith('/') || key.includes('..')) {
    throw new Error('Invalid R2 object key');
  }
  if (typeof contentType !== 'string' || !contentType) {
    throw new Error('A content type is required');
  }
  if (!Number.isSafeInteger(contentLength) || contentLength <= 0) {
    throw new Error('A positive content length is required');
  }
  if (!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > 900) {
    throw new Error('Presigned URL expiry must be between 1 and 900 seconds');
  }

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength
  });

  return getSignedUrl(getR2Client(), command, {
    expiresIn,
    signableHeaders: new Set(['content-type', 'content-length'])
  });
}

function getBucketName() {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket || !bucket.trim()) throw new Error('Missing R2_BUCKET_NAME');
  return bucket;
}

async function headR2Object(key) {
  if (typeof key !== 'string' || !key || key.startsWith('/') || key.includes('..')) {
    throw new Error('Invalid R2 object key');
  }
  return getR2Client().send(new HeadObjectCommand({
    Bucket: getBucketName(),
    Key: key
  }));
}

async function promoteR2Object({ sourceKey, destinationKey, sourceEtag, contentType }) {
  for (const key of [sourceKey, destinationKey]) {
    if (typeof key !== 'string' || !key || key.startsWith('/') || key.includes('..')) {
      throw new Error('Invalid R2 object key');
    }
  }
  if (typeof sourceEtag !== 'string' || !sourceEtag.trim()) {
    throw new Error('A source ETag is required for safe promotion');
  }

  const encodedSource = sourceKey.split('/').map(encodeURIComponent).join('/');
  return getR2Client().send(new CopyObjectCommand({
    Bucket: getBucketName(),
    Key: destinationKey,
    CopySource: `${getBucketName()}/${encodedSource}`,
    CopySourceIfMatch: sourceEtag,
    MetadataDirective: 'REPLACE',
    ContentType: contentType
  }));
}

async function deleteR2Object(key) {
  if (typeof key !== 'string' || !key || key.startsWith('/') || key.includes('..')) {
    throw new Error('Invalid R2 object key');
  }
  return getR2Client().send(new DeleteObjectCommand({
    Bucket: getBucketName(),
    Key: key
  }));
}

async function testR2Connection() {
  const bucket = getBucketName();

  const result = await getR2Client().send(
    new HeadBucketCommand({ Bucket: bucket })
  );

  return {
    connected: true,
    bucket,
    httpStatusCode: result.$metadata?.httpStatusCode || null
  };
}

module.exports = {
  getR2Client,
  createPresignedPutUrl,
  headR2Object,
  promoteR2Object,
  deleteR2Object,
  testR2Connection
};
