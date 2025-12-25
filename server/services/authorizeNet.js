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
      
      // Extract message errors
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
      // Apple Pay token structure: { paymentData: { data: "...", header: {...}, signature: "..." }, paymentMethod: {...}, transactionIdentifier: "..." }
      const applePayToken = typeof paymentToken === 'string' 
        ? JSON.parse(paymentToken) 
        : paymentToken;

      // For Authorize.Net Apple Pay integration:
      // dataDescriptor must be "COMMON.APPLE.INAPP.PAYMENT"
      // dataValue: Send the entire token.paymentData object (data + header + signature + version)
      // as a base64-encoded JSON string. Gateways commonly need header/signature/version to decrypt.
      const paymentData = applePayToken.paymentData;

      if (!paymentData) {
        throw new Error('Apple Pay token missing paymentData');
      }

      const paymentDataValue = Buffer.from(JSON.stringify(paymentData), 'utf8').toString('base64');

      // Create transaction request
      // Authorize.Net limits:
      // - invoiceNumber: 20 characters max
      // - customer.id: 20 characters max
      const invoiceNumber = orderInfo.invoiceNumber 
        ? orderInfo.invoiceNumber.slice(0, 20)
        : `INV-${Date.now()}`.slice(0, 20);
      
      // Limit customer ID to 20 characters (Authorize.Net limit)
      // If userId is a UUID (36 chars), use a shorter version or hash
      let customerId = '';
      if (userId && userId.trim() !== '') {
        if (userId.length <= 20) {
          customerId = userId;
        } else {
          // For UUIDs or long IDs, use first 20 characters or create a hash
          // Using first 20 chars is simpler for POC
          customerId = userId.slice(0, 20);
        }
      }
      
      const transactionData = {
        refId: orderInfo.orderId || `ORDER-${Date.now()}`,
        amount: amount.toFixed(2),
        // Authorize.Net requires this specific descriptor for Apple Pay
        dataDescriptor: 'COMMON.APPLE.INAPP.PAYMENT',
        // base64(JSON.stringify(token.paymentData))
        dataValue: paymentDataValue,
        invoiceNumber: invoiceNumber,
        description: orderInfo.description || 'Apple Pay Payment',
        customerId: customerId,
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
        dataValueLength: transactionData.dataValue?.length || 0,
        // Don't log sensitive dataValue content
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
        transactionErrors: parsedResponse.transactionResponse.errors,
        messageErrors: parsedResponse.messages.message,
      });

      // Check for errors at messages level
      if (parsedResponse.messages.resultCode !== 'Ok') {
        const errorMessages = parsedResponse.messages.message || [];
        const transactionErrors = parsedResponse.transactionResponse.errors || [];
        const allErrors = [...errorMessages, ...transactionErrors];
        
        const errorMessage = allErrors.length > 0 
          ? allErrors.map(e => e.text || e.errorText || e.code || e.errorCode).join('; ')
          : 'Authorize.Net transaction failed';
        
        const error = new Error(errorMessage);
        error.authorizeNetError = {
          resultCode: parsedResponse.messages.resultCode,
          errors: allErrors,
          messageErrors: errorMessages,
          transactionErrors: transactionErrors,
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
        const errorMessages = parsedResponse.messages?.message || [];
        const transactionErrors = parsedResponse.transactionResponse?.errors || [];
        const allErrors = [...errorMessages, ...transactionErrors];
        
        error.authorizeNetError = {
          status: error.response.status,
          statusText: error.response.statusText,
          resultCode: parsedResponse.messages?.resultCode,
          errors: allErrors,
          messageErrors: errorMessages,
          transactionErrors: transactionErrors,
          response: parsedResponse,
          rawResponse: error.response.data,
        };
      } else if (error.authorizeNetError) {
        // Error already has authorizeNetError from above
        // Make sure errors array is properly populated
        if (!error.authorizeNetError.errors || error.authorizeNetError.errors.length === 0) {
          const messageErrors = error.authorizeNetError.messageErrors || [];
          const transactionErrors = error.authorizeNetError.transactionErrors || [];
          error.authorizeNetError.errors = [...messageErrors, ...transactionErrors];
        }
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


