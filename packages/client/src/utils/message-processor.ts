import CryptoJS from 'crypto-js';
import debug from 'debug';
const log = debug('tunnel:message');

export class MessageProcessor {
  private encryptionKey: CryptoJS.lib.WordArray;
  private useEncryption: boolean;

  constructor(key: string, useEncryption: boolean = true) {
    this.useEncryption = useEncryption;
    if (this.useEncryption) {
      this.encryptionKey = CryptoJS.enc.Utf8.parse(key);
      log('Encryption enabled');
    } else {
      log('Encryption disabled');
    }
  }

  async processIncomingMessage(message: string): Promise<any> {
    const startTime = Date.now();

    try {
      // Always try JSON parse first
      try {
        return JSON.parse(message);
      } catch {
        // Only attempt decryption if encryption is enabled
        if (!this.useEncryption) {
          throw new Error('Message is not valid JSON and encryption is disabled');
        }
        log('Message appears to be encrypted, attempting decryption');
      }

      // Decrypt the message with optimized settings
      const bytes = CryptoJS.AES.decrypt(message, this.encryptionKey, {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7
      });

      const decryptedMessage = bytes.toString(CryptoJS.enc.Utf8);

      if (!decryptedMessage) {
        throw new Error('Decryption resulted in empty message');
      }

      const endTime = Date.now();
      log(`Decryption completed in ${endTime - startTime}ms`);

      return JSON.parse(decryptedMessage);
    } catch (error) {
      const endTime = Date.now();
      log('Failed to process incoming message:', {
        error,
        processingTime: `${endTime - startTime}ms`,
        messageLength: message.length,
        encryptionEnabled: this.useEncryption
      });
      throw error;
    }
  }

  async processOutgoingMessage(message: any): Promise<string> {
    const startTime = Date.now();
    try {
      const jsonString = JSON.stringify(message);

      // If encryption is disabled, return JSON string directly
      if (!this.useEncryption) {
        return jsonString;
      }

      // Encrypt with optimized settings
      const encrypted = CryptoJS.AES.encrypt(jsonString, this.encryptionKey, {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7
      }).toString();

      const endTime = Date.now();
      log(`Encryption completed in ${endTime - startTime}ms`);

      return encrypted;
    } catch (error) {
      const endTime = Date.now();
      log('Failed to process outgoing message:', {
        error,
        processingTime: `${endTime - startTime}ms`,
        encryptionEnabled: this.useEncryption
      });
      throw error;
    }
  }
}
