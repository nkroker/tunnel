import { WSMessage } from '@tunnel/common';
import CryptoJS from 'crypto-js';
import { logger } from './logger';

export class MessageProcessor {
  constructor(private encryptionKey: string) {
    logger.debug('MessageProcessor initialized with key length:', this.encryptionKey.length);
  }

  async processOutgoingMessage(message: WSMessage): Promise<string> {
    try {
      const messageStr = JSON.stringify(message);
      logger.debug('Outgoing message:', messageStr);

      const encrypted = CryptoJS.AES.encrypt(messageStr, this.encryptionKey).toString();
      logger.debug('Encrypted message length:', encrypted.length);
      return encrypted;
    } catch (error) {
      logger.error('Failed to process outgoing message:', error);
      throw new Error(`Failed to process outgoing message: ${error}`);
    }
  }

  async processIncomingMessage(data: string): Promise<WSMessage> {
    try {
      logger.debug('Incoming raw data:', data);

      const bytes = CryptoJS.AES.decrypt(data, this.encryptionKey);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      logger.debug('Decrypted message:', decrypted);

      if (!decrypted) {
        throw new Error('Decryption resulted in empty string');
      }

      const parsed = JSON.parse(decrypted);
      logger.debug('Parsed message:', parsed);
      return parsed;
    } catch (error) {
      logger.error('Failed to process incoming message:', error);
      throw new Error(`Failed to process incoming message: ${error}`);
    }
  }
}
