/**
 * Comprehensive Webhook Flow Diagnostic
 * 
 * Tests:
 * 1. Local server accessibility
 * 2. Webhook endpoint responsiveness
 * 3. Data parsing and processing
 * 4. Database connectivity
 * 5. Africa's Talking payload format compatibility
 */

import fetch from 'node-fetch';
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB_NAME || 'kisheka_prod';
const LOCAL_URL = 'http://localhost:3000';
const NGROK_URL = process.env.NGROK_URL; // Set this when you know your ngrok URL

console.log('🔍 WEBHOOK FLOW DIAGNOSTIC');
console.log('='.repeat(60));
console.log('\n📋 Environment Check:');
console.log('   Local URL:', LOCAL_URL);
console.log('   Ngrok URL:', NGROK_URL || '❌ NOT SET (required for Africa\'s Talking)');
console.log('   MongoDB URI:', MONGODB_URI.substring(0, 50) + '...');
console.log('   Database:', DB_NAME);

// Test 1: Database Connectivity
async function testDatabase() {
  console.log('\n📦 Test 1: Database Connectivity');
  console.log('-'.repeat(60));
  
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db(DB_NAME);
    const collections = await db.listCollections().toArray();
    console.log('   ✅ Connected to MongoDB');
    console.log('   📊 Collections:', collections.map(c => c.name).join(', '));
    
    // Check for suppliers
    const suppliersCollection = db.collection('suppliers');
    const supplierCount = await suppliersCollection.countDocuments();
    console.log('   👥 Suppliers in DB:', supplierCount);
    
    if (supplierCount > 0) {
      const sampleSupplier = await suppliersCollection.findOne();
      console.log('   Sample Supplier Phone:', sampleSupplier?.phone);
      console.log('   Sample Supplier Name:', sampleSupplier?.name);
    }
    
    await client.close();
    return true;
  } catch (error) {
    console.error('   ❌ Database Error:', error.message);
    return false;
  }
}

// Test 2: Local Server Connectivity
async function testLocalServer() {
  console.log('\n🌐 Test 2: Local Server Connectivity');
  console.log('-'.repeat(60));
  
  try {
    const response = await fetch(`${LOCAL_URL}/api/sms/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        from: '+254797441545',
        to: '44042',
        text: 'ACCEPT PO-001',
        date: new Date().toISOString(),
        id: 'TEST_' + Date.now(),
      }).toString(),
    });
    
    console.log('   ✅ Server is accessible on localhost:3000');
    console.log('   Response Status:', response.status);
    const responseText = await response.text();
    console.log('   Response Body:', responseText.substring(0, 200));
    return true;
  } catch (error) {
    console.error('   ❌ Cannot reach localhost:3000');
    console.error('   Error:', error.message);
    console.error('   Make sure: npm run dev is running in another terminal');
    return false;
  }
}

// Test 3: Webhook Payload Format Compatibility
async function testPayloadFormats() {
  console.log('\n📨 Test 3: Webhook Payload Format Compatibility');
  console.log('-'.repeat(60));
  
  const testCases = [
    {
      name: 'Incoming SMS (Standard)',
      payload: {
        from: '+254797441545',
        to: '44042',
        text: 'ACCEPT PO-001',
        date: new Date().toISOString(),
        id: 'ATX123',
      }
    },
    {
      name: 'Delivery Status Report',
      payload: {
        phoneNumber: '+254797441545',
        status: 'Success',
        id: 'ATX456',
        failureReason: null,
      }
    },
    {
      name: 'Invalid Payload (Missing Fields)',
      payload: {
        someField: 'value'
      }
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n   Testing: ${testCase.name}`);
    try {
      const response = await fetch(`${LOCAL_URL}/api/sms/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': "Africa's Talking/1.0",
        },
        body: new URLSearchParams(testCase.payload).toString(),
      });
      
      console.log(`   Status: ${response.status}`);
      const body = await response.text();
      console.log(`   Response: ${body.substring(0, 150)}`);
    } catch (error) {
      console.log(`   Error: ${error.message}`);
    }
  }
}

// Test 4: Network Accessibility Check
async function testNetworkAccessibility() {
  console.log('\n🌍 Test 4: Network & Ngrok Accessibility');
  console.log('-'.repeat(60));
  
  if (!NGROK_URL) {
    console.log('   ❌ NGROK_URL not set. Run:');
    console.log('   export NGROK_URL=https://your-ngrok-id.ngrok.io');
    console.log('\n   To find your ngrok URL:');
    console.log('   1. Open http://localhost:4040 in browser (ngrok web UI)');
    console.log('   2. Look for the "Forwarding" URL');
    console.log('   3. It should look like: https://abc123.ngrok.io → http://localhost:3000');
    return;
  }
  
  console.log('   Testing ngrok URL:', NGROK_URL);
  
  try {
    const response = await fetch(`${NGROK_URL}/api/sms/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        from: '+254797441545',
        to: '44042',
        text: 'ACCEPT PO-001',
      }).toString(),
    });
    
    console.log('   ✅ Ngrok tunnel is working!');
    console.log('   Response Status:', response.status);
    
    console.log('\n   📌 Next Steps:');
    console.log(`   1. Go to Africa's Talking Dashboard`);
    console.log(`   2. Go to Settings > Webhook URL`);
    console.log(`   3. Set to: ${NGROK_URL}/api/sms/webhook`);
    console.log(`   4. Make sure "Callback on received SMS" is ENABLED`);
    console.log(`   5. Test with simulator - send SMS response`);
  } catch (error) {
    console.error('   ❌ Cannot reach ngrok URL');
    console.error('   Error:', error.message);
    console.log('\n   Troubleshoot:');
    console.log('   - Make sure ngrok terminal is still running');
    console.log('   - Check that localhost:3000 is still running (npm run dev)');
    console.log('   - Verify the ngrok URL is correct');
  }
}

