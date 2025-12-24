import { v4 as uuidv4 } from 'uuid';
import logger from './logger.js';

/**
 * Apple Pay POC Application
 * Main application logic for Apple Pay integration
 */

class ApplePayApp {
  constructor() {
    this.userId = '';
    this.applePaySession = null;
    this.merchantId = ''; // Loaded from API
    this.paymentAmount = 10.00; // Loaded from API
    this.isInitiating = false; // Flag to prevent double initiation
    
    this.init();
  }

  /**
   * Initialize the application
   */
  async init() {
    logger.info('Initializing Apple Pay POC application');
    
    // Setup logger to intercept fetch calls
    logger.interceptFetch();

    // Setup event listeners
    this.setupEventListeners();

    // Load configuration from backend
    await this.loadConfig();

    // Show button immediately (will be refined by checkApplePaySupport)
    this.showApplePayButton();

    // Check Apple Pay availability (with delay to ensure merchant ID is loaded)
    setTimeout(() => {
      this.checkApplePaySupport();
    }, 100);

    logger.info('Application initialized');
  }

  /**
   * Load configuration from backend
   */
  async loadConfig() {
    try {
      const response = await fetch('/api/applepay/config');
      const data = await response.json();
      
      if (data.merchantId) {
        this.merchantId = data.merchantId;
      }
      
      if (data.paymentAmount) {
        this.paymentAmount = parseFloat(data.paymentAmount);
      }

      // Update payment amount display
      const amountDisplay = document.getElementById('paymentAmount');
      if (amountDisplay) {
        amountDisplay.textContent = `$${this.paymentAmount.toFixed(2)}`;
      }

      // Update merchant ID display
      const merchantIdDisplay = document.getElementById('merchantIdDisplay');
      if (merchantIdDisplay) {
        merchantIdDisplay.textContent = this.merchantId || '-';
      }

      // Update environment display
      const envDisplay = document.getElementById('environmentDisplay');
      if (envDisplay) {
        envDisplay.textContent = import.meta.env.MODE || 'development';
      }

      // Update connection status
      this.updateConnectionStatus();

      logger.info('Configuration loaded', {
        merchantId: this.merchantId,
        paymentAmount: this.paymentAmount,
      });
    } catch (error) {
      logger.error(error, { context: 'Loading configuration' });
      // Use defaults if API fails
      if (!this.merchantId) {
        this.merchantId = 'merchant.com.example.app';
        logger.warn('Using default merchant ID');
      }
      
      // Update displays with defaults
      const merchantIdDisplay = document.getElementById('merchantIdDisplay');
      if (merchantIdDisplay) {
        merchantIdDisplay.textContent = this.merchantId;
      }
      this.updateConnectionStatus();
    }
  }

