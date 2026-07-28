// API Request and Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Auth API
export interface VerifyTokenRequest {
  firebaseToken: string;
  publicKey: string;
  deviceFingerprint: string;
}

export interface VerifyTokenResponse {
  jwt: string;
  user: {
    uid: string;
    username: string;
    email: string;
  };
}

// User API
export interface SearchUsersRequest {
  query: string;
  limit?: number;
}

export interface UpdateProfileRequest {
  username?: string;
  bio?: string;
  photoURL?: string;
}

export interface UpdatePrivacySettingsRequest {
  privacySettings: Partial<import('./user').PrivacySettings>;
}

// Friend API
export interface SendFriendRequestRequest {
  receiverUid: string;
}

export interface RespondToFriendRequestRequest {
  requestId: string;
  accept: boolean;
}

export interface BlockUserRequest {
  userUid: string;
}

export interface ReportUserRequest {
  userUid: string;
  reason: string;
  details?: string;
}

// Chat API
export interface CreateChatRequest {
  participantUid: string;
}

export interface SendMessageRequest {
  chatId: string;
  encryptedContent: string;
  iv: string;
  type: 'text' | 'image' | 'file' | 'voice';
  replyTo?: string;
  metadata?: {
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
  };
}

export interface GetMessagesRequest {
  chatId: string;
  limit?: number;
  before?: string; // messageId for pagination
}

export interface MarkAsReadRequest {
  chatId: string;
  messageIds: string[];
}

// Key API
export interface RegisterPublicKeyRequest {
  publicKey: string;
  deviceFingerprint: string;
}

export interface GetPublicKeyResponse {
  uid: string;
  publicKey: string;
}

// WebSocket Message types
export type WebSocketMessageType =
  | 'message'
  | 'typing'
  | 'read_receipt'
  | 'delivery_receipt'
  | 'online_status'
  | 'friend_request'
  | 'ping'
  | 'pong';

export interface WebSocketMessage {
  type: WebSocketMessageType;
  payload: unknown;
  timestamp: Date;
}

export interface WSMessagePayload {
  chatId: string;
  messageId: string;
  senderUid: string;
  encryptedContent: string;
  iv: string;
  type: 'text' | 'image' | 'file' | 'voice';
  replyTo?: string;
  timestamp: Date;
}

export interface WSTypingPayload {
  chatId: string;
  senderUid: string;
  isTyping: boolean;
}

export interface WSReadReceiptPayload {
  chatId: string;
  messageIds: string[];
  readerUid: string;
}

export interface WSOnlineStatusPayload {
  uid: string;
  online: boolean;
  lastSeen?: Date;
}

export interface WSFriendRequestPayload {
  requestId: string;
  senderUid: string;
  receiverUid: string;
}
