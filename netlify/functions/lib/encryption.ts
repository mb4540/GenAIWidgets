import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.NETLIFY_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('NETLIFY_ENCRYPTION_KEY environment variable is not set');
  }
  // Hash the key to ensure it's exactly 32 bytes for AES-256
  return crypto.createHash('sha256').update(key).digest();
}

export function encrypt(plaintext: string): { encrypted: string; iv: string; authTag: string } {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

export function decrypt(encryptedData: { encrypted: string; iv: string; authTag: string }): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(encryptedData.iv, 'base64');
  const authTag = Buffer.from(encryptedData.authTag, 'base64');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedData.encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

export function encryptCredentials(credentials: Record<string, unknown>): Record<string, unknown> {
  const plaintext = JSON.stringify(credentials);
  return encrypt(plaintext);
}

export function decryptCredentials(encryptedConfig: Record<string, unknown>): Record<string, unknown> {
  if (!encryptedConfig.encrypted || !encryptedConfig.iv || !encryptedConfig.authTag) {
    throw new Error('Invalid encrypted configuration format');
  }
  
  const decrypted = decrypt({
    encrypted: encryptedConfig.encrypted as string,
    iv: encryptedConfig.iv as string,
    authTag: encryptedConfig.authTag as string,
  });
  
  return JSON.parse(decrypted) as Record<string, unknown>;
}

export function isEncryptionConfigured(): boolean {
  return !!process.env.NETLIFY_ENCRYPTION_KEY;
}
