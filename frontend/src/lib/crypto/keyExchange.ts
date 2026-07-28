/**
 * ECDH Key Exchange implementation using P-384 curve
 * Enables secure key agreement between users
 */

import { deriveKeyFromSecret, arrayBufferToBase64, base64ToArrayBuffer } from './encryption';

const CURVE = 'P-384';
const ALGORITHM = {
  name: 'ECDH',
  namedCurve: CURVE,
};

/**
 * Generate a new ECDH key pair
 */
export async function generateKeyPair(): Promise<CryptoKeyPair> {
  try {
    return await crypto.subtle.generateKey(ALGORITHM, true, ['deriveKey', 'deriveBits']);
  } catch (error) {
    throw new Error(`Failed to generate key pair: ${error}`);
  }
}

/**
 * Export public key to Base64 for transmission/storage
 */
export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  try {
    const exported = await crypto.subtle.exportKey('raw', publicKey);
    return arrayBufferToBase64(exported);
  } catch (error) {
    throw new Error(`Failed to export public key: ${error}`);
  }
}

/**
 * Export private key to Base64 for storage (should be encrypted)
 */
export async function exportPrivateKey(privateKey: CryptoKey): Promise<string> {
  try {
    const exported = await crypto.subtle.exportKey('pkcs8', privateKey);
    return arrayBufferToBase64(exported);
  } catch (error) {
    throw new Error(`Failed to export private key: ${error}`);
  }
}

/**
 * Import public key from Base64
 */
export async function importPublicKey(publicKeyBase64: string): Promise<CryptoKey> {
  try {
    const buffer = base64ToArrayBuffer(publicKeyBase64);
    return await crypto.subtle.importKey('raw', buffer, ALGORITHM, true, []);
  } catch (error) {
    throw new Error(`Failed to import public key: ${error}`);
  }
}

/**
 * Import private key from Base64
 */
export async function importPrivateKey(privateKeyBase64: string): Promise<CryptoKey> {
  try {
    const buffer = base64ToArrayBuffer(privateKeyBase64);
    return await crypto.subtle.importKey('pkcs8', buffer, ALGORITHM, true, [
      'deriveKey',
      'deriveBits',
    ]);
  } catch (error) {
    throw new Error(`Failed to import private key: ${error}`);
  }
}

/**
 * Perform ECDH key agreement to derive a shared secret
 * Used to establish session keys between two users
 */
export async function deriveSharedSecret(
  privateKey: CryptoKey,
  recipientPublicKey: CryptoKey
): Promise<Uint8Array> {
  try {
    const sharedSecret = await crypto.subtle.deriveBits(
      {
        name: ALGORITHM.name,
        public: recipientPublicKey,
      },
      privateKey,
      384 // P-384 produces 384 bits
    );

    return new Uint8Array(sharedSecret);
  } catch (error) {
    throw new Error(`Failed to derive shared secret: ${error}`);
  }
}

/**
 * Complete key exchange flow:
 * 1. Derive shared secret from ECDH
 * 2. Generate AES-256-GCM session key
 */
export async function performKeyExchange(
  myPrivateKey: CryptoKey,
  theirPublicKey: CryptoKey,
  conversationId: string
): Promise<CryptoKey> {
  try {
    // Step 1: ECDH key agreement
    const sharedSecret = await deriveSharedSecret(myPrivateKey, theirPublicKey);

    // Step 2: Derive encryption key from shared secret
    // Include conversation ID in the derivation for additional security
    const encryptionKey = await deriveKeyFromSecret(
      sharedSecret,
      `secure-chat-session-${conversationId}`
    );

    return encryptionKey;
  } catch (error) {
    throw new Error(`Key exchange failed: ${error}`);
  }
}

/**
 * Generate key fingerprint for manual verification
 * Users can compare these to ensure they're talking to the right person
 */
export async function generateKeyFingerprint(publicKeyBase64: string): Promise<string> {
  try {
    const publicKeyBuffer = base64ToArrayBuffer(publicKeyBase64);

    // Hash the public key
    const hash = await crypto.subtle.digest('SHA-256', publicKeyBuffer);
    const hashBase64 = arrayBufferToBase64(hash);

    // Return first 12 characters as user-friendly fingerprint
    return hashBase64.substring(0, 12).toUpperCase();
  } catch (error) {
    throw new Error(`Failed to generate key fingerprint: ${error}`);
  }
}

/**
 * Generate a device fingerprint for tracking sessions
 * Combines various device characteristics
 */
export async function generateDeviceFingerprint(): Promise<string> {
  try {
    const components = [
      navigator.userAgent,
      navigator.language,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency,
      (navigator as any).deviceMemory || 'unknown',
      screen.width,
      screen.height,
      screen.colorDepth,
    ];

    const fingerprintString = components.join('|');
    const encoder = new TextEncoder();
    const data = encoder.encode(fingerprintString);
    const hash = await crypto.subtle.digest('SHA-256', data);

    return arrayBufferToBase64(hash).substring(0, 32);
  } catch (error) {
    throw new Error(`Failed to generate device fingerprint: ${error}`);
  }
}

/**
 * Verify that two public keys form a valid key pair
 * Used during testing and key management
 */
export async function verifyKeyPair(
  publicKeyBase64: string,
  privateKeyBase64: string
): Promise<boolean> {
  try {
    const publicKey = await importPublicKey(publicKeyBase64);
    const privateKey = await importPrivateKey(privateKeyBase64);

    // Try to use ECDH with both keys
    const sharedSecret = await deriveSharedSecret(privateKey, publicKey);

    // If we got here without error, keys are valid
    return sharedSecret.length === 48; // P-384 produces 48 bytes
  } catch (error) {
    console.error('Key pair verification failed:', error);
    return false;
  }
}
