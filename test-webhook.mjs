/**
 * Test SMS Webhook
 *
 * This script tests the SMS webhook endpoint with sample Africa's Talking payloads
 * to verify incoming SMS processing works correctly.
 *
 * Usage:
 *   node test-webhook.mjs
 */

const BASE_URL = 'http://localhost:3000';

// Sample Africa's Talking webhook payloads
const sampleIncomingSMS = {
  from: '+254797441545', // Test phone number
  to: '44042', // Short code
  text: 'ACCEPT PO-001',
  date: new Date().toISOString(),
  id: 'ATXid_test123',
};

const sampleDeliveryStatus = {
  phoneNumber: '+254797441545',
  status: 'Success',
  failureReason: null,
  id: 'ATXid_test123',
  retryCount: 0,
  networkCode: '63902',
};

async function testWebhook() {
  console.log('🧪 Testing SMS Webhook Endpoint\n');
  console.log('='.repeat(50));

  try {
    // Test 1: Incoming SMS
    console.log('\n1. Testing Incoming SMS Webhook:');
    console.log('   Payload:', JSON.stringify(sampleIncomingSMS, null, 2));

    const response1 = await fetch(`${BASE_URL}/api/sms/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': "Africa's Talking/1.0",
      },
      body: new URLSearchParams(sampleIncomingSMS).toString(),
    });

    console.log('   Response Status:', response1.status);
    const result1 = await response1.text();
    console.log('   Response Body:', result1);

    // Test 2: Delivery Status Report
    console.log('\n2. Testing Delivery Status Webhook:');
    console.log('   Payload:', JSON.stringify(sampleDeliveryStatus, null, 2));

    const response2 = await fetch(`${BASE_URL}/api/sms/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': "Africa's Talking/1.0",
      },
      body: new URLSearchParams(sampleDeliveryStatus).toString(),
    });

    console.log('   Response Status:', response2.status);
    const result2 = await response2.text();
    console.log('   Response Body:', result2);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ Webhook test complete!');
}

testWebhook();
