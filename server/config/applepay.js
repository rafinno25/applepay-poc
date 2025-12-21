/**
 * Configuration module for Apple Pay and Authorize.Net
 * 
 * IMPORTANT: This module follows the structure defined in env.ts (single source of truth)
 * env.ts defines all configuration values, types, and validation rules.
 * 
 * This JavaScript file reads from process.env (which is loaded by env.ts via dotenv)
 * and follows the exact same structure as env.ts for consistency.
 * 
 * For TypeScript usage, import directly from '../../env.ts'
 * For JavaScript usage (like this file), read from process.env with same structure
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load environment variables (env.ts also does this, but we need it here for standalone JS usage)
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Resolve path relative to project root
 * (Matches resolvePath function in env.ts)
 */
function resolvePath(path) {
  if (path.startsWith('/')) {
    return path; // Absolute path
  }
  // Resolve relative to project root (two levels up from server/config/)
  return resolve(__dirname, '../../', path);
}

/**
 * Configuration class - follows env.ts structure
 * Single source of truth is env.ts, but this provides JS compatibility
 */
class Config {
  constructor() {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const authorizeNetMode = process.env.AUTHORIZE_NET_MODE || 'sandbox';

    // Server configuration
    this.port = parseInt(process.env.PORT || '3000', 10);
    this.nodeEnv = nodeEnv;
    this.isDevelopment = nodeEnv === 'development';

    // Apple Pay configuration
    this.appleMerchantId = process.env.APPLE_MERCHANT_ID || '';
    this.appleMerchantCertPath = resolvePath(
      process.env.APPLE_MERCHANT_CERT_PATH || './certs/apple-merchant-cert.pem'
    );
    this.appleMerchantKeyPath = resolvePath(
      process.env.APPLE_MERCHANT_KEY_PATH || './certs/apple-merchant-key.pem'
    );

    // Authorize.Net configuration
    this.authorizeNetApiLoginId = process.env.AUTHORIZE_NET_API_LOGIN_ID || '';
    this.authorizeNetTransactionKey = process.env.AUTHORIZE_NET_TRANSACTION_KEY || '';
    this.authorizeNetMode = authorizeNetMode;
    this.authorizeNetBaseUrl =
      authorizeNetMode === 'production'
        ? 'https://api.authorize.net/xml/v1/request.api'
        : 'https://apitest.authorize.net/xml/v1/request.api';
    this.authorizeNetSignatureKey = process.env.AUTHORIZE_NET_SIGNATURE_KEY || '';

    // Payment configuration
    this.paymentAmount = parseFloat(process.env.PAYMENT_AMOUNT || '10.00');

    // Validate configuration
    this.validate();
  }

  /**
   * Validate required configuration
   * @throws {Error} If required configuration is missing
   */
  validate() {
    const errors = [];

    if (!this.appleMerchantId) {
      errors.push('APPLE_MERCHANT_ID is required');
    }

    if (!this.authorizeNetApiLoginId) {
      errors.push('AUTHORIZE_NET_API_LOGIN_ID is required');
    }

    if (!this.authorizeNetTransactionKey) {
      errors.push('AUTHORIZE_NET_TRANSACTION_KEY is required');
    }

    if (errors.length > 0) {
      throw new Error(`Configuration errors:\n${errors.join('\n')}`);
    }
  }

  /**
   * Get all configuration (useful for debugging)
   * @returns {Object} Configuration object (with sensitive data masked)
   */
  getConfig() {
    return {
      port: this.port,
      nodeEnv: this.nodeEnv,
      isDevelopment: this.isDevelopment,
      appleMerchantId: this.appleMerchantId,
      appleMerchantCertPath: this.appleMerchantCertPath,
      appleMerchantKeyPath: this.appleMerchantKeyPath,
      authorizeNetApiLoginId: this.authorizeNetApiLoginId ? '***' : '',
      authorizeNetTransactionKey: this.authorizeNetTransactionKey ? '***' : '',
      authorizeNetMode: this.authorizeNetMode,
      authorizeNetBaseUrl: this.authorizeNetBaseUrl,
      paymentAmount: this.paymentAmount,
    };
  }
}

// Export singleton instance
export default new Config();

