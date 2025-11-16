export type UserStatus = "online" | "offline";

export interface User {
  uid: string;
  username: string;
  ipAddress: string;
  port: number;
  status: UserStatus;
  lastSeen: number;
}

export interface FriendRequest {
  id: string;
  fromUser: User;
  timestamp: number;
  status: "pending" | "accepted" | "rejected";
}

export interface Message {
  id: string;
  fromUid: string;
  toUid: string;
  content: string;
  timestamp: number;
  type: "text" | "file";
  fileInfo?: FileInfo;
  status: "sending" | "sent" | "delivered" | "failed";
}

export interface FileInfo {
  name: string;
  size: number;
  mimeType: string;
  uri: string;
}

export interface Conversation {
  uid: string;
  user: User;
  messages: Message[];
  unreadCount: number;
  lastMessage?: Message;
}

export type NetworkPacketType =
  | "DISCOVERY"
  | "DISCOVERY_RESPONSE"
  | "FRIEND_REQUEST"
  | "FRIEND_ACCEPT"
  | "FRIEND_REJECT"
  | "MESSAGE"
  | "FILE_TRANSFER_START"
  | "FILE_TRANSFER_CHUNK"
  | "FILE_TRANSFER_COMPLETE"
  | "HEARTBEAT"
  | "USER_OFFLINE";

export interface NetworkPacket {
  type: NetworkPacketType;
  from: User;
  to?: string;
  data: any;
  timestamp: number;
}