// Test 5: Africa's Talking Integration Check
async function testAfricasTalkingIntegration() {
  console.log('\n🌍 Test 5: Africa\'s Talking API Integration');
  console.log('-'.repeat(60));
  
  const apiKey = process.env.AFRICASTALKING_API_KEY;
  const username = process.env.AFRICASTALKING_USERNAME;
  const senderId = process.env.AFRICASTALKING_SENDER_ID || 'KISHEKA';
  
  console.log('   API Key configured:', !!apiKey);
  console.log('   Username configured:', !!username);
  console.log('   Sender ID:', senderId);
  
  if (!apiKey || !username) {
    console.log('\n   ❌ Missing Africa\'s Talking credentials');
    console.log('   Set in .env.local:');
    console.log('   AFRICASTALKING_API_KEY=...');
    console.log('   AFRICASTALKING_USERNAME=...');
    return;
  }
  
  try {
    const response = await fetch('https://api.sandbox.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: {
        'ApiKey': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        username: username,
        to: '+254797441545',
        message: 'Test message',
        from: senderId
      })
    });
    
    console.log('   ✅ Can communicate with Africa\'s Talking API');
    console.log('   Response Status:', response.status);
  } catch (error) {
    console.error('   ❌ Cannot reach Africa\'s Talking API');
    console.error('   Error:', error.message);
  }
}

// Main diagnostic flow
async function runDiagnostics() {
  const dbOk = await testDatabase();
  const serverOk = await testLocalServer();
  
  if (serverOk) {
    await testPayloadFormats();
  }
  
  await testNetworkAccessibility();
  await testAfricasTalkingIntegration();
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 DIAGNOSTIC SUMMARY');
  console.log('='.repeat(60));
  
  if (!dbOk) {
    console.log('❌ Database connectivity issues');
  }
  
  if (!serverOk) {
    console.log('❌ Local server not running. Run: npm run dev');
  } else {
    console.log('✅ Local server is accessible');
  }
  
  if (!NGROK_URL) {
    console.log('⚠️  Ngrok URL not set. Africa\'s Talking cannot reach your webhook!');
    console.log('   See Test 4 for instructions');
  }
  
  console.log('\n🔑 KEY ISSUE LIKELY:');
  console.log('Your webhook URL in Africa\'s Talking is probably set to:');
  console.log('  ❌ http://localhost:3000/api/sms/webhook');
  console.log('');
  console.log('It MUST be set to your ngrok URL:');
  console.log('  ✅ https://xxxx.ngrok.io/api/sms/webhook');
  console.log('');
  console.log('And you need to ENABLE "Callback on received SMS" in AT settings.');
}

runDiagnostics().catch(console.error);
