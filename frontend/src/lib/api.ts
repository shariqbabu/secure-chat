/**
 * API client for Cloudflare Worker backend
 */

import type {
  ApiResponse,
  VerifyTokenRequest,
  VerifyTokenResponse,
  SearchUsersRequest,
  SendFriendRequestRequest,
  RespondToFriendRequestRequest,
  BlockUserRequest,
  CreateChatRequest,
  SendMessageRequest,
  GetMessagesRequest,
  MarkAsReadRequest,
  RegisterPublicKeyRequest,
  GetPublicKeyResponse,
} from '@shared/types/api';
import type { User, UserProfile } from '@shared/types/user';
import type { Chat, Message } from '@shared/types/chat';
import type { FriendRequest } from '@shared/types/message';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  clearToken() {
    this.token = null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.token && { Authorization: `Bearer ${this.token}` }),
      ...options.headers,
    };

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Request failed');
      }

      return data;
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  // Auth APIs
  async verifyToken(request: VerifyTokenRequest): Promise<ApiResponse<VerifyTokenResponse>> {
    return this.request<VerifyTokenResponse>('/auth/verify', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // User APIs
  async searchUsers(request: SearchUsersRequest): Promise<ApiResponse<UserProfile[]>> {
    const query = new URLSearchParams({
      query: request.query,
      ...(request.limit && { limit: request.limit.toString() }),
    });
    return this.request<UserProfile[]>(`/users/search?${query}`);
  }

  async getUser(uid: string): Promise<ApiResponse<UserProfile>> {
    return this.request<UserProfile>(`/users/${uid}`);
  }

  async updateProfile(data: FormData): Promise<ApiResponse<User>> {
    return this.request<User>('/users/profile', {
      method: 'PUT',
      body: data,
      headers: {}, // Let browser set Content-Type for FormData
    });
  }

  async updatePrivacySettings(settings: Partial<User['privacySettings']>): Promise<ApiResponse<User>> {
    return this.request<User>('/users/privacy', {
      method: 'PUT',
      body: JSON.stringify({ privacySettings: settings }),
    });
  }

  // Friend APIs
  async sendFriendRequest(request: SendFriendRequestRequest): Promise<ApiResponse<FriendRequest>> {
    return this.request<FriendRequest>('/friend/request', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async respondToFriendRequest(
    request: RespondToFriendRequestRequest
  ): Promise<ApiResponse<void>> {
    return this.request<void>('/friend/respond', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getFriendRequests(): Promise<ApiResponse<FriendRequest[]>> {
    return this.request<FriendRequest[]>('/friend/requests');
  }

  async getFriends(): Promise<ApiResponse<UserProfile[]>> {
    return this.request<UserProfile[]>('/friend/list');
  }

  async removeFriend(uid: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/friend/${uid}`, {
      method: 'DELETE',
    });
  }

  async blockUser(request: BlockUserRequest): Promise<ApiResponse<void>> {
    return this.request<void>('/friend/block', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async unblockUser(uid: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/friend/unblock/${uid}`, {
      method: 'POST',
    });
  }

  async reportUser(uid: string, reason: string, details?: string): Promise<ApiResponse<void>> {
    return this.request<void>('/users/report', {
      method: 'POST',
      body: JSON.stringify({ userUid: uid, reason, details }),
    });
  }

  // Chat APIs
  async createChat(request: CreateChatRequest): Promise<ApiResponse<Chat>> {
    return this.request<Chat>('/chat/create', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getChats(): Promise<ApiResponse<Chat[]>> {
    return this.request<Chat[]>('/chat/list');
  }

  async getMessages(request: GetMessagesRequest): Promise<ApiResponse<Message[]>> {
    const query = new URLSearchParams({
      chatId: request.chatId,
      ...(request.limit && { limit: request.limit.toString() }),
      ...(request.before && { before: request.before }),
    });
    return this.request<Message[]>(`/messages?${query}`);
  }

  async sendMessage(request: SendMessageRequest): Promise<ApiResponse<Message>> {
    return this.request<Message>('/message/send', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async markAsRead(request: MarkAsReadRequest): Promise<ApiResponse<void>> {
    return this.request<void>('/message/read', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async deleteMessage(messageId: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/message/${messageId}`, {
      method: 'DELETE',
    });
  }

  // Key APIs
  async registerPublicKey(request: RegisterPublicKeyRequest): Promise<ApiResponse<void>> {
    return this.request<void>('/keys/register', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getPublicKey(uid: string): Promise<ApiResponse<GetPublicKeyResponse>> {
    return this.request<GetPublicKeyResponse>(`/keys/${uid}`);
  }

  // File upload API
  async uploadFile(file: File, chatId: string): Promise<ApiResponse<{ url: string }>> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('chatId', chatId);

    return this.request<{ url: string }>('/upload', {
      method: 'POST',
      body: formData,
      headers: {}, // Let browser set Content-Type for FormData
    });
  }
}

export const apiClient = new ApiClient();
export default apiClient;
