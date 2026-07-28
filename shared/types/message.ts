// Friend request types
export interface FriendRequest {
  id: string;
  senderUid: string;
  receiverUid: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

export interface FriendRequestWithUser extends FriendRequest {
  sender?: {
    uid: string;
    username: string;
    photoURL?: string;
  };
  receiver?: {
    uid: string;
    username: string;
    photoURL?: string;
  };
}

// Block and Report types
export interface BlockedUser {
  uid: string;
  blockedBy: string;
  blockedAt: Date;
}

export interface ReportedUser {
  id: string;
  reportedUid: string;
  reportedBy: string;
  reason: string;
  details?: string;
  createdAt: Date;
}
