'use strict';

require('dotenv').config();

const mongoose = require('mongoose');
const { testR2Connection } = require('../lib/storage/r2');

const REQUIRED_ENV = [
  'MONGODB_URI',
  'JWT_SECRET',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_ENDPOINT'
];

async function checkEnvironment() {
  const missing = REQUIRED_ENV.filter(name =>
    typeof process.env[name] !== 'string' || !process.env[name].trim()
  );

  if (missing.length) {
    throw new Error('Missing required environment variables: ' + missing.join(', '));
  }

  console.log('Environment configuration: PASS (7 required variables present)');
}

async function checkMongoAndTransactions() {
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 15000,
    maxPoolSize: 2,
    minPoolSize: 0,
    bufferCommands: false
  });

  await mongoose.connection.db.admin().command({ ping: 1 });
  console.log('MongoDB Atlas connection: PASS');

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Read-only transaction probe: confirms transaction support without
      // creating, changing, or deleting application data.
      await mongoose.connection.db
        .collection('vaultusage')
        .findOne({}, { session });
    });
  } finally {
    await session.endSession();
  }

  console.log('MongoDB transaction support: PASS (read-only probe)');
}

async function checkR2() {
  const result = await testR2Connection();
  console.log('Cloudflare R2 connection: PASS');
  console.log('R2 bucket:', result.bucket);
  console.log('R2 HTTP status:', result.httpStatusCode);
}

async function main() {
  let failed = false;
  let stage = 'environment configuration';

  try {
    await checkEnvironment();
    stage = 'MongoDB connectivity and transaction support';
    await checkMongoAndTransactions();
    stage = 'Cloudflare R2 connectivity';
    await checkR2();
  } catch (error) {
    failed = true;
    console.error('OS4.4 PREFLIGHT FAILED');
    console.error('Failed stage:', stage);
    console.error('Error type:', error.name || 'Unknown');
    console.error('Details omitted to protect connection information.');
    if (error.$metadata?.httpStatusCode) {
      console.error('HTTP status:', error.$metadata.httpStatusCode);
    }
    if (error.$metadata?.requestId) {
      console.error('Request ID:', error.$metadata.requestId);
    }
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => {});
    }
  }

  if (!failed) {
    console.log('OS4.4 PREFLIGHT: ALL CHECKS PASSED');
  } else {
    process.exitCode = 1;
  }
}

main();
