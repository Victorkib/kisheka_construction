/**
 * Real-time Webhook Monitor
 * 
 * Monitors the webhook endpoint and logs all requests/responses
 * Useful for debugging while testing with Africa's Talking simulator
 */

import http from 'http';
import url from 'url';

const PORT = 3001; // Different port to avoid conflicts

const server = http.createServer((req, res) => {
  const timestamp = new Date().toISOString();
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📨 ${timestamp}`);
  console.log(`${'='.repeat(70)}`);
  
  console.log(`Method: ${req.method}`);
  console.log(`Path: ${req.url}`);
  console.log(`Headers:`, JSON.stringify(req.headers, null, 2));
  
  let body = '';
  
  req.on('data', (chunk) => {
    body += chunk.toString();
  });
  
  req.on('end', () => {
    console.log(`\nBody:`);
    console.log(body);
    
    // Try to parse as form-encoded
    try {
      const params = new URLSearchParams(body);
      console.log(`\nParsed Fields:`);
      for (const [key, value] of params.entries()) {
        console.log(`  ${key}: ${value}`);
      }
    } catch (e) {
      console.log('Could not parse as form-encoded');
    }
    
    // Try to parse as JSON
    try {
      const json = JSON.parse(body);
      console.log(`\nParsed JSON:`, JSON.stringify(json, null, 2));
    } catch (e) {
      console.log('Not JSON format');
    }
    
    // Send response
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'received',
      timestamp: timestamp,
      message: 'Webhook received successfully'
    }));
    
    console.log(`\n✅ Response sent: 200 OK`);
    console.log(`${'='.repeat(70)}`);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Webhook Monitor listening on port ${PORT}`);
  console.log(`\n📝 To test locally:`);
  console.log(`   curl -X POST http://localhost:${PORT}/webhook \\`);
  console.log(`     -d "from=%2B254797441545&to=44042&text=ACCEPT%20PO-001"`);
  console.log(`\n📌 Africa's Talking settings:`);
  console.log(`   For local testing, set webhook to:`);
  console.log(`   http://localhost:${PORT}/webhook`);
  console.log(`\n   For production (via ngrok):`);
  console.log(`   https://your-ngrok-id.ngrok.io/webhook`);
  console.log(`\n⏸️  Press Ctrl+C to stop`);
});
