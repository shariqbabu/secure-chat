/**
 * Core encryption utilities for AES-256-GCM
 * Web Crypto API implementation
 */

const ALGORITHM = 'AES-GCM';
const KEY_SIZE = 256;
const IV_SIZE = 12; // 96 bits for GCM
const SALT_SIZE = 16; // 128 bits for PBKDF2

/**
 * Generate a random IV for encryption
 */
export function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(IV_SIZE));
}

/**
 * Generate a random salt for key derivation
 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_SIZE));
}

/**
 * Derive an encryption key from a base key (usually a shared secret) using HKDF
 */
export async function deriveKeyFromSecret(
  secret: Uint8Array,
  info: string = 'secure-chat-v1'
): Promise<CryptoKey> {
  try {
    // Import the secret as a raw key
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      secret.buffer as ArrayBuffer,
      { name: 'HKDF' },
      false,
      ['deriveBits']
    );

    // Derive bits using HKDF
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new Uint8Array(0),
        info: new TextEncoder().encode(info),
      },
      keyMaterial,
      KEY_SIZE
    );

    // Import the derived bits as an AES key
    return crypto.subtle.importKey(
      'raw',
      derivedBits,
      { name: ALGORITHM },
      false,
      ['encrypt', 'decrypt']
    );
  } catch (error) {
    throw new Error(`Failed to derive key from secret: ${error}`);
  }
}

/**
 * Derive an encryption key from a password using PBKDF2
 * Used for hidden chat PIN protection
 */
export async function deriveKeyFromPassword(
  password: string,
  salt?: Uint8Array
): Promise<{ key: CryptoKey; salt: Uint8Array }> {
  try {
    const actualSalt = salt || generateSalt();

    // Encode password
    const passwordBuffer = new TextEncoder().encode(password);

    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    // Derive the key using PBKDF2
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: actualSalt.buffer as ArrayBuffer,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: ALGORITHM, length: KEY_SIZE },
      false,
      ['encrypt', 'decrypt']
    );

    return { key, salt: actualSalt };
  } catch (error) {
    throw new Error(`Failed to derive key from password: ${error}`);
  }
}

/**
 * Encrypt a message using AES-256-GCM
 * Returns { ciphertext, iv, authTag }
 */
export async function encryptMessage(
  message: string,
  encryptionKey: CryptoKey,
  iv?: Uint8Array
): Promise<{ ciphertext: string; iv: string }> {
  try {
    const actualIV = iv || generateIV();
    const messageBuffer = new TextEncoder().encode(message);

    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv: actualIV.buffer as ArrayBuffer },
      encryptionKey,
      messageBuffer
    );

    // Convert to base64 for storage/transmission
    const ciphertext = arrayBufferToBase64(encryptedBuffer);
    const ivBase64 = arrayBufferToBase64(actualIV.buffer as ArrayBuffer);

    return { ciphertext, iv: ivBase64 };
  } catch (error) {
    throw new Error(`Encryption failed: ${error}`);
  }
}

/**
 * Decrypt a message using AES-256-GCM
 */
export async function decryptMessage(
  ciphertext: string,
  ivBase64: string,
  encryptionKey: CryptoKey
): Promise<string> {
  try {
    const encryptedBuffer = base64ToArrayBuffer(ciphertext);
    const iv = base64ToArrayBuffer(ivBase64);

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      encryptionKey,
      encryptedBuffer
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (error) {
    throw new Error(`Decryption failed: ${error}`);
  }
}

/**
 * Encrypt a file (returns encrypted chunks for large files)
 */
export async function encryptFile(
  file: File,
  encryptionKey: CryptoKey
): Promise<{ encryptedData: string; iv: string; fileName: string }> {
  try {
    const buffer = await file.arrayBuffer();
    const iv = generateIV();

    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv: iv.buffer as ArrayBuffer },
      encryptionKey,
      buffer
    );

    return {
      encryptedData: arrayBufferToBase64(encryptedBuffer),
      iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
      fileName: file.name,
    };
  } catch (error) {
    throw new Error(`File encryption failed: ${error}`);
  }
}

/**
 * Decrypt a file
 */
export async function decryptFile(
  encryptedData: string,
  ivBase64: string,
  encryptionKey: CryptoKey,
  _fileName: string,
  mimeType: string
): Promise<Blob> {
  try {
    const encryptedBuffer = base64ToArrayBuffer(encryptedData);
    const iv = base64ToArrayBuffer(ivBase64);

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      encryptionKey,
      encryptedBuffer
    );

    return new Blob([decryptedBuffer], { type: mimeType });
  } catch (error) {
    throw new Error(`File decryption failed: ${error}`);
  }
}

/**
 * Utility: Convert ArrayBuffer to Base64
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Utility: Convert Base64 to ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Verify message integrity using HMAC-SHA256
 */
export async function computeHMAC(
  message: string,
  keyMaterial: Uint8Array
): Promise<string> {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      keyMaterial.buffer as ArrayBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const messageBuffer = new TextEncoder().encode(message);
    const signature = await crypto.subtle.sign('HMAC', key, messageBuffer);

    return arrayBufferToBase64(signature);
  } catch (error) {
    throw new Error(`HMAC computation failed: ${error}`);
  }
}

/**
 * Verify HMAC signature
 */
export async function verifyHMAC(
  message: string,
  signature: string,
  keyMaterial: Uint8Array
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      keyMaterial.buffer as ArrayBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const messageBuffer = new TextEncoder().encode(message);
    const signatureBuffer = base64ToArrayBuffer(signature);

    return crypto.subtle.verify('HMAC', key, signatureBuffer, messageBuffer);
  } catch (error) {
    console.error('HMAC verification failed:', error);
    return false;
  }
}
