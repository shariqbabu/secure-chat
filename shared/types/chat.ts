// Chat and Message types
import { Timestamp } from 'firebase/firestore';

export interface Chat {
  chatId: string;
  participants: string[]; // UIDs of participants
  encryptedMetadata?: string; // Base64, for hidden chats
  lastMessage?: MessageWithDecrypted;
  lastMessageTimestamp?: Timestamp;
  updatedAt: Timestamp;
  isHidden?: boolean;
  unreadCount?: number;
}

export interface Message {
  messageId: string;
  chatId: string;
  senderUid: string;
  encryptedContent: string; // Base64-encoded encrypted message
  iv: string; // Base64-encoded initialization vector
  timestamp: Timestamp;
  status: 'sent' | 'delivered' | 'read';
  replyTo?: string; // messageId of replied message
  type: 'text' | 'image' | 'file' | 'voice';
  metadata?: {
    fileName?: string;
    fileSize?: string;
    mimeType?: string;
    duration?: string; // voice duration mm:ss
    url?: string; // for images/files
    voiceDuration?: number; // in seconds
  };
  deviceFingerprint?: string;
}

export interface MessageWithDecrypted extends Message {
  decryptedContent: string;
  senderPublicKey?: string;
}

export interface TypingIndicator {
  chatId: string;
  senderUid: string;
  isTyping: boolean;
  timestamp: Timestamp;
}

export interface MessageDeliveryReceipt {
  messageId: string;
  chatId: string;
  recipientUid: string;
  status: 'delivered' | 'read';
  timestamp: Timestamp;
}
