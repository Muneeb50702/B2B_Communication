import dgram from 'react-native-udp';
import { Platform } from 'react-native';
import type { User } from '@/types';

const UDP_PORT = 3001;
const BROADCAST_INTERVAL = 5000; // 5 seconds
const DISCOVERY_TIMEOUT = 10000; // 10 seconds

export type DiscoveryCallback = (user: User) => void;

class UDPDiscoveryService {
  private socket: any = null;
  private broadcastInterval: NodeJS.Timeout | null = null;
  private discoveredUsers: Map<string, User> = new Map();
  private callbacks: Set<DiscoveryCallback> = new Set();
  private currentUser: User | null = null;
  private isHost: boolean = false;

  /**
   * Initialize UDP discovery
   */
  async initialize(user: User, asHost: boolean): Promise<boolean> {
    try {
      console.log('[UDPDiscovery] Initializing...', { user: user.username, asHost });
      
      this.currentUser = user;
      this.isHost = asHost;
      
      // Create UDP socket
      this.socket = dgram.createSocket({
        type: 'udp4',
        reusePort: true,
      });

      // Handle incoming messages
      this.socket.on('message', (msg: Buffer, rinfo: any) => {
        this.handleDiscoveryMessage(msg, rinfo);
      });

      // Handle errors
      this.socket.on('error', (err: Error) => {
        console.error('[UDPDiscovery] Socket error:', err);
      });

      // Bind socket
      await new Promise<void>((resolve, reject) => {
        this.socket!.bind(UDP_PORT, (err?: Error) => {
          if (err) {
            console.error('[UDPDiscovery] Failed to bind:', err);
            reject(err);
          } else {
            console.log('[UDPDiscovery] Socket bound to port:', UDP_PORT);
            resolve();
          }
        });
      });

      // Enable broadcasting
      try {
        if (this.socket && this.socket._socket) {
          this.socket.setBroadcast(true);
          console.log('[UDPDiscovery] Broadcasting enabled');
        }
      } catch (error) {
        console.warn('[UDPDiscovery] Could not enable broadcast:', error);
      }

      console.log('[UDPDiscovery] Initialized successfully');
      return true;
    } catch (error) {
      console.error('[UDPDiscovery] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Start broadcasting presence
   */
  startBroadcasting(): void {
    if (!this.currentUser || !this.socket) {
      console.error('[UDPDiscovery] Cannot broadcast - not initialized');
      return;
    }

    console.log('[UDPDiscovery] Starting broadcast...');

    // Send initial broadcast
    this.sendDiscoveryBroadcast();

    // Set up interval for continuous broadcasting
    this.broadcastInterval = setInterval(() => {
      this.sendDiscoveryBroadcast();
    }, BROADCAST_INTERVAL);
  }

  /**
   * Stop broadcasting
   */
  stopBroadcasting(): void {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
      console.log('[UDPDiscovery] Broadcast stopped');
    }
  }

  /**
   * Send discovery broadcast
   */
  private sendDiscoveryBroadcast(): void {
    if (!this.socket || !this.currentUser) return;

    const message = JSON.stringify({
      type: 'DISCOVERY',
      user: this.currentUser,
      isHost: this.isHost,
      timestamp: Date.now(),
    });

    const buffer = Buffer.from(message);
    const broadcastAddress = '255.255.255.255';

    this.socket.send(
      buffer,
      0,
      buffer.length,
      UDP_PORT,
      broadcastAddress,
      (err?: Error) => {
        if (err) {
          console.error('[UDPDiscovery] Broadcast failed:', err);
        }
      }
    );
  }

  /**
   * Handle incoming discovery messages
   */
  private handleDiscoveryMessage(msg: Buffer, rinfo: any): void {
    try {
      const data = JSON.parse(msg.toString());
      
      if (data.type === 'DISCOVERY' && data.user) {
        const discoveredUser: User = {
          ...data.user,
          ipAddress: rinfo.address,
          lastSeen: Date.now(),
        };

        // Don't add ourselves
        if (discoveredUser.uid === this.currentUser?.uid) {
          return;
        }

        // Check if user already discovered
        const existing = this.discoveredUsers.get(discoveredUser.uid);
        
        if (!existing || existing.lastSeen < discoveredUser.lastSeen) {
          console.log('[UDPDiscovery] User discovered:', discoveredUser.username);
          this.discoveredUsers.set(discoveredUser.uid, discoveredUser);
          
          // Notify callbacks
          this.callbacks.forEach(callback => callback(discoveredUser));
        }
      } else if (data.type === 'DISCOVERY_RESPONSE' && data.user) {
        // Response to our broadcast
        const user: User = {
          ...data.user,
          ipAddress: rinfo.address,
          lastSeen: Date.now(),
        };

        if (user.uid !== this.currentUser?.uid) {
          console.log('[UDPDiscovery] Discovery response from:', user.username);
          this.discoveredUsers.set(user.uid, user);
          this.callbacks.forEach(callback => callback(user));
        }
      }
    } catch (error) {
      console.error('[UDPDiscovery] Failed to parse message:', error);
    }
  }

  /**
   * Send discovery response
   */
  sendDiscoveryResponse(toAddress: string): void {
    if (!this.socket || !this.currentUser) return;

    const message = JSON.stringify({
      type: 'DISCOVERY_RESPONSE',
      user: this.currentUser,
      isHost: this.isHost,
      timestamp: Date.now(),
    });

    const buffer = Buffer.from(message);

    this.socket.send(
      buffer,
      0,
      buffer.length,
      UDP_PORT,
      toAddress,
      (err?: Error) => {
        if (err) {
          console.error('[UDPDiscovery] Response failed:', err);
        }
      }
    );
  }

  /**
   * Register callback for discovered users
   */
  onUserDiscovered(callback: DiscoveryCallback): () => void {
    this.callbacks.add(callback);
    
    // Immediately notify about already discovered users
    this.discoveredUsers.forEach(user => callback(user));
    
    // Return unsubscribe function
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Get all discovered users
   */
  getDiscoveredUsers(): User[] {
    return Array.from(this.discoveredUsers.values());
  }

  /**
   * Check for stale users and remove them
   */
  cleanupStaleUsers(): void {
    const now = Date.now();
    const staleUsers: string[] = [];

    this.discoveredUsers.forEach((user, uid) => {
      if (now - user.lastSeen > DISCOVERY_TIMEOUT) {
        console.log('[UDPDiscovery] Removing stale user:', user.username);
        staleUsers.push(uid);
      }
    });

    staleUsers.forEach(uid => this.discoveredUsers.delete(uid));
  }

  /**
   * Shutdown discovery service
   */
  shutdown(): void {
    console.log('[UDPDiscovery] Shutting down...');
    
    this.stopBroadcasting();
    
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.discoveredUsers.clear();
    this.callbacks.clear();
    this.currentUser = null;
  }

  /**
   * Check if service is running
   */
  isRunning(): boolean {
    return this.socket !== null && this.currentUser !== null;
  }
}

export default new UDPDiscoveryService();
