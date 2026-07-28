/**
 * Session key manager — the missing piece that makes E2EE actually work.
 *
 * For each chat we derive a symmetric AES-256-GCM key from:
 *   my ECDH private key  +  the peer's ECDH public key  +  chatId
 * via ECDH → HKDF (see performKeyExchange). The derived key is deterministic
 * for both sides (ECDH is symmetric), so A and B independently arrive at the
 * same session key without ever transmitting it.
 *
 * Keys are cached in-memory per chat. The private key is unlocked once after
 * login (password-derived) and kept for the session.
 */

import { performKeyExchange, importPublicKey } from './keyExchange';
import { getStoredPrivateKey } from './keyStorage';
import { encryptMessage, decryptMessage, generateIV } from './encryption';
import { getPublicKey } from '../firestore';

// chatId → derived AES session key
const sessionKeys = new Map<string, CryptoKey>();

// The current user's unlocked ECDH private key (set once after login).
let myPrivateKey: CryptoKey | null = null;
let myUid: string | null = null;

/**
 * Unlock and cache the current user's private key. Call once after login,
 * with the same password used at registration (keyStorage encrypts the key
 * at rest with a password-derived master key).
 *
 * If the key was stored without a password (dev fallback), pass undefined.
 */
export async function unlockPrivateKey(uid: string, password?: string): Promise<void> {
  myPrivateKey = await getStoredPrivateKey(uid, password);
  myUid = uid;
}

/** True once unlockPrivateKey has succeeded this session. */
export function isUnlocked(): boolean {
  return myPrivateKey !== null;
}

/** Clear all key material from memory (call on logout). */
export function lockSession(): void {
  sessionKeys.clear();
  myPrivateKey = null;
  myUid = null;
}

/**
 * Get (or derive + cache) the AES session key for a chat.
 * `peerUid` is the OTHER participant in a 1:1 chat.
 */
export async function getSessionKey(chatId: string, peerUid: string): Promise<CryptoKey> {
  const cached = sessionKeys.get(chatId);
  if (cached) return cached;

  if (!myPrivateKey) {
    throw new Error('Private key locked — call unlockPrivateKey() after login first.');
  }

  const peerPublicKeyBase64 = await getPublicKey(peerUid);
  if (!peerPublicKeyBase64) {
    throw new Error(`No public key found for user ${peerUid}. They may not have registered a key.`);
  }

  const peerPublicKey = await importPublicKey(peerPublicKeyBase64);
  const sessionKey = await performKeyExchange(myPrivateKey, peerPublicKey, chatId);

  sessionKeys.set(chatId, sessionKey);
  return sessionKey;
}

/**
 * Encrypt a plaintext message for a chat. Returns ciphertext + iv (base64).
 */
export async function encryptForChat(
  chatId: string,
  peerUid: string,
  plaintext: string,
): Promise<{ ciphertext: string; iv: string }> {
  const key = await getSessionKey(chatId, peerUid);
  const iv = generateIV();
  return encryptMessage(plaintext, key, iv);
}

/**
 * Decrypt a stored message. Returns the plaintext, or a fallback marker if
 * decryption fails (wrong key, corrupt data) so the UI never crashes.
 */
export async function decryptForChat(
  chatId: string,
  peerUid: string,
  ciphertext: string,
  iv: string,
): Promise<string> {
  try {
    const key = await getSessionKey(chatId, peerUid);
    return await decryptMessage(ciphertext, iv, key);
  } catch (err) {
    console.error('decryptForChat failed', { chatId, err });
    return '🔒 Unable to decrypt';
  }
}

/** Drop a cached session key (e.g. if the peer rotated their key). */
export function invalidateSession(chatId: string): void {
  sessionKeys.delete(chatId);
}

export function getMyUid(): string | null {
  return myUid;
}
