/**
 * Environment Variables Example
 * 
 * Copy this file to env.ts and fill in the actual values
 * OR use .env file with the same variable names
 * 
 * env.ts is the single source of truth for environment configuration
 */

// This is just a reference - actual configuration is in env.ts
// The .env file should contain these variables:

export const ENV_EXAMPLE = {
  // Server Configuration
  PORT: '3000',
  NODE_ENV: 'development', // 'development' | 'production' | 'test'

  // Apple Pay Configuration
  APPLE_MERCHANT_ID: 'merchant.org.aiprotection', // Your Apple Pay Merchant ID
  APPLE_MERCHANT_CERT_PATH: './certs/apple-merchant-cert.pem', // Path to Merchant Identity Certificate
  APPLE_MERCHANT_KEY_PATH: './certs/apple-merchant-key.pem', // Path to Private Key

  // Authorize.Net Configuration
  AUTHORIZE_NET_API_LOGIN_ID: 'your_api_login_id_here', // Your Authorize.Net API Login ID
  AUTHORIZE_NET_TRANSACTION_KEY: 'your_transaction_key_here', // Your Authorize.Net Transaction Key
  AUTHORIZE_NET_MODE: 'sandbox', // 'sandbox' | 'production'
  AUTHORIZE_NET_SIGNATURE_KEY: '', // Optional: For webhook verification

  // Payment Configuration
  PAYMENT_AMOUNT: '10.00', // Default payment amount in dollars
};

/**
 * To use:
 * 1. Create .env file with these variables, OR
 * 2. Set environment variables directly, OR
 * 3. Import from env.ts in TypeScript code
 * 
 * env.ts will load from .env file and provide type-safe configuration
 */

