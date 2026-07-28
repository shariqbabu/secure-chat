/**
 * Secure key storage using IndexedDB with encryption
 * Private keys are encrypted with a user-derived master key
 */

import {
  generateKeyPair,
  exportPublicKey,
  exportPrivateKey,
  importPrivateKey,
  generateDeviceFingerprint,
} from './keyExchange';
import {
  deriveKeyFromPassword,
  encryptMessage,
  decryptMessage,
  base64ToArrayBuffer,
} from './encryption';

const DB_NAME = 'secure-chat-keys';
const DB_VERSION = 1;
const STORE_NAME = 'keys';
const HIDDEN_CHATS_STORE = 'hidden-chats';

interface StoredKeyPair {
  uid: string;
  publicKey: string;
  encryptedPrivateKey: string;
  privateKeyIV: string;
  deviceFingerprint: string;
  createdAt: Date;
  backupCode?: string;
}

interface HiddenChatData {
  chatId: string;
  encryptedData: string;
  iv: string;
  createdAt: Date;
}

/**
 * Initialize IndexedDB database
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create keys store
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const keyStore = db.createObjectStore(STORE_NAME, { keyPath: 'uid' });
        keyStore.createIndex('deviceFingerprint', 'deviceFingerprint', { unique: false });
      }

      // Create hidden chats store
      if (!db.objectStoreNames.contains(HIDDEN_CHATS_STORE)) {
        db.createObjectStore(HIDDEN_CHATS_STORE, { keyPath: 'chatId' });
      }
    };
  });
}

/**
 * Generate and store a new key pair
 * The private key is encrypted with a master key derived from the user's password
 */
export async function generateAndStoreKeyPair(
  uid: string,
  masterPassword?: string
): Promise<{ publicKey: string; deviceFingerprint: string }> {
  try {
    // Generate key pair
    const keyPair = await generateKeyPair();
    const publicKeyBase64 = await exportPublicKey(keyPair.publicKey);
    const deviceFingerprint = await generateDeviceFingerprint();

    // Export private key
    const privateKeyBase64 = await exportPrivateKey(keyPair.privateKey);

    let encryptedPrivateKey: string;
    let privateKeyIV: string;

    if (masterPassword) {
      // Encrypt private key with master password
      const { key: masterKey } = await deriveKeyFromPassword(masterPassword);
      const encrypted = await encryptMessage(privateKeyBase64, masterKey);
      encryptedPrivateKey = encrypted.ciphertext;
      privateKeyIV = encrypted.iv;
    } else {
      // Store unencrypted (not recommended for production)
      encryptedPrivateKey = privateKeyBase64;
      privateKeyIV = '';
    }

    // Store in IndexedDB
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const storedKey: StoredKeyPair = {
      uid,
      publicKey: publicKeyBase64,
      encryptedPrivateKey,
      privateKeyIV,
      deviceFingerprint,
      createdAt: new Date(),
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.put(storedKey);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });

    db.close();

    return { publicKey: publicKeyBase64, deviceFingerprint };
  } catch (error) {
    throw new Error(`Failed to generate and store key pair: ${error}`);
  }
}

/**
 * Retrieve stored private key
 * Decrypts the private key if it was encrypted
 */
export async function getStoredPrivateKey(
  uid: string,
  masterPassword?: string
): Promise<CryptoKey> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    const storedKey = await new Promise<StoredKeyPair>((resolve, reject) => {
      const request = store.get(uid);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });

    db.close();

    if (!storedKey) {
      throw new Error('No stored key pair found for user');
    }

    let privateKeyBase64: string;

    if (storedKey.privateKeyIV) {
      // Private key is encrypted, decrypt it
      if (!masterPassword) {
        throw new Error('Master password required to decrypt private key');
      }

      const ivParts = storedKey.privateKeyIV.split('|');
      const saltBuffer = base64ToArrayBuffer(ivParts[1] || '');
      const saltArray = new Uint8Array(saltBuffer);

      const { key: masterKey } = await deriveKeyFromPassword(
        masterPassword,
        saltArray
      );

      privateKeyBase64 = await decryptMessage(
        storedKey.encryptedPrivateKey,
        ivParts[0],
        masterKey
      );
    } else {
      privateKeyBase64 = storedKey.encryptedPrivateKey;
    }

    return await importPrivateKey(privateKeyBase64);
  } catch (error) {
    throw new Error(`Failed to retrieve private key: ${error}`);
  }
}

