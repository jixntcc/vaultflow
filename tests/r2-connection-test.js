
'use strict';

require('dotenv').config();

const { testR2Connection } = require('../lib/storage/r2');

async function main() {
  try {
    console.log('Checking Cloudflare R2 connection...');

    const result = await testR2Connection();

    console.log('R2 CONNECTION SUCCESS');
    console.log('Bucket:', result.bucket);
    console.log('HTTP status:', result.httpStatusCode);
  } catch (error) {
    console.error('R2 CONNECTION FAILED');
    console.error('Error name:', error.name || 'Unknown');
    console.error('HTTP status:', error.$metadata?.httpStatusCode || 'Unavailable');
    console.error('Request ID:', error.$metadata?.requestId || 'Unavailable');
    process.exitCode = 1;
  }
}

main();
