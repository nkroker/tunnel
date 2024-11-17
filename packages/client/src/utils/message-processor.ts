import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import CryptoJS from 'crypto-js';
import { WSMessage } from '@tunnel/common';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export class MessageProcessor {
  constructor(private encryptionKey: string) {}

  async processOutgoingMessage(message: WSMessage): Promise<string> {
    const messageStr = JSON.stringify(message);
    const compressed = await gzipAsync(Buffer.from(messageStr));
    const encrypted = CryptoJS.AES.encrypt(
      compressed.toString('base64'),
      this.encryptionKey
    ).toString();

    return encrypted;
  }

  async processIncomingMessage(data: string): Promise<WSMessage> {
    const decrypted = CryptoJS.AES.decrypt(
      data,
      this.encryptionKey
    ).toString(CryptoJS.enc.Utf8);
    const decompressed = await gunzipAsync(Buffer.from(decrypted, 'base64'));
    return JSON.parse(decompressed.toString());
  }
}
