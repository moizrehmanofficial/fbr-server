const CryptoJS = require('crypto-js');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
  console.warn('⚠️  WARNING: ENCRYPTION_KEY must be at least 32 characters for security!');
}

/**
 * Encrypt sensitive data (FBR credentials)
 */
const encrypt = (text) => {
  if (!text) return null;
  try {
    const encrypted = CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
    return encrypted;
  } catch (err) {
    throw new Error('Encryption failed');
  }
};

/**
 * Decrypt sensitive data
 */
const decrypt = (encryptedText) => {
  if (!encryptedText) return null;
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted) throw new Error('Decryption resulted in empty string');
    return decrypted;
  } catch (err) {
    throw new Error('Decryption failed - invalid key or corrupted data');
  }
};

/**
 * Encrypt FBR credential object
 */
const encryptFBRCredentials = (credentials) => {
  return {
    ntn: encrypt(credentials.ntn),
    strn: encrypt(credentials.strn),
    apiKey: encrypt(credentials.apiKey),
    apiSecret: encrypt(credentials.apiSecret),
    environment: credentials.environment
  };
};

/**
 * Decrypt FBR credential object
 */
const decryptFBRCredentials = (encryptedCredentials) => {
  return {
    ntn: decrypt(encryptedCredentials.ntn),
    strn: decrypt(encryptedCredentials.strn),
    apiKey: decrypt(encryptedCredentials.apiKey),
    apiSecret: decrypt(encryptedCredentials.apiSecret),
    environment: encryptedCredentials.environment
  };
};

module.exports = { encrypt, decrypt, encryptFBRCredentials, decryptFBRCredentials };