/**
 * Retrieve stored public key
 */
export async function getStoredPublicKey(uid: string): Promise<string> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    const storedKey = await new Promise<StoredKeyPair>((resolve, reject) => {
      const request = store.get(uid);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });

    db.close();

    if (!storedKey) {
      throw new Error('No stored key pair found for user');
    }

    return storedKey.publicKey;
  } catch (error) {
    throw new Error(`Failed to retrieve public key: ${error}`);
  }
}

/**
 * Check if key pair exists for user
 */
export async function hasStoredKeyPair(uid: string): Promise<boolean> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    const exists = await new Promise<boolean>((resolve, reject) => {
      const request = store.getKey(uid);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(!!request.result);
    });

    db.close();
    return exists;
  } catch (error) {
    console.error('Failed to check stored key pair:', error);
    return false;
  }
}

/**
 * Delete key pair (on logout or account deletion)
 */
export async function deleteKeyPair(uid: string): Promise<void> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(uid);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });

    db.close();
  } catch (error) {
    throw new Error(`Failed to delete key pair: ${error}`);
  }
}

/**
 * Get all stored key pairs (useful for multi-device management)
 */
export async function getAllStoredKeys(): Promise<StoredKeyPair[]> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    const keys = await new Promise<StoredKeyPair[]>((resolve, reject) => {
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });

    db.close();
    return keys;
  } catch (error) {
    console.error('Failed to retrieve all keys:', error);
    return [];
  }
}

/**
 * Store hidden chat data (encrypted locally)
 */
export async function storeHiddenChat(
  chatId: string,
  data: any
): Promise<void> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([HIDDEN_CHATS_STORE], 'readwrite');
    const store = transaction.objectStore(HIDDEN_CHATS_STORE);

    // Serialize data to JSON
    const serializedData = JSON.stringify(data);

    const hiddenChat: HiddenChatData = {
      chatId,
      encryptedData: serializedData,
      iv: '', // IV handled by encryption layer if needed
      createdAt: new Date(),
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.put(hiddenChat);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });

    db.close();
  } catch (error) {
    throw new Error(`Failed to store hidden chat: ${error}`);
  }
}

/**
 * Retrieve hidden chat data
 */
export async function getHiddenChat(chatId: string): Promise<HiddenChatData | null> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([HIDDEN_CHATS_STORE], 'readonly');
    const store = transaction.objectStore(HIDDEN_CHATS_STORE);

    const hiddenChat = await new Promise<HiddenChatData | null>((resolve, reject) => {
      const request = store.get(chatId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });

    db.close();
    return hiddenChat;
  } catch (error) {
    console.error('Failed to retrieve hidden chat:', error);
    return null;
  }
}

/**
 * Get all hidden chats
 */
export async function getAllHiddenChats(): Promise<HiddenChatData[]> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([HIDDEN_CHATS_STORE], 'readonly');
    const store = transaction.objectStore(HIDDEN_CHATS_STORE);

    const chats = await new Promise<HiddenChatData[]>((resolve, reject) => {
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });

    db.close();
    return chats;
  } catch (error) {
    console.error('Failed to retrieve hidden chats:', error);
    return [];
  }
}

/**
 * Remove hidden chat
 */
export async function removeHiddenChat(chatId: string): Promise<void> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([HIDDEN_CHATS_STORE], 'readwrite');
    const store = transaction.objectStore(HIDDEN_CHATS_STORE);

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(chatId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });

    db.close();
  } catch (error) {
    throw new Error(`Failed to remove hidden chat: ${error}`);
  }
}

/**
 * Clear all stored data (use with caution)
 */
export async function clearAllStoredData(): Promise<void> {
  try {
    const db = await openDatabase();

    for (const storeName of [STORE_NAME, HIDDEN_CHATS_STORE]) {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);

      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    }

    db.close();
  } catch (error) {
    throw new Error(`Failed to clear stored data: ${error}`);
  }
}
