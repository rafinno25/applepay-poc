import express from 'express';
import https from 'https';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import config from '../config/applepay.js';
import authorizeNetService from '../services/authorizeNet.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

/**
 * Configuration Endpoint
 * GET /api/applepay/config
 * Returns frontend configuration (merchant ID, payment amount)
 */
router.get('/config', (req, res) => {
  res.json({
    merchantId: config.appleMerchantId,
    paymentAmount: config.paymentAmount,
  });
});

/**
 * Merchant Validation Endpoint
 * POST /api/applepay/validate
 * 
 * Validates merchant with Apple Pay servers
 * Required by Apple Pay - must be called when onvalidatemerchant event fires
 */
router.post('/validate', asyncHandler(async (req, res) => {
  const { validationURL } = req.body;

  // Validate input
  if (!validationURL) {
    const error = new Error('validationURL is required');
    error.type = 'validation';
    error.details = {
      field: 'validationURL',
      constraint: 'required',
    };
    throw error;
  }

  // Log validation attempt
  console.log('[Apple Pay] Merchant validation request:', {
    validationURL,
    merchantId: config.appleMerchantId,
    timestamp: new Date().toISOString(),
  });

  try {
    // Load merchant identity certificate and private key
    let merchantCert, merchantKey;

    try {
      merchantCert = fs.readFileSync(config.appleMerchantCertPath, 'utf8');
    } catch (err) {
      const error = new Error(`Failed to load merchant certificate: ${err.message}`);
      error.code = 'ENOENT';
      error.applePayError = {
        type: 'CertificateError',
        message: 'Merchant identity certificate not found',
        path: config.appleMerchantCertPath,
      };
      throw error;
    }

    try {
      merchantKey = fs.readFileSync(config.appleMerchantKeyPath, 'utf8');
    } catch (err) {
      const error = new Error(`Failed to load merchant private key: ${err.message}`);
      error.code = 'ENOENT';
      error.applePayError = {
        type: 'CertificateError',
        message: 'Merchant private key not found',
        path: config.appleMerchantKeyPath,
      };
      throw error;
    }

    // Prepare request data
    const requestData = JSON.stringify({
      merchantIdentifier: config.appleMerchantId,
      domainName: req.hostname || req.get('host'),
      displayName: 'Apple Pay POC',
    });

    // Make request to Apple's validation URL with certificate
    const merchantSession = await new Promise((resolve, reject) => {
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestData),
        },
        key: merchantKey,
        cert: merchantCert,
      };

      const req = https.request(validationURL, options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const session = JSON.parse(data);
              console.log('[Apple Pay] Merchant validation successful');
              resolve(session);
            } else {
              const error = new Error(`Apple validation failed with status ${res.statusCode}`);
              error.applePayError = {
                statusCode: res.statusCode,
                statusMessage: res.statusMessage,
                response: data,
              };
              reject(error);
            }
          } catch (parseError) {
            const error = new Error('Failed to parse Apple validation response');
            error.originalError = parseError.message;
            error.applePayError = {
              response: data,
            };
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        const err = new Error(`Network error during merchant validation: ${error.message}`);
        err.originalError = error;
        err.applePayError = {
          type: 'NetworkError',
          message: error.message,
        };
        reject(err);
      });

      req.setTimeout(10000, () => {
        req.destroy();
        const error = new Error('Merchant validation request timeout');
        error.applePayError = {
          type: 'TimeoutError',
        };
        reject(error);
      });

      req.write(requestData);
      req.end();
    });

    // Return merchant session to frontend
    res.json({
      success: true,
      merchantSession,
    });

  } catch (error) {
    // Log error with full details
    console.error('[Apple Pay] Merchant validation error:', {
      message: error.message,
      applePayError: error.applePayError,
      stack: config.isDevelopment ? error.stack : undefined,
    });

    throw error;
  }
}));

/**
 * Payment Processing Endpoint
 * POST /api/applepay/process
 * 
 * Processes Apple Pay token with Authorize.Net
 */
