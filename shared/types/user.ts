// User types
export interface User {
  uid: string;
  username: string;
  email: string;
  photoURL?: string;
  bio?: string;
  publicKey: string; // Base64-encoded ECDH P-384 public key
  privacySettings: PrivacySettings;
  friends: string[]; // Array of friend UIDs
  blocked: string[];
  online: boolean;
  lastSeen: Date;
  createdAt: Date;
  deviceFingerprint?: string;
}

export interface PrivacySettings {
  searchVisibility: 'everyone' | 'friends' | 'nobody';
  friendRequestsFrom: 'everyone' | 'friends-of-friends' | 'nobody';
  profilePhotoVisibility: 'everyone' | 'friends' | 'nobody';
  lastSeenVisibility: 'everyone' | 'friends' | 'nobody';
  onlineStatusVisibility: 'everyone' | 'friends' | 'nobody';
  bioVisibility: 'everyone' | 'friends' | 'nobody';
}

export interface UserProfile extends User {
  mutualFriends?: number;
  isFriend?: boolean;
  hasBlocked?: boolean;
  isBlockedBy?: boolean;
}
