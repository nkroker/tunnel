import CryptoJS from 'crypto-js';
import { logger } from './logger';

export class MessageProcessor {
  constructor(private encryptionKey: string) {
    if (!encryptionKey || encryptionKey.length < 32) {
      throw new Error('Encryption key must be at least 32 characters long');
    }
  }

  async processOutgoingMessage(message: any): Promise<string> {
    const messageStr = JSON.stringify(message);
    logger.debug('Processing outgoing message:', {
      messageLength: messageStr.length,
      keyLength: this.encryptionKey.length
    });
    return CryptoJS.AES.encrypt(messageStr, this.encryptionKey).toString();
  }

  async processIncomingMessage(encryptedMessage: string): Promise<any> {
    logger.debug('Processing incoming message:', {
      encryptedLength: encryptedMessage.length,
      keyLength: this.encryptionKey.length
    });
    const decrypted = CryptoJS.AES.decrypt(encryptedMessage, this.encryptionKey);
    const messageStr = decrypted.toString(CryptoJS.enc.Utf8);

    if (!messageStr) {
      throw new Error('Decryption resulted in empty string');
    }

    return JSON.parse(messageStr);
  }
}