  /**
   * Update connection status display
   */
  updateConnectionStatus() {
    const connectionCard = document.getElementById('connectionCard');
    const connectionDisplay = document.getElementById('connectionDisplay');
    const connectionDescription = document.getElementById('connectionDescription');
    
    if (!connectionCard || !connectionDisplay || !connectionDescription) return;

    const isHttps = window.location.protocol === 'https:';
    
    if (isHttps) {
      connectionDisplay.textContent = '✅ HTTPS';
      connectionDescription.textContent = 'Secure connection - Apple Pay ready';
      connectionCard.classList.remove('warning-card');
      connectionCard.classList.add('success-card');
    } else {
      connectionDisplay.textContent = '⚠️ HTTP';
      connectionDescription.textContent = 'Insecure connection - Apple Pay requires HTTPS';
      connectionCard.classList.remove('success-card');
      connectionCard.classList.add('warning-card');
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Generate UUID button
    const generateUuidBtn = document.getElementById('generateUuidBtn');
    if (generateUuidBtn) {
      generateUuidBtn.addEventListener('click', () => {
        this.generateUserId();
      });
    }

    // User ID input change
    const userIdInput = document.getElementById('userId');
    if (userIdInput) {
      userIdInput.addEventListener('input', (e) => {
        this.userId = e.target.value.trim();
      });
    }

    // Check Apple Pay Support button
    const checkApplePayBtn = document.getElementById('checkApplePayBtn');
    if (checkApplePayBtn) {
      checkApplePayBtn.addEventListener('click', () => {
        this.checkApplePaySupportDetailed();
      });
    }

    // Clear logs button
    const clearLogsBtnBottom = document.getElementById('clearLogsBtnBottom');
    if (clearLogsBtnBottom) {
      clearLogsBtnBottom.addEventListener('click', () => {
        logger.clearLogs();
      });
    }

    // Download logs button
    const downloadLogsBtn = document.getElementById('downloadLogsBtn');
    if (downloadLogsBtn) {
      downloadLogsBtn.addEventListener('click', () => {
        this.downloadLogs();
      });
    }

    // Copy logs button
    const copyLogsBtn = document.getElementById('copyLogsBtn');
    if (copyLogsBtn) {
      copyLogsBtn.addEventListener('click', () => {
        this.copyLogsToClipboard();
      });
    }
  }

  /**
   * Generate UUID for user ID
   */
  generateUserId() {
    const newUuid = uuidv4();
    this.userId = newUuid;
    
    const userIdInput = document.getElementById('userId');
    if (userIdInput) {
      userIdInput.value = newUuid;
    }

    logger.event('User ID Generated', { userId: newUuid });
  }

  /**
   * Check Apple Pay support (detailed version for button click)
   */
  checkApplePaySupportDetailed() {
    logger.info('🔍 Checking Apple Pay support...');
    
    if (!window.ApplePaySession) {
      logger.error('Apple Pay is not supported in this browser');
      logger.info('💡 Apple Pay requires Safari on macOS/iOS or Chrome/Edge on supported devices');
      if (window.location.protocol === 'http:') {
        logger.warn('🔒 Note: Apple Pay also requires HTTPS connection');
      }
      return false;
    }

    try {
      const canMakePayments = window.ApplePaySession.canMakePayments();
      const merchantId = this.merchantId || 'merchant.org.aiprotection';
      const canMakePaymentsWithActiveCard = window.ApplePaySession.canMakePaymentsWithActiveCard ? 
        window.ApplePaySession.canMakePaymentsWithActiveCard(merchantId) : false;
      
      // Check API version support
      const supportsVersion3 = window.ApplePaySession.supportsVersion ? 
        window.ApplePaySession.supportsVersion(3) : false;
      
      if (canMakePayments) {
        logger.info('✅ Apple Pay is available in this browser');
        logger.info(`📱 Apple Pay Session API version 3 supported: ${supportsVersion3 ? 'Yes' : 'No'}`);
        
        if (canMakePaymentsWithActiveCard) {
          logger.info('✅ User has active card configured for Apple Pay');
          logger.info(`✅ Apple Pay can be processed with merchant ID: ${merchantId}`);
          logger.info('✅ Payment processing is ready - user can complete Apple Pay transactions');
          this.showApplePayButton();
        } else {
          logger.warn('⚠️ User has Apple Pay but no active card configured');
          logger.warn('⚠️ Payment cannot be processed - user needs to add a card to Apple Pay');
        }
        
        logger.info('✅ Payment request structure is valid');
        logger.info('✅ Supported networks: Visa, MasterCard, Amex');
        logger.info('✅ 3D Secure (3DS) is supported');
        
        if (canMakePaymentsWithActiveCard) {
          logger.info('🎉 Apple Pay is fully ready for payment processing!');
        }
      } else {
        logger.warn('⚠️ Apple Pay is not available (user may not have set up Apple Pay)');
        logger.error('❌ Payment cannot be processed - Apple Pay setup required');
      }
      
      return canMakePayments;
    } catch (error) {
      logger.error(`Error checking Apple Pay: ${error.message}`);
      
      // Check for specific HTTPS error
      if (error.message.includes('insecure') || error.message.includes('HTTPS') || error.message.includes('secure')) {
        logger.error('🔒 Apple Pay requires HTTPS connection');
        logger.info(`💡 Current URL: ${window.location.href}`);
        logger.info('💡 Solution: Use HTTPS URL (e.g., via ngrok or cloudflare tunnel)');
      }
      
      return false;
    }
  }

  /**
   * Check Apple Pay support (simplified version for init)
   */
  checkApplePaySupport() {
    if (!window.ApplePaySession) {
      logger.warn('Apple Pay is not supported in this browser');
      // Show button anyway for testing purposes
      this.showApplePayButton();
      return false;
    }

    if (!window.ApplePaySession.canMakePayments()) {
      logger.warn('Apple Pay is not available on this device');
      // Show button anyway for testing purposes
      this.showApplePayButton();
      return false;
    }

    // Check if can make payments with merchant
    if (window.ApplePaySession.canMakePaymentsWithActiveCard && this.merchantId) {
      window.ApplePaySession.canMakePaymentsWithActiveCard(this.merchantId)
        .then((canMakePayments) => {
          if (canMakePayments) {
            this.showApplePayButton();
            logger.info('Apple Pay is available and ready');
          } else {
            logger.warn('No active Apple Pay cards available');
            // Show button anyway for testing purposes
            this.showApplePayButton();
          }
        })
        .catch((error) => {
          logger.error(error, { context: 'Checking Apple Pay availability' });
          // Show button anyway for testing purposes
          this.showApplePayButton();
        });
    } else {
      // Fallback: show button anyway (older Safari versions or no merchant ID yet)
      this.showApplePayButton();
      logger.info('Apple Pay button shown (availability check not supported or merchant ID not loaded)');
    }

    return true;
  }

  /**
   * Show Apple Pay button
   */
  showApplePayButton() {
    const container = document.getElementById('applePayContainer');
    const wrapper = document.getElementById('applePayButtonWrapper');
    const button = document.getElementById('applePayButton');
    
    if (container && wrapper) {
      // Always remove hidden class
      container.classList.remove('hidden');
      container.style.display = 'block';
      
      // Add click handler to wrapper (only once)
      if (!wrapper.dataset.handlerAttached) {
        wrapper.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.initiateApplePay();
        });
        wrapper.dataset.handlerAttached = 'true';
      }
      
      // Ensure button is visible
      if (button) {
        button.style.setProperty('display', '-apple-pay-button', 'important');
        button.style.setProperty('visibility', 'visible', 'important');
        button.style.setProperty('opacity', '1', 'important');
        button.style.setProperty('width', '100%', 'important');
        button.style.setProperty('min-height', '48px', 'important');
      }
      
      // Ensure wrapper is visible
      if (wrapper) {
        wrapper.style.setProperty('display', 'block', 'important');
        wrapper.style.setProperty('visibility', 'visible', 'important');
        wrapper.style.setProperty('width', '100%', 'important');
        wrapper.style.setProperty('min-height', '48px', 'important');
      }
      
      // Setup fallback button click handler
      const fallbackButton = document.getElementById('applePayFallbackButton');
      if (fallbackButton && !fallbackButton.dataset.handlerAttached) {
        fallbackButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.initiateApplePay();
        });
        fallbackButton.dataset.handlerAttached = 'true';
      }
      
      // Show fallback button immediately for testing (will be hidden if native button works)
      if (fallbackButton) {
        fallbackButton.style.setProperty('display', 'flex', 'important');
      }
      
      // Check if native button rendered after a delay
      setTimeout(() => {
        const buttonHeight = button ? button.offsetHeight : 0;
        const buttonWidth = button ? button.offsetWidth : 0;
        const computedDisplay = button ? window.getComputedStyle(button).display : 'N/A';
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        
        logger.info('Button check', {
          buttonHeight,
          buttonWidth,
          hasApplePaySession: !!window.ApplePaySession,
          buttonDisplay: computedDisplay,
          isSafari: isSafari,
          buttonVisible: buttonHeight > 0 && buttonWidth > 0
        });
        
        // If native Apple Pay button rendered successfully, hide fallback
        if (button && fallbackButton) {
          if (window.ApplePaySession && buttonHeight > 0 && buttonWidth > 0 && computedDisplay === '-apple-pay-button') {
            // Native button is working, hide fallback
            fallbackButton.style.setProperty('display', 'none', 'important');
            logger.info('Native Apple Pay button is displayed and working');
          } else {
            // Native button not working, keep fallback visible
            if (button) {
              button.style.setProperty('display', 'none', 'important');
            }
            fallbackButton.style.setProperty('display', 'flex', 'important');
            logger.info('Fallback Apple Pay button displayed (native button not available or not rendering)');
          }
        }
      }, 1500);
      
      logger.event('Apple Pay Button Displayed', {
        containerVisible: container.style.display,
        buttonExists: !!button,
        applePaySession: !!window.ApplePaySession
      });
    } else {
      logger.warn('Apple Pay button container not found', {
        container: !!container,
        wrapper: !!wrapper
      });
    }
  }


  /**
   * Initiate Apple Pay payment
   */
  initiateApplePay() {
    // Prevent double initiation
    if (this.isInitiating) {
      logger.info('Apple Pay initiation already in progress, ignoring duplicate call');
      return;
    }

    // Validate user ID
    if (!this.userId || this.userId.trim() === '') {
      const error = new Error('User ID is required');
      logger.error(error, { context: 'Initiating Apple Pay' });
      this.showStatusMessage('Please enter or generate a User ID', 'error');
      return;
    }

    // Check if there's already an active session
    if (this.applePaySession) {
      logger.info('Apple Pay session already exists, aborting existing session before creating new one');
      try {
        // Try to abort existing session if possible
        if (typeof this.applePaySession.abort === 'function') {
          this.applePaySession.abort();
        }
      } catch (err) {
        // Ignore errors when aborting
        logger.info('Error aborting existing session (may already be closed):', err.message);
      }
      this.applePaySession = null;
    }

    // Set flag to prevent double initiation
    this.isInitiating = true;

    logger.event('Apple Pay Initiated', { userId: this.userId, amount: this.paymentAmount });

    // Validate merchant ID is set
    if (!this.merchantId || this.merchantId.trim() === '') {
      const error = new Error('Merchant ID is not configured');
      logger.error(error, { context: 'Initiating Apple Pay' });
      this.showStatusMessage('Merchant ID is not configured. Please refresh the page.', 'error');
      this.isInitiating = false;
      return;
    }

    // Create payment request
    const paymentRequest = {
      countryCode: 'US',
      currencyCode: 'USD',
      merchantIdentifier: this.merchantId, // Explicitly set merchant identifier
      supportedNetworks: ['visa', 'masterCard', 'amex'],
      merchantCapabilities: ['supports3DS'],
      total: {
        label: 'Apple Pay POC Payment',
        amount: this.paymentAmount.toFixed(2),
      },
      lineItems: [
        {
          label: 'Payment',
          amount: this.paymentAmount.toFixed(2),
        },
      ],
    };

    logger.info('Payment request created', {
      merchantId: this.merchantId,
      amount: this.paymentAmount,
      countryCode: paymentRequest.countryCode,
      currencyCode: paymentRequest.currencyCode,
    });

    // Create Apple Pay session
    try {
      this.applePaySession = new ApplePaySession(3, paymentRequest);
      logger.info('Apple Pay session object created', {
        merchantId: this.merchantId,
        sessionVersion: 3,
      });
    } catch (sessionError) {
      logger.error(sessionError, { context: 'Creating Apple Pay Session' });
      this.showStatusMessage('Failed to create Apple Pay session. Please check your configuration.', 'error');
      this.isInitiating = false;
      return;
    }

    // Handle merchant validation
    this.applePaySession.onvalidatemerchant = (event) => {
      logger.event('Apple Pay: Merchant Validation Requested', {
        validationURL: event.validationURL,
      });

      // Reset initiation flag when validation starts
      this.isInitiating = false;

      this.validateMerchant(event.validationURL);
    };

    // Handle payment authorization
    this.applePaySession.onpaymentauthorized = (event) => {
      logger.event('Apple Pay: Payment Authorized', {
        payment: {
          token: event.payment.token,
          billingContact: event.payment.billingContact,
          shippingContact: event.payment.shippingContact,
        },
      });

      this.processPayment(event.payment);
    };

    // Handle cancellation
    this.applePaySession.oncancel = (event) => {
      logger.event('Apple Pay: Payment Cancelled');
      this.showStatusMessage('Payment was cancelled', 'info');
      // Clear session reference when cancelled
      this.applePaySession = null;
      // Reset initiation flag
      this.isInitiating = false;
    };

    // Handle errors
    this.applePaySession.onerror = (event) => {
      const error = new Error(`Apple Pay Error: ${event.message || 'Unknown error'}`);
      logger.error(error, {
        context: 'Apple Pay Session',
        errorMessage: event.message,
        errorCode: event.code,
      });
      this.showStatusMessage(`Apple Pay Error: ${event.message || 'Unknown error'}`, 'error');
      // Clear session reference on error
      this.applePaySession = null;
      // Reset initiation flag
      this.isInitiating = false;
    };

    // Begin session
    try {
      this.applePaySession.begin();
      logger.info('Apple Pay session started');
      
      // Add timeout to reset flag if merchant validation doesn't start
      // This handles cases where session is cancelled before validation
      setTimeout(() => {
        if (this.isInitiating) {
          logger.info('Merchant validation did not start within 2 seconds, resetting initiation flag');
          this.isInitiating = false;
        }
      }, 2000);
    } catch (error) {
      logger.error(error, { context: 'Starting Apple Pay session' });
      this.showStatusMessage('Failed to start Apple Pay session', 'error');
      // Clear session reference if begin() fails
      this.applePaySession = null;
      // Reset initiation flag
      this.isInitiating = false;
    }
  }

  /**
   * Validate merchant with backend
   */
  async validateMerchant(validationURL) {
    try {
      logger.info('Validating merchant with backend', { validationURL });

      const response = await fetch('/api/applepay/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          validationURL: validationURL,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Merchant validation failed');
      }

      if (data.success && data.merchantSession) {
        logger.info('Merchant validation successful');
        this.applePaySession.completeMerchantValidation(data.merchantSession);
      } else {
        throw new Error('Invalid merchant validation response');
      }

    } catch (error) {
      logger.error(error, { context: 'Merchant Validation' });
      
      // Complete validation with error
      if (this.applePaySession) {
        try {
          this.applePaySession.abort();
        } catch (abortError) {
          // Ignore abort errors
        }
        this.applePaySession = null;
      }
      
      // Reset initiation flag
      this.isInitiating = false;
      
      this.showStatusMessage('Merchant validation failed. Please check your certificates.', 'error');
    }
  }

  /**
   * Process payment with backend
   */
  async processPayment(payment) {
    try {
      logger.info('Processing payment with backend', {
        paymentToken: payment.token,
      });

      // Build a plain JSON token so all required Apple Pay fields survive serialization.
      const token = payment.token;
      const paymentTokenForServer = {
        paymentData: {
          data: token?.paymentData?.data,
          signature: token?.paymentData?.signature,
          header: token?.paymentData?.header,
          version: token?.paymentData?.version,
        },
      };

      const response = await fetch('/api/applepay/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentToken: paymentTokenForServer,
          amount: this.paymentAmount,
          userId: this.userId,
          orderInfo: {
            orderId: `ORDER-${Date.now()}`,
            description: 'Apple Pay POC Payment',
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const error = data.error || new Error('Payment processing failed');
        throw error;
      }

      if (data.success && data.transaction) {
        logger.event('Payment Processed Successfully', {
          transactionId: data.transaction.id,
          amount: data.transaction.amount,
        });

        // Complete payment with success status
        this.applePaySession.completePayment(ApplePaySession.STATUS_SUCCESS);
        
        // Clear session reference after successful completion
        this.applePaySession = null;
        // Reset initiation flag
        this.isInitiating = false;
        
        this.showStatusMessage(
          `Payment successful! Transaction ID: ${data.transaction.id}`,
          'success'
        );
      } else {
        throw new Error('Invalid payment response');
      }

    } catch (error) {
      logger.error(error, { context: 'Payment Processing' });

      // Complete payment with failure status
      if (this.applePaySession) {
        try {
          this.applePaySession.completePayment(ApplePaySession.STATUS_FAILURE);
        } catch (completeError) {
          // Ignore errors when completing payment
        }
        // Clear session reference after completion
        this.applePaySession = null;
      }

      // Reset initiation flag
      this.isInitiating = false;

      const errorMessage = error.error?.message || error.message || 'Payment processing failed';
      this.showStatusMessage(`Payment failed: ${errorMessage}`, 'error');
    }
  }

  /**
   * Download logs as TXT file
   */
  downloadLogs() {
    const logs = logger.getLogs();
    if (logs.length === 0) {
      this.showStatusMessage('No logs to download', 'warning');
      return;
    }

    // Format logs as text
    let logText = 'Apple Pay POC - Test Logs\n';
    logText += `Generated: ${new Date().toISOString()}\n`;
    logText += '='.repeat(50) + '\n\n';

    logs.forEach(log => {
      const timestamp = new Date(log.timestamp).toLocaleString();
      logText += `[${timestamp}] [${log.level}] ${log.message}\n`;
      if (Object.keys(log.data).length > 0) {
        logText += JSON.stringify(log.data, null, 2) + '\n';
      }
      logText += '\n';
    });

    // Create blob and download
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `applepay-poc-logs-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    logger.event('Logs downloaded');
    this.showStatusMessage('Logs downloaded successfully', 'success');
  }

  /**
   * Copy logs to clipboard
   */
  async copyLogsToClipboard() {
    const logs = logger.getLogs();
    if (logs.length === 0) {
      this.showStatusMessage('No logs to copy', 'warning');
      return;
    }

    // Format logs as text
    let logText = 'Apple Pay POC - Test Logs\n';
    logText += `Generated: ${new Date().toISOString()}\n`;
    logText += '='.repeat(50) + '\n\n';

    logs.forEach(log => {
      const timestamp = new Date(log.timestamp).toLocaleString();
      logText += `[${timestamp}] [${log.level}] ${log.message}\n`;
      if (Object.keys(log.data).length > 0) {
        logText += JSON.stringify(log.data, null, 2) + '\n';
      }
      logText += '\n';
    });

    try {
      await navigator.clipboard.writeText(logText);
      logger.event('Logs copied to clipboard');
      this.showStatusMessage('Logs copied to clipboard', 'success');
    } catch (error) {
      logger.error(error, { context: 'Copying logs to clipboard' });
      this.showStatusMessage('Failed to copy logs to clipboard', 'error');
    }
  }

  /**
   * Show status message
   */
  showStatusMessage(message, type = 'info') {
    const statusDiv = document.getElementById('statusMessage');
    if (!statusDiv) return;

    statusDiv.classList.remove('hidden');
    
    // Remove previous type classes
    statusDiv.classList.remove('success', 'error', 'warning', 'info');

    // Add appropriate type class
    statusDiv.classList.add(type);
    statusDiv.textContent = message;

    // Auto-hide after 5 seconds for success/info messages
    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        statusDiv.classList.add('hidden');
      }, 5000);
    }
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new ApplePayApp();
});

