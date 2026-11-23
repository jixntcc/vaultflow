
'use strict';

const {
  S3Client,
  HeadBucketCommand
} = require('@aws-sdk/client-s3');

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
    client = new S3Client(getR2Config());
  }

  return client;
}

async function testR2Connection() {
  const bucket = process.env.R2_BUCKET_NAME;

  if (!bucket || !bucket.trim()) {
    throw new Error('Missing R2_BUCKET_NAME');
  }

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
  testR2Connection
};
