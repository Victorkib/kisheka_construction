/**
 * Test Africa's Talking Credentials
 * 
 * This script tests your Africa's Talking API credentials to verify they're correct.
 * 
 * Usage:
 *   node scripts/test-africas-talking-credentials.mjs
 * 
 * Make sure your .env.local file has:
 *   AFRICASTALKING_API_KEY=your-key
 *   AFRICASTALKING_USERNAME=your-username
 *   AFRICASTALKING_SENDER_ID=44042
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

config({ path: join(projectRoot, '.env.local') });

const AFRICASTALKING_API_KEY = process.env.AFRICASTALKING_API_KEY;
const AFRICASTALKING_USERNAME = process.env.AFRICASTALKING_USERNAME;
const AFRICASTALKING_SENDER_ID = process.env.AFRICASTALKING_SENDER_ID || '44042';
const SMS_ENABLED = process.env.SMS_ENABLED === 'true';

console.log('🔍 Africa\'s Talking Credentials Diagnostic\n');
console.log('=' .repeat(50));

// Check if credentials are loaded
console.log('\n1. Environment Variables Check:');
console.log('   SMS_ENABLED:', SMS_ENABLED ? '✅ true' : '❌ false (should be true)');
console.log('   API Key:', AFRICASTALKING_API_KEY ? `✅ Set (${AFRICASTALKING_API_KEY.length} chars)` : '❌ Missing');
console.log('   Username:', AFRICASTALKING_USERNAME ? `✅ Set (${AFRICASTALKING_USERNAME})` : '❌ Missing');
console.log('   Sender ID:', AFRICASTALKING_SENDER_ID ? `✅ Set (${AFRICASTALKING_SENDER_ID})` : '❌ Missing');

if (!AFRICASTALKING_API_KEY || !AFRICASTALKING_USERNAME) {
  console.log('\n❌ ERROR: Missing required credentials!');
  console.log('   Please check your .env.local file.');
  process.exit(1);
}

// Check for common issues
console.log('\n2. Credential Format Check:');
const issues = [];

if (AFRICASTALKING_API_KEY.includes('"') || AFRICASTALKING_API_KEY.includes("'")) {
  issues.push('API Key contains quotes - remove them from .env.local');
}
if (AFRICASTALKING_USERNAME.includes('"') || AFRICASTALKING_USERNAME.includes("'")) {
  issues.push('Username contains quotes - remove them from .env.local');
}
if (AFRICASTALKING_API_KEY.trim() !== AFRICASTALKING_API_KEY) {
  issues.push('API Key has leading/trailing spaces - remove them');
}
if (AFRICASTALKING_USERNAME.trim() !== AFRICASTALKING_USERNAME) {
  issues.push('Username has leading/trailing spaces - remove them');
}
if (AFRICASTALKING_SENDER_ID !== '44042' && AFRICASTALKING_SENDER_ID !== 'KISHEKA') {
  console.log('   ⚠️  Sender ID is not 44042 (sandbox) or KISHEKA (production)');
}

if (issues.length > 0) {
  console.log('   ❌ Issues found:');
  issues.forEach(issue => console.log(`      - ${issue}`));
} else {
  console.log('   ✅ No format issues detected');
}

// Test API call
console.log('\n3. Testing API Authentication:');
console.log('   Sending test request to Africa\'s Talking API...\n');

try {
  // Use a registered sandbox number for testing
  const testPhone = '+254797441545'; // Default sandbox test number
  
  // const africasTalkingUrl = 'https://api.africastalking.com/version1/messaging';
  const africasTalkingUrl = 'https://api.sandbox.africastalking.com/version1/messaging';
  const response = await fetch(africasTalkingUrl, {
    method: 'POST',
    headers: {
      'ApiKey': AFRICASTALKING_API_KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: new URLSearchParams({
      username: AFRICASTALKING_USERNAME,
      to: testPhone,
      message: 'Test message from Doshaki Construction system',
      from: AFRICASTALKING_SENDER_ID
    })
  });

  const responseText = await response.text();
  
  console.log('   Response Status:', response.status, response.statusText);
  
  if (!response.ok) {
    console.log('   ❌ Authentication FAILED');
    console.log('\n   Error Response:');
    try {
      const errorJson = JSON.parse(responseText);
      console.log(JSON.stringify(errorJson, null, 2));
    } catch (e) {
      console.log(responseText);
    }
    
    console.log('\n   🔧 Troubleshooting Steps:');
    console.log('   1. Verify API key in dashboard: https://account.africastalking.com');
    console.log('   2. Verify username in dashboard');
    console.log('   3. Ensure both are from the SAME account');
    console.log('   4. Ensure both are from SANDBOX (not production)');
    console.log('   5. Check .env.local has no quotes around values');
    console.log('   6. Restart your dev server after updating .env.local');
    
    process.exit(1);
  }

  const data = JSON.parse(responseText);
  
  if (data.SMSMessageData?.Recipients?.[0]?.statusCode === 101) {
    console.log('   ✅ Authentication SUCCESSFUL!');
    console.log('   ✅ SMS would be sent successfully');
    console.log('\n   Response:');
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log('   ⚠️  Authentication worked but SMS send had issues');
    console.log('\n   Response:');
    console.log(JSON.stringify(data, null, 2));
  }
  
} catch (error) {
  console.log('   ❌ Request FAILED');
  console.log('   Error:', error.message);
  console.log('\n   This might indicate:');
  console.log('   - Network connectivity issues');
  console.log('   - Invalid API endpoint');
  console.log('   - Other connection problems');
  process.exit(1);
}

console.log('\n' + '='.repeat(50));
console.log('✅ Diagnostic complete!\n');

