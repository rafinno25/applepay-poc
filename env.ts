/**
 * Environment Configuration
 * Single source of truth for all environment variables
 * Type-safe configuration with validation
 * 
 * This file can be used in both TypeScript and JavaScript contexts
 * For JavaScript: import from this file directly (Node.js with type: "module" supports .ts files via tsx/ts-node)
 * For TypeScript: import from this file with full type safety
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load .env file if exists
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Resolve path relative to project root
 */
function resolvePath(path: string): string {
  if (path.startsWith('/')) {
    return path; // Absolute path
  }
  // Resolve relative to project root (where env.ts is located)
  return resolve(__dirname, path);
}

/**
 * Environment configuration interface
 */
export interface EnvConfig {
  // Server configuration
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  isDevelopment: boolean;

  // Apple Pay configuration
  appleMerchantId: string;
  appleMerchantCertPath: string;
  appleMerchantKeyPath: string;

  // Authorize.Net configuration
  authorizeNetApiLoginId: string;
  authorizeNetTransactionKey: string;
  authorizeNetMode: 'sandbox' | 'production';
  authorizeNetBaseUrl: string;
  authorizeNetSignatureKey: string;

  // Payment configuration
  paymentAmount: number;
}

/**
 * Get environment variable with type conversion
 */
function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (value === undefined) {
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  const num = parseFloat(value);
  if (isNaN(num)) {
    throw new Error(`Environment variable ${key} must be a valid number, got: ${value}`);
  }
  return num;
}

function getEnvOptional(key: string, defaultValue: string = ''): string {
  return process.env[key] || defaultValue;
}

/**
 * Validate environment configuration
 */
function validateConfig(config: EnvConfig): void {
  const errors: string[] = [];

  if (!config.appleMerchantId) {
    errors.push('APPLE_MERCHANT_ID is required');
  }

  if (!config.authorizeNetApiLoginId) {
    errors.push('AUTHORIZE_NET_API_LOGIN_ID is required');
  }

  if (!config.authorizeNetTransactionKey) {
    errors.push('AUTHORIZE_NET_TRANSACTION_KEY is required');
  }

  if (config.authorizeNetMode !== 'sandbox' && config.authorizeNetMode !== 'production') {
    errors.push('AUTHORIZE_NET_MODE must be either "sandbox" or "production"');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }
}

/**
 * Create configuration object from environment variables
 */
function createConfig(): EnvConfig {
  const nodeEnv = (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test';
  const authorizeNetMode = (process.env.AUTHORIZE_NET_MODE || 'sandbox') as 'sandbox' | 'production';

  const config: EnvConfig = {
    // Server configuration
    port: getEnvNumber('PORT', 3000),
    nodeEnv,
    isDevelopment: nodeEnv === 'development',

    // Apple Pay configuration
    appleMerchantId: getEnvOptional('APPLE_MERCHANT_ID', ''),
    appleMerchantCertPath: resolvePath(
      getEnvOptional('APPLE_MERCHANT_CERT_PATH', './certs/apple-merchant-cert.pem')
    ),
    appleMerchantKeyPath: resolvePath(
      getEnvOptional('APPLE_MERCHANT_KEY_PATH', './certs/apple-merchant-key.pem')
    ),

    // Authorize.Net configuration
    authorizeNetApiLoginId: getEnvOptional('AUTHORIZE_NET_API_LOGIN_ID', ''),
    authorizeNetTransactionKey: getEnvOptional('AUTHORIZE_NET_TRANSACTION_KEY', ''),
    authorizeNetMode,
    authorizeNetBaseUrl:
      authorizeNetMode === 'production'
        ? 'https://api.authorize.net/xml/v1/request.api'
        : 'https://apitest.authorize.net/xml/v1/request.api',
    authorizeNetSignatureKey: getEnvOptional('AUTHORIZE_NET_SIGNATURE_KEY', ''),

    // Payment configuration
    paymentAmount: getEnvNumber('PAYMENT_AMOUNT', 10.0),
  };

  // Validate configuration
  validateConfig(config);

  return config;
}

/**
 * Environment configuration object
 * Single source of truth for all environment variables
 */
export const env = createConfig();

/**
 * Get masked config for logging (hides sensitive data)
 */
export function getMaskedConfig(): Omit<EnvConfig, 'authorizeNetTransactionKey' | 'authorizeNetSignatureKey'> & {
  authorizeNetTransactionKey: string;
  authorizeNetSignatureKey: string;
} {
  return {
    ...env,
    authorizeNetTransactionKey: env.authorizeNetTransactionKey ? '***' : '',
    authorizeNetSignatureKey: env.authorizeNetSignatureKey ? '***' : '',
  };
}

// Export default
export default env;

