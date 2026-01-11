/**
 * Script to apply enhanced logging to sendSMS function
 * 
 * Usage: node scripts/apply-sms-logging-enhancement.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const smsServicePath = join(projectRoot, 'src/lib/sms-service.js');

console.log('Reading sms-service.js...');
const content = readFileSync(smsServicePath, 'utf8');

// Enhanced sendSMS function with comprehensive logging
const enhancedFunction = `export async function sendSMS({ to, message }) {
  console.log('\\n[SMS Service] ========================================');
  console.log('[SMS Service] Starting SMS send process');
  console.log('[SMS Service] ========================================');
  
  if (!SMS_ENABLED) {
    console.log('[SMS Service] ⚠️  SMS is disabled. Skipping SMS send.');
    return {
      success: false,
      error: 'SMS is disabled',
      skipped: true
    };
  }

  if (!AFRICASTALKING_API_KEY || !AFRICASTALKING_USERNAME) {
    console.error('[SMS Service] ❌ Africa\\'s Talking credentials not configured');
    throw new Error('Africa\\'s Talking credentials not configured');
  }

  if (!to || !message) {
    console.error('[SMS Service] ❌ Missing required parameters:', { to: !!to, message: !!message });
    throw new Error('Recipient phone number and message are required');
  }

  try {
    // Format phone number (ensure it starts with +)
    const formattedPhone = to.startsWith('+') ? to : \`+\${to}\`;

    // const africasTalkingUrl = 'https://api.africastalking.com/version1/messaging';
    const africasTalkingUrl = 'https://api.sandbox.africastalking.com/version1/messaging';
    
    console.log('[SMS Service] Request Details:');
    console.log('[SMS Service]   - URL:', africasTalkingUrl);
    console.log('[SMS Service]   - To:', formattedPhone);
    console.log('[SMS Service]   - From (Sender ID):', AFRICASTALKING_SENDER_ID);
    console.log('[SMS Service]   - Username:', AFRICASTALKING_USERNAME);
    console.log('[SMS Service]   - Message Length:', message.length, 'characters');
    console.log('[SMS Service]   - Message Preview:', message.substring(0, 100) + (message.length > 100 ? '...' : ''));
    
    const requestBody = new URLSearchParams({
      username: AFRICASTALKING_USERNAME,
      to: formattedPhone,
      message: message,
      from: AFRICASTALKING_SENDER_ID
    });
    
    console.log('[SMS Service] Sending request to Africa\\'s Talking API...');
    const response = await fetch(africasTalkingUrl, {
      method: 'POST',
      headers: {
        'ApiKey': AFRICASTALKING_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: requestBody
    });

    // LOG HTTP STATUS ALWAYS (even when successful)
    console.log('[SMS Service] HTTP Response Received:');
    console.log('[SMS Service]   - Status Code:', response.status);
    console.log('[SMS Service]   - Status Text:', response.statusText);
    console.log('[SMS Service]   - Response OK:', response.ok);
    console.log('[SMS Service]   - Headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      console.error('[SMS Service] ❌ HTTP Error Response (not OK)');
      const errorText = await response.text();
      console.error('[SMS Service] Error Response Body:', errorText);
      console.error('[SMS Service] API Key (first 10 chars):', AFRICASTALKING_API_KEY?.substring(0, 10) + '...');
      console.error('[SMS Service] Username:', AFRICASTALKING_USERNAME);
      console.error('[SMS Service] Sender ID:', AFRICASTALKING_SENDER_ID);
      
      // Try to parse error response as JSON
      let errorDetails = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorDetails = JSON.stringify(errorJson, null, 2);
        console.error('[SMS Service] Parsed Error JSON:', errorDetails);
      } catch (e) {
        console.error('[SMS Service] Error response is not JSON, using raw text');
      }
      
      throw new Error(\`SMS send failed: \${response.status} \${response.statusText}. Details: \${errorDetails}\`);
    }

    // LOG FULL RESPONSE BEFORE PARSING
    console.log('[SMS Service] ✅ HTTP Response OK, reading response body...');
    const responseText = await response.text();
    console.log('[SMS Service] Raw Response Text Length:', responseText.length, 'characters');
    console.log('[SMS Service] Raw Response Text:', responseText);
    
    let data;
    try {
      data = JSON.parse(responseText);
      console.log('[SMS Service] ✅ JSON Parsed Successfully');
      console.log('[SMS Service] Parsed Response Structure:', JSON.stringify(data, null, 2));
    } catch (parseError) {
      console.error('[SMS Service] ❌ JSON Parse Error:', parseError.message);
      console.error('[SMS Service] Parse Error Stack:', parseError.stack);
      console.error('[SMS Service] Response Text that failed to parse:', responseText);
      throw new Error(\`Failed to parse API response as JSON: \${parseError.message}. Response: \${responseText.substring(0, 500)}\`);
    }
    
    // LOG RESPONSE STRUCTURE VALIDATION
    console.log('[SMS Service] Validating Response Structure:');
    console.log('[SMS Service]   - Has SMSMessageData:', !!data.SMSMessageData);
    console.log('[SMS Service]   - Has Recipients:', !!data.SMSMessageData?.Recipients);
    console.log('[SMS Service]   - Recipients Length:', data.SMSMessageData?.Recipients?.length || 0);
    console.log('[SMS Service]   - First Recipient:', data.SMSMessageData?.Recipients?.[0] || 'N/A');
    
    // Check if response structure is valid
    if (!data.SMSMessageData || !data.SMSMessageData.Recipients || data.SMSMessageData.Recipients.length === 0) {
      console.error('[SMS Service] ❌ Invalid Response Structure');
      console.error('[SMS Service] Expected: { SMSMessageData: { Recipients: [...] } }');
      console.error('[SMS Service] Received:', JSON.stringify(data, null, 2));
      throw new Error('Invalid API response structure: Missing SMSMessageData or Recipients array');
    }

    const recipient = data.SMSMessageData.Recipients[0];
    const statusCode = recipient.statusCode;
    const status = recipient.status;
    const messageId = recipient.messageId;
    const number = recipient.number;
    const cost = recipient.cost;
    
    console.log('[SMS Service] Recipient Details:');
    console.log('[SMS Service]   - Status Code:', statusCode);
    console.log('[SMS Service]   - Status:', status);
    console.log('[SMS Service]   - Message ID:', messageId);
    console.log('[SMS Service]   - Number:', number);
    console.log('[SMS Service]   - Cost:', cost);
    console.log('[SMS Service]   - Full Recipient Object:', JSON.stringify(recipient, null, 2));
    
    // Check for success (101 = Sent, 102 = Queued, status = "Success")
    // Also check for "Success" status string as some APIs return that
    const isSuccess = statusCode === 101 || statusCode === 102 || status === 'Success' || status === 'Sent';
    
    if (isSuccess) {
      console.log('[SMS Service] ✅ SMS SENT SUCCESSFULLY');
      console.log('[SMS Service]   - Message ID:', messageId);
      console.log('[SMS Service]   - Status:', status);
      console.log('[SMS Service]   - Status Code:', statusCode);
      console.log('[SMS Service] ========================================\\n');
      
      return {
        success: true,
        messageId: messageId,
        provider: 'africas_talking',
        status: status,
        statusCode: statusCode
      };
    } else {
      console.error('[SMS Service] ❌ SMS SEND FAILED');
      console.error('[SMS Service]   - Status Code:', statusCode);
      console.error('[SMS Service]   - Status:', status);
      console.error('[SMS Service]   - Full Recipient:', JSON.stringify(recipient, null, 2));
      console.error('[SMS Service]   - Full Response:', JSON.stringify(data, null, 2));
      console.log('[SMS Service] ========================================\\n');
      
      const errorMessage = status || \`SMS send failed (Status Code: \${statusCode})\`;
      throw new Error(errorMessage);
    }
  } catch (error) {
    console.error('[SMS Service] ❌ EXCEPTION CAUGHT');
    console.error('[SMS Service]   - Error Name:', error.name);
    console.error('[SMS Service]   - Error Message:', error.message);
    console.error('[SMS Service]   - Error Stack:', error.stack);
    console.log('[SMS Service] ========================================\\n');
    throw error;
  }
}`;

// Find and replace the sendSMS function
const functionStartPattern = /export async function sendSMS\(\{ to, message \}\) \{/;
const functionEndPattern = /^}\s*$/m;

// Find the start of the function
const startMatch = content.match(functionStartPattern);
if (!startMatch) {
  console.error('❌ Could not find sendSMS function start');
  process.exit(1);
}

// Find the end of the function (look for the closing brace after the catch block)
// We need to find the function that ends with the catch block
let functionStart = startMatch.index;
let braceCount = 0;
let functionEnd = -1;
let inFunction = false;

for (let i = functionStart; i < content.length; i++) {
  if (content[i] === '{') {
    if (!inFunction) inFunction = true;
    braceCount++;
  } else if (content[i] === '}') {
    braceCount--;
    if (braceCount === 0 && inFunction) {
      functionEnd = i + 1;
      break;
    }
  }
}

if (functionEnd === -1) {
  console.error('❌ Could not find sendSMS function end');
  process.exit(1);
}

// Extract the function
const beforeFunction = content.substring(0, functionStart);
const afterFunction = content.substring(functionEnd);

// Create new content with enhanced function
const newContent = beforeFunction + enhancedFunction + '\n' + afterFunction;

// Write backup
const backupPath = smsServicePath + '.backup.' + Date.now();
writeFileSync(backupPath, content, 'utf8');
console.log('✅ Backup created:', backupPath);

// Write new content
writeFileSync(smsServicePath, newContent, 'utf8');
console.log('✅ Enhanced logging applied to sendSMS function');
console.log('✅ File updated:', smsServicePath);
console.log('\n📝 Next steps:');
console.log('   1. Restart your development server');
console.log('   2. Create a purchase order that triggers SMS');
console.log('   3. Watch terminal for [SMS Service] logs');
console.log('   4. Share the full terminal output for analysis');
