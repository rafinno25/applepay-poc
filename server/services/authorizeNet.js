import axios from 'axios';
import config from '../config/applepay.js';

/**
 * Authorize.Net Service
 * Handles Apple Pay token processing with Authorize.Net API
 * 
 * Documentation: https://developer.authorize.net/api/reference/features/digital_payments.html
 */
class AuthorizeNetService {
  constructor() {
    this.apiLoginId = config.authorizeNetApiLoginId;
    this.transactionKey = config.authorizeNetTransactionKey;
    this.baseUrl = config.authorizeNetBaseUrl;
  }

  /**
   * Create XML request for Authorize.Net API
   * @param {Object} transactionData - Transaction data
   * @returns {string} XML request string
   */
  createXmlRequest(transactionData) {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<createTransactionRequest xmlns="AnetApi/xml/v1/schema/AnetApiSchema.xsd">
  <merchantAuthentication>
    <name>${this.escapeXml(this.apiLoginId)}</name>
    <transactionKey>${this.escapeXml(this.transactionKey)}</transactionKey>
  </merchantAuthentication>
  <refId>${this.escapeXml(transactionData.refId || '')}</refId>
  <transactionRequest>
    <transactionType>authCaptureTransaction</transactionType>
    <amount>${this.escapeXml(transactionData.amount)}</amount>
    <payment>
      <opaqueData>
        <dataDescriptor>${this.escapeXml(transactionData.dataDescriptor)}</dataDescriptor>
        <dataValue>${this.escapeXml(transactionData.dataValue)}</dataValue>
      </opaqueData>
    </payment>
    <order>
      <invoiceNumber>${this.escapeXml(transactionData.invoiceNumber || '')}</invoiceNumber>
      <description>${this.escapeXml(transactionData.description || 'Apple Pay Payment')}</description>
    </order>
    <customer>
      <id>${this.escapeXml(transactionData.customerId || '')}</id>
      <email>${this.escapeXml(transactionData.email || '')}</email>
    </customer>
    <billTo>
      <firstName>${this.escapeXml(transactionData.billingAddress?.firstName || '')}</firstName>
      <lastName>${this.escapeXml(transactionData.billingAddress?.lastName || '')}</lastName>
      <company>${this.escapeXml(transactionData.billingAddress?.company || '')}</company>
      <address>${this.escapeXml(transactionData.billingAddress?.address || '')}</address>
      <city>${this.escapeXml(transactionData.billingAddress?.city || '')}</city>
      <state>${this.escapeXml(transactionData.billingAddress?.state || '')}</state>
      <zip>${this.escapeXml(transactionData.billingAddress?.zip || '')}</zip>
      <country>${this.escapeXml(transactionData.billingAddress?.country || '')}</country>
    </billTo>
  </transactionRequest>
</createTransactionRequest>`;

    return xml;
  }

  /**
   * Escape XML special characters
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  escapeXml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Parse XML response from Authorize.Net
   * @param {string} xmlString - XML response string
   * @returns {Object} Parsed response object
   */
  parseXmlResponse(xmlString) {
    // Simple XML parsing (for production, consider using xml2js or similar)
    // This is a basic implementation for POC
    const result = {
      transactionResponse: {},
      messages: {},
    };

    // Extract transaction response
    const transMatch = xmlString.match(/<transactionResponse[^>]*>([\s\S]*?)<\/transactionResponse>/);
    if (transMatch) {
      const transXml = transMatch[1];
      
      // Extract response code
      const responseCodeMatch = transXml.match(/<responseCode>(.*?)<\/responseCode>/);
      if (responseCodeMatch) {
        result.transactionResponse.responseCode = responseCodeMatch[1];
      }

      // Extract auth code
      const authCodeMatch = transXml.match(/<authCode>(.*?)<\/authCode>/);
      if (authCodeMatch) {
        result.transactionResponse.authCode = authCodeMatch[1];
      }

      // Extract trans ID
      const transIdMatch = transXml.match(/<transId>(.*?)<\/transId>/);
      if (transIdMatch) {
        result.transactionResponse.transId = transIdMatch[1];
      }

      // Extract errors
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
    }

    return result;
  }

  /**
   * Process Apple Pay token transaction
   * @param {Object} paymentData - Payment data including Apple Pay token
   * @returns {Promise<Object>} Transaction result
   */
  async processApplePayTransaction(paymentData) {
    const {
      paymentToken, // Apple Pay payment token
      amount,
      userId,
      orderInfo = {},
    } = paymentData;

    try {
      // Extract data from Apple Pay token
      // Apple Pay token structure: { paymentData: { data: "...", header: {...}, signature: "..." } }
      const applePayToken = typeof paymentToken === 'string' 
        ? JSON.parse(paymentToken) 
        : paymentToken;

      // For Authorize.Net, we need to send the encrypted payment data
      // Authorize.Net expects opaqueData format with dataDescriptor and dataValue
      // Note: The exact format depends on Authorize.Net's Apple Pay integration requirements
      // This is a simplified version - actual implementation may vary based on Authorize.Net docs

      // Create transaction request
      const transactionData = {
        refId: orderInfo.orderId || `ORDER-${Date.now()}`,
        amount: amount.toFixed(2),
        dataDescriptor: applePayToken.paymentData?.header?.publicKeyHash || 'COMMON.APPLE.INAPP.PAYMENT',
        dataValue: applePayToken.paymentData?.data || '',
        invoiceNumber: orderInfo.invoiceNumber || `INV-${Date.now()}`,
        description: orderInfo.description || 'Apple Pay Payment',
        customerId: userId || '',
        email: orderInfo.email || '',
        billingAddress: orderInfo.billingAddress || {},
      };

      // Create XML request
      const xmlRequest = this.createXmlRequest(transactionData);

      // Log request for POC debugging
      console.log('[Authorize.Net] Request:', {
        url: this.baseUrl,
        amount: transactionData.amount,
        invoiceNumber: transactionData.invoiceNumber,
        dataDescriptor: transactionData.dataDescriptor,
        // Don't log sensitive dataValue
      });

      // Make API request
      const response = await axios.post(this.baseUrl, xmlRequest, {
        headers: {
          'Content-Type': 'application/xml',
        },
        timeout: 30000, // 30 second timeout
      });

      // Parse response
      const parsedResponse = this.parseXmlResponse(response.data);

      // Log response for POC debugging
      console.log('[Authorize.Net] Response:', {
        resultCode: parsedResponse.messages.resultCode,
        responseCode: parsedResponse.transactionResponse.responseCode,
        transId: parsedResponse.transactionResponse.transId,
        errors: parsedResponse.transactionResponse.errors,
      });

      // Check for errors
      if (parsedResponse.messages.resultCode !== 'Ok') {
        const error = new Error('Authorize.Net transaction failed');
        error.authorizeNetError = {
          resultCode: parsedResponse.messages.resultCode,
          errors: parsedResponse.transactionResponse.errors || [],
          response: parsedResponse,
        };
        throw error;
      }

      // Check transaction response
      if (parsedResponse.transactionResponse.responseCode !== '1') {
        const error = new Error('Transaction was declined');
        error.authorizeNetError = {
          responseCode: parsedResponse.transactionResponse.responseCode,
          errors: parsedResponse.transactionResponse.errors || [],
          response: parsedResponse,
        };
        throw error;
      }

      // Return success result
      return {
        success: true,
        transactionId: parsedResponse.transactionResponse.transId,
        authCode: parsedResponse.transactionResponse.authCode,
        responseCode: parsedResponse.transactionResponse.responseCode,
        amount: amount,
        details: parsedResponse.transactionResponse,
      };

    } catch (error) {
      // Enhance error with Authorize.Net details
      if (error.response) {
        const parsedResponse = this.parseXmlResponse(error.response.data);
        error.authorizeNetError = {
          status: error.response.status,
          statusText: error.response.statusText,
          errors: parsedResponse.transactionResponse?.errors || [],
          response: parsedResponse,
          rawResponse: error.response.data,
        };
      }

      // Log error for POC debugging
      console.error('[Authorize.Net] Error:', {
        message: error.message,
        authorizeNetError: error.authorizeNetError,
        stack: config.isDevelopment ? error.stack : undefined,
      });

      throw error;
    }
  }
}

// Export singleton instance
export default new AuthorizeNetService();

