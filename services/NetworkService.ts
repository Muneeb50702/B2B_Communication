import { Platform } from "react-native";
import { NETWORK_CONFIG } from "@/constants/network";
import type {
  User,
  NetworkPacket,
  NetworkPacketType,
  Message,
} from "@/types";

type MessageHandler = (packet: NetworkPacket) => void;

class NetworkService {
  private currentUser: User | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private discoveryInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isHost: boolean = false;
  private webSockets: Map<string, WebSocket> = new Map();

  async initialize(user: User, isHost: boolean) {
    console.log("[NetworkService] Initializing...", { user, isHost });
    this.currentUser = user;
    this.isHost = isHost;

    if (Platform.OS === "web") {
      await this.initializeWebMode();
    } else {
      await this.initializeNativeMode();
    }
  }

  private async initializeWebMode() {
    console.log("[NetworkService] Running in WEB mode - Limited functionality");
    console.log("[NetworkService] For full P2P features, use native build");
    
    this.startHeartbeat();
  }

  private async initializeNativeMode() {
    console.log("[NetworkService] Running in NATIVE mode");
    
    try {
      // expo-network removed - not compatible with web
      const ipAddress = "0.0.0.0"; // Placeholder, would need native module
      console.log("[NetworkService] Device IP:", ipAddress);

      if (this.currentUser) {
        this.currentUser.ipAddress = ipAddress;
      }

      console.log("[NetworkService] Native UDP/TCP requires react-native-udp and react-native-tcp-socket");
      console.log("[NetworkService] These are not available in Expo Go");
      console.log("[NetworkService] You need to create a development build");

      this.startHeartbeat();
    } catch (error) {
      console.error("[NetworkService] Failed to initialize native mode:", error);
    }
  }

  onMessage(handler: MessageHandler) {
    console.log("[NetworkService] Registering message handler");
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  private notifyHandlers(packet: NetworkPacket) {
    console.log("[NetworkService] Notifying handlers:", packet.type);
    this.messageHandlers.forEach((handler) => handler(packet));
  }

  sendDiscovery() {
    if (!this.currentUser) return;

    console.log("[NetworkService] Sending discovery broadcast");
    
    const packet: NetworkPacket = {
      type: "DISCOVERY",
      from: this.currentUser,
      data: { isHost: this.isHost },
      timestamp: Date.now(),
    };

    if (Platform.OS === "web") {
      console.log("[NetworkService] Web: Discovery via WebSocket server needed");
    } else {
      console.log("[NetworkService] Native: UDP broadcast not available in Expo Go");
    }
  }

  sendFriendRequest(toUser: User) {
    if (!this.currentUser) return;

    console.log("[NetworkService] Sending friend request to:", toUser.username);

    const packet: NetworkPacket = {
      type: "FRIEND_REQUEST",
      from: this.currentUser,
      to: toUser.uid,
      data: {},
      timestamp: Date.now(),
    };

    this.sendPacket(toUser, packet);
  }

  acceptFriendRequest(toUser: User) {
    if (!this.currentUser) return;

    console.log("[NetworkService] Accepting friend request from:", toUser.username);

    const packet: NetworkPacket = {
      type: "FRIEND_ACCEPT",
      from: this.currentUser,
      to: toUser.uid,
      data: {},
      timestamp: Date.now(),
    };

    this.sendPacket(toUser, packet);
  }

  rejectFriendRequest(toUser: User) {
    if (!this.currentUser) return;

    console.log("[NetworkService] Rejecting friend request from:", toUser.username);

    const packet: NetworkPacket = {
      type: "FRIEND_REJECT",
      from: this.currentUser,
      to: toUser.uid,
      data: {},
      timestamp: Date.now(),
    };

    this.sendPacket(toUser, packet);
  }

  sendMessage(toUser: User, message: Message) {
    if (!this.currentUser) return;

    console.log("[NetworkService] Sending message to:", toUser.username);

    const packet: NetworkPacket = {
      type: "MESSAGE",
      from: this.currentUser,
      to: toUser.uid,
      data: { message },
      timestamp: Date.now(),
    };

    this.sendPacket(toUser, packet);
  }

  private sendPacket(toUser: User, packet: NetworkPacket) {
    if (Platform.OS === "web") {
      console.log("[NetworkService] Web: Would send packet via WebSocket:", packet.type);
      
      setTimeout(() => {
        console.log("[NetworkService] Web: Simulating packet sent");
      }, 100);
    } else {
      console.log("[NetworkService] Native: Would send packet via TCP:", packet.type);
      console.log("[NetworkService] Native: TCP socket requires react-native-tcp-socket");
    }
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (!this.currentUser) return;

      console.log("[NetworkService] Heartbeat");

      const packet: NetworkPacket = {
        type: "HEARTBEAT",
        from: this.currentUser,
        data: {},
        timestamp: Date.now(),
      };

    }, NETWORK_CONFIG.HEARTBEAT_INTERVAL);
  }

  startDiscovery() {
    console.log("[NetworkService] Starting discovery broadcasts");

    this.sendDiscovery();

    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
    }

    this.discoveryInterval = setInterval(() => {
      this.sendDiscovery();
    }, NETWORK_CONFIG.DISCOVERY_INTERVAL);
  }

  stopDiscovery() {
    console.log("[NetworkService] Stopping discovery broadcasts");

    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }
  }

  shutdown() {
    console.log("[NetworkService] Shutting down");

    this.stopDiscovery();

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    this.webSockets.forEach((ws) => {
      ws.close();
    });
    this.webSockets.clear();

    this.messageHandlers.clear();
    this.currentUser = null;
  }

  getConnectionStatus() {
    return {
      initialized: this.currentUser !== null,
      isHost: this.isHost,
      platform: Platform.OS,
      requiresNativeBuild: Platform.OS !== "web",
    };
  }
}

export default new NetworkService();
