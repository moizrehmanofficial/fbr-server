const axios = require('axios');
const { decryptFBRCredentials } = require('../utils/encryption');

const FBR_URLS = {
  sandbox: process.env.FBR_SANDBOX_URL || 'https://esp.fbr.gov.pk:8500/api',
  production: process.env.FBR_PRODUCTION_URL || 'https://esp.fbr.gov.pk:8443/api'
};

class FBRService {
  /**
   * Get API base URL based on environment
   */
  getBaseUrl(environment) {
    return FBR_URLS[environment] || FBR_URLS.sandbox;
  }

  /**
   * Build axios instance with FBR credentials
   */
  getAxiosInstance(credentials) {
    return axios.create({
      baseURL: this.getBaseUrl(credentials.environment),
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${credentials.apiKey}`,
        'X-API-Key': credentials.apiKey
      }
    });
  }

  /**
   * Test FBR connection with given credentials
   * Returns { success, message, data }
   */
  async testConnection(encryptedCredentials) {
    let credentials;
    try {
      credentials = decryptFBRCredentials(encryptedCredentials);
    } catch (err) {
      return { success: false, message: 'Failed to decrypt credentials' };
    }

    if (!credentials.apiKey || !credentials.apiSecret || !credentials.ntn) {
      return { success: false, message: 'Incomplete FBR credentials (NTN, API Key, API Secret required)' };
    }

    try {
      const client = this.getAxiosInstance(credentials);

      // FBR authentication endpoint
      const response = await client.post('/auth/token', {
        apiKey: credentials.apiKey,
        apiSecret: credentials.apiSecret,
        ntn: credentials.ntn
      });

      if (response.data && (response.data.token || response.data.access_token || response.status === 200)) {
        return {
          success: true,
          message: 'FBR connection successful',
          data: {
            environment: credentials.environment,
            ntn: credentials.ntn
          }
        };
      }

      return { success: false, message: 'FBR authentication failed - invalid response' };

    } catch (err) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        return { success: false, message: 'Cannot reach FBR servers. Check internet connection.' };
      }
      if (err.response) {
        const status = err.response.status;
        if (status === 401) return { success: false, message: 'Invalid FBR API credentials (401 Unauthorized)' };
        if (status === 403) return { success: false, message: 'NTN not registered with FBR digital invoicing (403 Forbidden)' };
        if (status === 404) return { success: false, message: 'FBR API endpoint not found (404). Check environment setting.' };
        return { success: false, message: `FBR API error: ${status} - ${err.response.data?.message || 'Unknown error'}` };
      }
      return { success: false, message: `Connection failed: ${err.message}` };
    }
  }

  /**
   * Get FBR auth token
   */
  async getAuthToken(credentials) {
    const client = this.getAxiosInstance(credentials);
    const response = await client.post('/auth/token', {
      apiKey: credentials.apiKey,
      apiSecret: credentials.apiSecret,
      ntn: credentials.ntn
    });
    return response.data.token || response.data.access_token;
  }

  /**
   * Submit invoice to FBR
   */
  async submitInvoice(encryptedCredentials, invoice) {
    let credentials;
    try {
      credentials = decryptFBRCredentials(encryptedCredentials);
    } catch (err) {
      throw new Error('Failed to decrypt FBR credentials');
    }

    try {
      const token = await this.getAuthToken(credentials);

      const client = axios.create({
        baseURL: this.getBaseUrl(credentials.environment),
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-API-Key': credentials.apiKey
        }
      });

      // Build FBR invoice payload
      const fbrPayload = this.buildFBRPayload(credentials, invoice);

      const response = await client.post('/invoices/submit', fbrPayload);

      return {
        success: true,
        invoiceRefNo: response.data.invoiceRefNo || response.data.InvoiceRefNo,
        qrCode: response.data.qrCode || response.data.QRCode,
        verificationUrl: response.data.verificationUrl,
        rawResponse: response.data
      };

    } catch (err) {
      if (err.response) {
        throw new Error(`FBR submission failed: ${err.response.status} - ${JSON.stringify(err.response.data)}`);
      }
      throw new Error(`FBR submission error: ${err.message}`);
    }
  }

  /**
   * Build FBR-compliant invoice payload
   */
  buildFBRPayload(credentials, invoice) {
    return {
      SellerNTN: credentials.ntn,
      SellerSTRN: credentials.strn,
      BuyerNTN: invoice.customer?.ntn || '',
      BuyerSTRN: invoice.customer?.strn || '',
      BuyerName: invoice.customer?.name || '',
      BuyerPhoneNumber: invoice.customer?.phone || '',
      TotalBillAmount: invoice.grandTotal,
      TotalQuantity: invoice.items.reduce((sum, item) => sum + item.quantity, 0),
      TotalSaleValue: invoice.subtotal,
      TotalTaxCharged: invoice.totalTax,
      Discount: invoice.discount || 0,
      FurtherTax: 0,
      PaymentMode: this.mapPaymentMode(invoice.paymentMethod),
      RefNo: invoice.localId,
      Date: new Date(invoice.invoiceDate).toISOString().split('T')[0],
      InvoiceItems: invoice.items.map((item, idx) => ({
        ItemCode: idx + 1,
        ItemName: item.description,
        Quantity: item.quantity,
        UnitPrice: item.unitPrice,
        SaleValue: item.quantity * item.unitPrice,
        TaxRate: item.taxRate || 0,
        TaxCharged: item.taxAmount || 0,
        TotalAmount: item.totalAmount
      }))
    };
  }

  /**
   * Map payment methods to FBR codes
   */
  mapPaymentMode(method) {
  const map = {
    'cash':          1,
    'card':          2,
    'bank_transfer': 3,
    'cheque':        3,  // FBR treats cheque as bank transfer
    'online':        2,  // FBR treats online as card
    'other':         4,
  };
  return map[method] || 1;
}
}

module.exports = new FBRService();