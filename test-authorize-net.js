// Test script untuk Authorize.Net dengan Apple Pay token
// Usage: node test-authorize-net.js [token-file.json]
//   atau: node test-authorize-net.js (akan menggunakan token default dari log)

import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const API_LOGIN_ID = process.env.AUTHORIZE_NET_API_LOGIN_ID;
const TRANSACTION_KEY = process.env.AUTHORIZE_NET_TRANSACTION_KEY;
const BASE_URL = process.env.AUTHORIZE_NET_MODE === 'production'
  ? 'https://api.authorize.net/xml/v1/request.api'
  : 'https://apitest.authorize.net/xml/v1/request.api';

// Default Apple Pay token dari log (contoh - bisa diganti dengan token baru)
const DEFAULT_APPLE_PAY_TOKEN = {
  "paymentData": {
    "data": "0kuHHGWuBkD/qTq6AB1U3o0OHHQCqu09w60r4h1KPcUYSXVqjEdrqPcq210pgACzYaZx8NeZnjGUCQy5xfzkBNQDTUhghqhsYxnuPzXF23GPpvzWmHMzKBvGKMMG3LoUrjMik4P77f0XxPUNbR6FDbsffOTyWWIJZ4pshHTA4wLOGLWGhx9/JjS1vX+jk/QQou1Gdvc5+RM83GOai7Lnm8e3rR1FszJ8j/G2uFEwKfBXgJ3re0N8yeGKgPZF5p3W7mgZUx8q7GXHbKRvl8k8hYq6rDUMSe5rQRXz2PGOkpPS1hikHN83ZFl0CwvbWR9KRzayUuWDZCQznMRzvF0rGdBDKo1h0ZzwaOxxeL5RvydouQ3gBPmo3IHwrqxiYJNQ3tLuIt0SyBwS1pGL9w==",
    "signature": "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",
    "header": {
      "publicKeyHash": "9A7c3pOUKg/BLBCICj5jS+iMNiKb22TCNfXM7SP0qqs=",
      "ephemeralPublicKey": "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEcVO6QBSGMg5oss7Q49dLV6veM+6wILeHt4JIvNAeRxQHDXF/ZEYKeAw9jpjAPJ/+GKVkmSHrsMdI5XDoOJ/l7w==",
      "transactionId": "11a5a8a55d555455b9c46b17c3fd1eec80f09e7d14253115971bdf4e6f914d18"
    },
    "version": "EC_v1"
  },
  "paymentMethod": {
    "displayName": "MasterCard 3715",
    "network": "MasterCard",
    "type": "credit"
  },
  "transactionIdentifier": "11a5a8a55d555455b9c46b17c3fd1eec80f09e7d14253115971bdf4e6f914d18"
};

// Transaction parameters
const AMOUNT = parseFloat(process.env.PAYMENT_AMOUNT || '10.00');
// Authorize.Net limits invoiceNumber to 20 characters max
const ORDER_ID = `TEST-${Date.now()}`.slice(0, 20);
const INVOICE_NUMBER = `INV-${Date.now()}`.slice(0, 20);

// Load token from file or use default
function loadToken() {
  const args = process.argv.slice(2);
  
  if (args.length > 0) {
    const tokenFile = resolve(__dirname, args[0]);
    if (fs.existsSync(tokenFile)) {
      console.log(`📄 Loading token from: ${tokenFile}`);
      const tokenData = fs.readFileSync(tokenFile, 'utf8');
      return JSON.parse(tokenData);
    } else {
      console.warn(`⚠️  Token file not found: ${tokenFile}`);
      console.warn('   Using default token from log...');
    }
  }
  
  return DEFAULT_APPLE_PAY_TOKEN;
}

