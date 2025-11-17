import { Platform } from 'react-native';
import WiFiManager from './WiFiManager';
import UDPDiscovery from './UDPDiscovery';
import TCPMessaging from './TCPMessaging';
import type { User, NetworkPacket, Message } from '@/types';

type MessageHandler = (packet: NetworkPacket) => void;
type UserDiscoveryHandler = (user: User) => void;

class NetworkService {
  private currentUser: User | null = null;
  private isHost: boolean = false;
  private isInitialized: boolean = false;
  private messageHandlers: Set<MessageHandler> = new Set();
  private userDiscoveryHandlers: Set<UserDiscoveryHandler> = new Set();
  private cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize the network service
   */
  async initialize(user: User, asHost: boolean): Promise<boolean> {
    try {
      console.log('[NetworkService] Initializing...', { user: user.username, asHost });
      
      this.currentUser = user;
      this.isHost = asHost;

      if (Platform.OS === 'web') {
        return await this.initializeWebMode();
      } else {
        return await this.initializeNativeMode();
      }
    } catch (error) {
      console.error('[NetworkService] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Initialize web mode (limited functionality)
   */
  private async initializeWebMode(): Promise<boolean> {
    console.log('[NetworkService] Running in WEB mode - Limited functionality');
    console.log('[NetworkService] For full P2P features, use Android app');
    this.isInitialized = true;
    return true;
  }

  /**
   * Initialize native mode (full P2P functionality)
   */
  private async initializeNativeMode(): Promise<boolean> {
    try {
      if (!this.currentUser) return false;

      // Step 1: Setup WiFi (if host)
      if (this.isHost) {
        console.log('[NetworkService] Setting up WiFi hotspot...');
        const wifiReady = await WiFiManager.requestPermissions();
        if (!wifiReady) {
          console.warn('[NetworkService] WiFi permissions failed - continuing anyway');
        }
      }

      // Step 2: Initialize UDP Discovery
      console.log('[NetworkService] Initializing UDP discovery...');
      const udpReady = await UDPDiscovery.initialize(this.currentUser, this.isHost);
      if (!udpReady) {
        console.error('[NetworkService] UDP discovery failed');
        return false;
      }

      // Listen for discovered users
      UDPDiscovery.onUserDiscovered((user) => {
        console.log('[NetworkService] User discovered:', user.username);
        this.notifyUserDiscovery(user);
      });

      // Step 3: Initialize TCP Messaging
      console.log('[NetworkService] Initializing TCP messaging...');
      const tcpReady = await TCPMessaging.initialize(this.currentUser);
      if (!tcpReady) {
        console.error('[NetworkService] TCP messaging failed');
        return false;
      }

      // Listen for incoming messages
      TCPMessaging.onMessage((packet) => {
        console.log('[NetworkService] Packet received:', packet.type);
        this.notifyMessageHandlers(packet);
      });

      // Step 4: Start discovery broadcasts
      this.startDiscovery();

      // Step 5: Start cleanup interval
      this.startCleanupInterval();

      this.isInitialized = true;
      console.log('[NetworkService] Initialization complete!');
      return true;
    } catch (error) {
      console.error('[NetworkService] Native initialization failed:', error);
      return false;
    }
  }

  /**
   * Start broadcasting discovery
   */
  startDiscovery(): void {
    if (Platform.OS !== 'web' && this.isInitialized) {
      console.log('[NetworkService] Starting discovery broadcasts');
      UDPDiscovery.startBroadcasting();
    }
  }

  /**
   * Stop broadcasting discovery
   */
  stopDiscovery(): void {
    if (Platform.OS !== 'web') {
      console.log('[NetworkService] Stopping discovery broadcasts');
      UDPDiscovery.stopBroadcasting();
    }
  }

  /**
   * Start cleanup interval for stale users
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      if (Platform.OS !== 'web') {
        UDPDiscovery.cleanupStaleUsers();
      }
    }, 30000); // Clean up every 30 seconds
  }

  /**
   * Get list of discovered users
   */
  getDiscoveredUsers(): User[] {
    if (Platform.OS === 'web') {
      return [];
    }
    return UDPDiscovery.getDiscoveredUsers();
  }

  /**
   * Send friend request
   */
  async sendFriendRequest(toUser: User): Promise<boolean> {
    if (Platform.OS === 'web') {
      console.log('[NetworkService] Friend requests not available on web');
      return false;
    }
    return TCPMessaging.sendFriendRequest(toUser);
  }

  /**
   * Accept friend request
   */
  async acceptFriendRequest(toUser: User): Promise<boolean> {
    if (Platform.OS === 'web') {
      return false;
    }
    return TCPMessaging.acceptFriendRequest(toUser);
  }

  /**
   * Reject friend request
   */
  async rejectFriendRequest(toUser: User): Promise<boolean> {
    if (Platform.OS === 'web') {
      return false;
    }
    return TCPMessaging.rejectFriendRequest(toUser);
  }

  /**
   * Send message to user
   */
  async sendMessage(toUser: User, message: Message): Promise<boolean> {
    if (Platform.OS === 'web') {
      console.log('[NetworkService] Messaging not available on web');
      return false;
    }
    return TCPMessaging.sendMessage(toUser, message);
  }

  /**
   * Check if connected to a user
   */
  isConnectedTo(uid: string): boolean {
    if (Platform.OS === 'web') {
      return false;
    }
    return TCPMessaging.isConnected(uid);
  }

  /**
   * Get active connections
   */
  getConnections(): User[] {
    if (Platform.OS === 'web') {
      return [];
    }
    return TCPMessaging.getConnections();
  }

  /**
   * Register message handler
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  /**
   * Register user discovery handler
   */
  onUserDiscovered(handler: UserDiscoveryHandler): () => void {
    this.userDiscoveryHandlers.add(handler);
    return () => {
      this.userDiscoveryHandlers.delete(handler);
    };
  }

  /**
   * Notify message handlers
   */
  private notifyMessageHandlers(packet: NetworkPacket): void {
    this.messageHandlers.forEach(handler => handler(packet));
  }

  /**
   * Notify user discovery handlers
   */
  private notifyUserDiscovery(user: User): void {
    this.userDiscoveryHandlers.forEach(handler => handler(user));
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      isHost: this.isHost,
      platform: Platform.OS,
      user: this.currentUser,
      discoveredUsers: this.getDiscoveredUsers().length,
      activeConnections: this.getConnections().length,
    };
  }

  /**
   * Shutdown service
   */
  shutdown(): void {
    console.log('[NetworkService] Shutting down...');

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (Platform.OS !== 'web') {
      UDPDiscovery.shutdown();
      TCPMessaging.shutdown();
    }

    this.messageHandlers.clear();
    this.userDiscoveryHandlers.clear();
    this.currentUser = null;
    this.isInitialized = false;
  }
}

export default new NetworkService();