router.post('/process', asyncHandler(async (req, res) => {
  const { paymentToken, amount, userId, orderInfo } = req.body;

  // Validate input
  const validationErrors = [];

  if (!paymentToken) {
    validationErrors.push({
      field: 'paymentToken',
      constraint: 'required',
      message: 'paymentToken is required',
    });
  }

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    validationErrors.push({
      field: 'amount',
      constraint: 'invalid',
      message: 'amount must be a positive number',
    });
  }

  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    validationErrors.push({
      field: 'userId',
      constraint: 'required',
      message: 'userId is required',
    });
  }

  if (validationErrors.length > 0) {
    const error = new Error('Validation failed');
    error.type = 'validation';
    error.fields = validationErrors;
    throw error;
  }

  // Log payment processing attempt
  console.log('[Apple Pay] Payment processing request:', {
    userId,
    amount,
    orderInfo,
    timestamp: new Date().toISOString(),
  });

  try {
    // Process payment with Authorize.Net
    const result = await authorizeNetService.processApplePayTransaction({
      paymentToken,
      amount,
      userId,
      orderInfo: orderInfo || {},
    });

    // Log successful transaction
    console.log('[Apple Pay] Payment processed successfully:', {
      transactionId: result.transactionId,
      amount: result.amount,
    });

    // Return success response with detailed information
    res.json({
      success: true,
      transaction: {
        id: result.transactionId,
        authCode: result.authCode,
        amount: result.amount,
        status: 'approved',
        responseCode: result.responseCode,
      },
      details: result.details,
    });

  } catch (error) {
    // Log error with full details
    console.error('[Apple Pay] Payment processing error:', {
      message: error.message,
      authorizeNetError: error.authorizeNetError,
      stack: config.isDevelopment ? error.stack : undefined,
    });

    throw error;
  }
}));

/**
 * Webhook Endpoint for Authorize.Net Notifications
 * POST /api/applepay/webhook
 * 
 * Receives real-time notifications from Authorize.Net about transaction events
 * Best practice for production: Monitor settlement, refunds, chargebacks, etc.
 * 
 * Documentation: https://developer.authorize.net/api/reference/features/webhooks.html
 */
router.post('/webhook', asyncHandler(async (req, res) => {
  const webhookSignature = req.get('X-Anet-Signature');
  const webhookEventId = req.get('X-Anet-Event-Id');
  const payload = req.body;

  // Log webhook received
  console.log('[Authorize.Net] Webhook received:', {
    eventId: webhookEventId,
    eventType: payload.eventType,
    timestamp: new Date().toISOString(),
    payload: payload,
  });

  // Verify webhook signature (best practice for production)
  // Note: For production, you should verify the signature using Signature Key from Authorize.Net
  // For POC, we'll log this information but won't enforce signature verification
  if (webhookSignature) {
    console.log('[Authorize.Net] Webhook signature present:', webhookSignature);
    // TODO: Implement signature verification using Signature Key from Authorize.Net
    // const isValid = verifyWebhookSignature(payload, webhookSignature, config.authorizeNetSignatureKey);
    // if (!isValid) {
    //   const error = new Error('Invalid webhook signature');
    //   error.statusCode = 401;
    //   throw error;
    // }
  }

  try {
    // Handle different webhook event types
    const { eventType, payload: eventPayload } = payload;

    switch (eventType) {
      case 'net.authorize.payment.authorization.created':
        console.log('[Authorize.Net] Transaction authorized:', eventPayload);
        // Handle authorization created event
        // e.g., Update order status, send confirmation email, etc.
        break;

      case 'net.authorize.payment.capture.created':
        console.log('[Authorize.Net] Payment captured:', eventPayload);
        // Handle payment captured event (settlement)
        // e.g., Mark order as paid, trigger fulfillment, etc.
        break;

      case 'net.authorize.payment.refund.created':
        console.log('[Authorize.Net] Refund created:', eventPayload);
        // Handle refund event
        // e.g., Update order status, process refund in your system, etc.
        break;

      case 'net.authorize.payment.void.created':
        console.log('[Authorize.Net] Payment voided:', eventPayload);
        // Handle void event
        // e.g., Cancel order, release inventory, etc.
        break;

      case 'net.authorize.payment.fraud.approved':
        console.log('[Authorize.Net] Fraud review approved:', eventPayload);
        // Handle fraud approved event
        break;

      case 'net.authorize.payment.fraud.declined':
        console.log('[Authorize.Net] Fraud review declined:', eventPayload);
        // Handle fraud declined event
        break;

      default:
        console.log('[Authorize.Net] Unknown webhook event type:', eventType);
    }

    // Return 200 OK to acknowledge receipt
    // Authorize.Net expects a 200 response within 10 seconds
    res.status(200).json({
      success: true,
      message: 'Webhook received and processed',
      eventType: eventType,
      eventId: webhookEventId,
    });

  } catch (error) {
    console.error('[Authorize.Net] Webhook processing error:', {
      message: error.message,
      stack: config.isDevelopment ? error.stack : undefined,
      payload: payload,
    });

    // Still return 200 to prevent Authorize.Net from retrying
    // Log error for manual investigation
    res.status(200).json({
      success: false,
      message: 'Webhook received but processing failed',
      error: error.message,
    });
  }
}));

export default router;