// Escape XML special characters
function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Create XML request
function createXmlRequest(applePayToken, amount, orderId, invoiceNumber) {
  // For Authorize.Net Apple Pay:
  // dataValue should be base64(JSON.stringify(token.paymentData))
  // (includes data + header + signature + version needed for decryption)
  const paymentData = applePayToken.paymentData;

  if (!paymentData) {
    throw new Error('Apple Pay token missing paymentData');
  }

  const paymentDataValue = Buffer.from(JSON.stringify(paymentData), 'utf8').toString('base64');

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<createTransactionRequest xmlns="AnetApi/xml/v1/schema/AnetApiSchema.xsd">
  <merchantAuthentication>
    <name>${escapeXml(API_LOGIN_ID)}</name>
    <transactionKey>${escapeXml(TRANSACTION_KEY)}</transactionKey>
  </merchantAuthentication>
  <refId>${escapeXml(orderId)}</refId>
  <transactionRequest>
    <transactionType>authCaptureTransaction</transactionType>
    <amount>${escapeXml(amount.toFixed(2))}</amount>
    <payment>
      <opaqueData>
        <dataDescriptor>COMMON.APPLE.INAPP.PAYMENT</dataDescriptor>
        <dataValue>${escapeXml(paymentDataValue)}</dataValue>
      </opaqueData>
    </payment>
    <order>
      <invoiceNumber>${escapeXml(invoiceNumber)}</invoiceNumber>
      <description>Apple Pay Test Payment</description>
    </order>
  </transactionRequest>
</createTransactionRequest>`;

  return xml;
}

// Parse XML response
function parseXmlResponse(xmlString) {
  const result = {
    transactionResponse: {},
    messages: {},
  };

  // Extract transaction response
  const transMatch = xmlString.match(/<transactionResponse[^>]*>([\s\S]*?)<\/transactionResponse>/);
  if (transMatch) {
    const transXml = transMatch[1];
    
    const responseCodeMatch = transXml.match(/<responseCode>(.*?)<\/responseCode>/);
    if (responseCodeMatch) {
      result.transactionResponse.responseCode = responseCodeMatch[1];
    }

    const authCodeMatch = transXml.match(/<authCode>(.*?)<\/authCode>/);
    if (authCodeMatch) {
      result.transactionResponse.authCode = authCodeMatch[1];
    }

    const transIdMatch = transXml.match(/<transId>(.*?)<\/transId>/);
    if (transIdMatch) {
      result.transactionResponse.transId = transIdMatch[1];
    }

    const errors = [];
    const errorMatches = transXml.matchAll(/<error>([\s\S]*?)<\/error>/g);
    for (const errorMatch of errorMatches) {
      const errorXml = errorMatch[1];
      const errorCodeMatch = errorXml.match(/<errorCode>(.*?)<\/errorCode>/);
      const errorTextMatch = errorXml.match(/<errorText>(.*?)<\/errorText>/);
      errors.push({
        errorCode: errorCodeMatch ? errorCodeMatch[1] : '',
        errorText: errorTextMatch ? errorTextMatch[1] : '',
      });
    }
    if (errors.length > 0) {
      result.transactionResponse.errors = errors;
    }
  }

  // Extract messages
  const messagesMatch = xmlString.match(/<messages[^>]*>([\s\S]*?)<\/messages>/);
  if (messagesMatch) {
    const messagesXml = messagesMatch[1];
    const resultCodeMatch = messagesXml.match(/<resultCode>(.*?)<\/resultCode>/);
    if (resultCodeMatch) {
      result.messages.resultCode = resultCodeMatch[1];
    }
    
    const messageErrors = [];
    const messageErrorMatches = messagesXml.matchAll(/<message>([\s\S]*?)<\/message>/g);
    for (const messageErrorMatch of messageErrorMatches) {
      const messageErrorXml = messageErrorMatch[1];
      const codeMatch = messageErrorXml.match(/<code>(.*?)<\/code>/);
      const textMatch = messageErrorXml.match(/<text>(.*?)<\/text>/);
      messageErrors.push({
        code: codeMatch ? codeMatch[1] : '',
        text: textMatch ? textMatch[1] : '',
      });
    }
    if (messageErrors.length > 0) {
      result.messages.message = messageErrors;
    }
  }

  return result;
}

// Main test function
async function testAuthorizeNet() {
  console.log('='.repeat(60));
  console.log('Authorize.Net Apple Pay Test');
  console.log('='.repeat(60));
  console.log(`API URL: ${BASE_URL}`);
  console.log(`Environment: ${process.env.AUTHORIZE_NET_MODE || 'sandbox'}`);
  console.log(`Order ID: ${ORDER_ID}`);
  console.log(`Invoice Number: ${INVOICE_NUMBER}`);
  console.log(`Amount: $${AMOUNT}`);
  console.log('');

  // Validate configuration
  if (!API_LOGIN_ID || !TRANSACTION_KEY) {
    console.error('❌ Error: API_LOGIN_ID and TRANSACTION_KEY must be set in .env file');
    console.error('');
    console.error('Required environment variables:');
    console.error('  - AUTHORIZE_NET_API_LOGIN_ID');
    console.error('  - AUTHORIZE_NET_TRANSACTION_KEY');
    console.error('  - AUTHORIZE_NET_MODE (optional, default: sandbox)');
    process.exit(1);
  }

  // Load token
  const applePayToken = loadToken();
  console.log(`Token loaded: ${applePayToken.paymentMethod?.displayName || 'Unknown'}`);
  console.log(`Transaction ID: ${applePayToken.transactionIdentifier || 'N/A'}`);
  console.log('');

  try {
    // Create XML request
    const xmlRequest = createXmlRequest(applePayToken, AMOUNT, ORDER_ID, INVOICE_NUMBER);
    
    console.log('📤 Sending request to Authorize.Net...');
    console.log('');

    // Make API request
    const response = await axios.post(BASE_URL, xmlRequest, {
      headers: {
        'Content-Type': 'application/xml',
      },
      timeout: 30000,
    });

    // Parse response
    const parsedResponse = parseXmlResponse(response.data);

    console.log('📥 Response received:');
    console.log('');
    console.log('Messages Result Code:', parsedResponse.messages.resultCode);
    console.log('Transaction Response Code:', parsedResponse.transactionResponse.responseCode);
    
    if (parsedResponse.transactionResponse.transId) {
      console.log('Transaction ID:', parsedResponse.transactionResponse.transId);
    }
    
    if (parsedResponse.transactionResponse.authCode) {
      console.log('Auth Code:', parsedResponse.transactionResponse.authCode);
    }

    if (parsedResponse.transactionResponse.errors && parsedResponse.transactionResponse.errors.length > 0) {
      console.log('');
      console.log('❌ Transaction Errors:');
      parsedResponse.transactionResponse.errors.forEach(err => {
        console.log(`  - [${err.errorCode}] ${err.errorText}`);
      });
    }

    if (parsedResponse.messages.message && parsedResponse.messages.message.length > 0) {
      console.log('');
      console.log('❌ Message Errors:');
      parsedResponse.messages.message.forEach(msg => {
        console.log(`  - [${msg.code}] ${msg.text}`);
      });
    }

    if (parsedResponse.messages.resultCode === 'Ok' && parsedResponse.transactionResponse.responseCode === '1') {
      console.log('');
      console.log('✅ Transaction successful!');
      console.log('Transaction ID:', parsedResponse.transactionResponse.transId);
      console.log('Auth Code:', parsedResponse.transactionResponse.authCode);
    } else {
      console.log('');
      console.log('❌ Transaction failed');
    }

    console.log('');
    console.log('Full Response:');
    console.log(JSON.stringify(parsedResponse, null, 2));

  } catch (error) {
    console.error('');
    console.error('❌ Error occurred:');
    console.error('Message:', error.message);
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Status Text:', error.response.statusText);
      
      const parsedResponse = parseXmlResponse(error.response.data);
      console.error('');
      console.error('Parsed Error Response:');
      console.error(JSON.stringify(parsedResponse, null, 2));
      
      // Show error details
      if (parsedResponse.messages?.message) {
        console.error('');
        console.error('Error Messages:');
        parsedResponse.messages.message.forEach(msg => {
          console.error(`  - [${msg.code}] ${msg.text}`);
        });
      }
      
      if (parsedResponse.transactionResponse?.errors) {
        console.error('');
        console.error('Transaction Errors:');
        parsedResponse.transactionResponse.errors.forEach(err => {
          console.error(`  - [${err.errorCode}] ${err.errorText}`);
        });
      }
    } else if (error.request) {
      console.error('No response received. Network error?');
      console.error('Request:', error.request);
    }
    
    console.error('');
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run test
testAuthorizeNet();

