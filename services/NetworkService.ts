import { Platform } from "react-native";
import * as Network from "expo-network";
import { NETWORK_CONFIG } from "@/constants/network";
import UDPDiscovery from "./UDPDiscovery";
import TCPMessaging from "./TCPMessaging";
import FileTransferService, { FileTransfer } from "./FileTransferService";
import type {
  User,
  NetworkPacket,
  NetworkPacketType,
  Message,
} from "@/types";

type MessageHandler = (packet: NetworkPacket) => void;
type UserDiscoveredHandler = (user: User) => void;
type FileTransferHandler = (transfer: FileTransfer) => void;

class NetworkService {
  private currentUser: User | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private userDiscoveredHandlers: Set<UserDiscoveredHandler> = new Set();
  private fileTransferHandlers: Set<FileTransferHandler> = new Set();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isHost: boolean = false;
  private isInitialized: boolean = false;

  async initialize(user: User, isHost: boolean) {
    console.log("[NetworkService] Initializing...", { user, isHost });
    this.currentUser = user;
    this.isHost = isHost;

    if (Platform.OS === "web") {
      await this.initializeWebMode();
    } else {
      await this.initializeNativeMode();
    }

    this.isInitialized = true;
  }

  private async initializeWebMode() {
    console.log("[NetworkService] Running in WEB mode - Limited functionality");
    console.log("[NetworkService] For full P2P features, use native build");
    
    this.startHeartbeat();
  }

  private async initializeNativeMode() {
    console.log("[NetworkService] Running in NATIVE mode");
    
    try {
      // Get device IP address
      const ipAddress = await Network.getIpAddressAsync();
      console.log("[NetworkService] Device IP:", ipAddress);

      if (this.currentUser) {
        this.currentUser.ipAddress = ipAddress;
      }

      // Initialize UDP Discovery
      await UDPDiscovery.initialize(this.currentUser!);
      UDPDiscovery.onUserDiscovered((user) => {
        console.log("[NetworkService] User discovered:", user.username);
        this.userDiscoveredHandlers.forEach(handler => handler(user));
      });

      // Initialize TCP Messaging
      await TCPMessaging.startServer(this.currentUser!);
      TCPMessaging.onPacket((packet) => {
        console.log("[NetworkService] Packet received:", packet.type);
        this.messageHandlers.forEach(handler => handler(packet));
      });

      // Initialize File Transfer Service
      await FileTransferService.startServer(this.currentUser!);
      FileTransferService.onTransferUpdate((transfer) => {
        console.log("[NetworkService] File transfer update:", transfer.status);
        this.fileTransferHandlers.forEach(handler => handler(transfer));
      });

      // Start broadcasting our presence
      UDPDiscovery.startBroadcasting();

      this.startHeartbeat();

      console.log("[NetworkService] Native mode initialized successfully");
    } catch (error) {
      console.error("[NetworkService] Failed to initialize native mode:", error);
      throw error;
    }
  }

  onMessage(handler: MessageHandler) {
    console.log("[NetworkService] Registering message handler");
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  onUserDiscovered(handler: UserDiscoveredHandler) {
    console.log("[NetworkService] Registering user discovered handler");
    this.userDiscoveredHandlers.add(handler);
    return () => {
      this.userDiscoveredHandlers.delete(handler);
    };
  }

  onFileTransfer(handler: FileTransferHandler) {
    console.log("[NetworkService] Registering file transfer handler");
    this.fileTransferHandlers.add(handler);
    return () => {
      this.fileTransferHandlers.delete(handler);
    };
  }

  sendDiscovery() {
    if (Platform.OS === "web") {
      console.log("[NetworkService] Web: Discovery not available");
      return;
    }
    UDPDiscovery.startBroadcasting();
  }

  async sendFriendRequest(toUser: User) {
    if (!this.currentUser) return;

    console.log("[NetworkService] Sending friend request to:", toUser.username);

    if (Platform.OS === "web") {
      console.log("[NetworkService] Web: Friend request not available");
      return;
    }

    await TCPMessaging.sendFriendRequest(toUser);
  }

  async acceptFriendRequest(toUser: User) {
    if (!this.currentUser) return;

    console.log("[NetworkService] Accepting friend request from:", toUser.username);

    if (Platform.OS === "web") {
      console.log("[NetworkService] Web: Friend accept not available");
      return;
    }

    await TCPMessaging.acceptFriendRequest(toUser);
  }

  async rejectFriendRequest(toUser: User) {
    if (!this.currentUser) return;

    console.log("[NetworkService] Rejecting friend request from:", toUser.username);

    if (Platform.OS === "web") {
      console.log("[NetworkService] Web: Friend reject not available");
      return;
    }

    await TCPMessaging.rejectFriendRequest(toUser);
  }

  async sendMessage(toUser: User, message: Message) {
    if (!this.currentUser) return;

    console.log("[NetworkService] Sending message to:", toUser.username);

    if (Platform.OS === "web") {
      console.log("[NetworkService] Web: Messaging not available");
      return;
    }

    await TCPMessaging.sendMessage(toUser, message);
  }

  async sendFile(toUser: User, fileUri: string, fileName: string, fileType: string): Promise<string | null> {
    if (!this.currentUser) return null;

    console.log("[NetworkService] Sending file to:", toUser.username);

    if (Platform.OS === "web") {
      console.log("[NetworkService] Web: File transfer not available");
      return null;
    }

    return await FileTransferService.sendFile(toUser, fileUri, fileName, fileType);
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (!this.currentUser) return;

      console.log("[NetworkService] Heartbeat");

      if (Platform.OS !== "web") {
        // Send heartbeat via UDP to keep presence alive
        UDPDiscovery.broadcastDiscovery();
      }
    }, NETWORK_CONFIG.HEARTBEAT_INTERVAL);
  }

  startDiscovery() {
    console.log("[NetworkService] Starting discovery broadcasts");

    if (Platform.OS === "web") {
      console.log("[NetworkService] Web: Discovery not available");
      return;
    }

    UDPDiscovery.startBroadcasting();
  }

  stopDiscovery() {
    console.log("[NetworkService] Stopping discovery broadcasts");

    if (Platform.OS === "web") {
      return;
    }

    UDPDiscovery.stopBroadcasting();
  }

  shutdown() {
    console.log("[NetworkService] Shutting down");

    this.stopDiscovery();

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (Platform.OS !== "web") {
      UDPDiscovery.shutdown();
      TCPMessaging.shutdown();
      FileTransferService.shutdown();
    }

    this.messageHandlers.clear();
    this.userDiscoveredHandlers.clear();
    this.fileTransferHandlers.clear();
    this.currentUser = null;
    this.isInitialized = false;
  }

  getConnectionStatus() {
    return {
      initialized: this.isInitialized,
      isHost: this.isHost,
      platform: Platform.OS,
      requiresNativeBuild: Platform.OS !== "web",
      tcpStatus: Platform.OS !== "web" ? TCPMessaging.getConnectionStatus() : null,
    };
  }
}

export default new NetworkService();
