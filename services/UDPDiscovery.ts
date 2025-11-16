import dgram from 'react-native-udp';
import { NETWORK_CONFIG } from '@/constants/network';
import type { User, NetworkPacket } from '@/types';

type DiscoveryCallback = (user: User) => void;

export class UDPDiscovery {
  private socket: any = null;
  private isListening: boolean = false;
  private discoveryCallbacks: Set<DiscoveryCallback> = new Set();
  private currentUser: User | null = null;
  private broadcastInterval: any = null;

  async initialize(user: User) {
    this.currentUser = user;
    
    try {
      // Create UDP socket
      this.socket = dgram.createSocket({
        type: 'udp4',
        reusePort: true,
      });

      // Bind to discovery port
      await new Promise<void>((resolve, reject) => {
        this.socket.bind(NETWORK_CONFIG.DISCOVERY_PORT, (err: any) => {
          if (err) {
            console.error('[UDP] Failed to bind:', err);
            reject(err);
          } else {
            console.log('[UDP] Bound to port', NETWORK_CONFIG.DISCOVERY_PORT);
            resolve();
          }
        });
      });

      // Enable broadcast
      this.socket.setBroadcast(true);

      // Listen for discovery packets
      this.socket.on('message', (msg: Buffer, rinfo: any) => {
        this.handleDiscoveryPacket(msg, rinfo);
      });

      this.isListening = true;
      console.log('[UDP] Discovery service initialized');
    } catch (error) {
      console.error('[UDP] Initialization failed:', error);
      throw error;
    }
  }

  private handleDiscoveryPacket(msg: Buffer, rinfo: any) {
    try {
      const packet: NetworkPacket = JSON.parse(msg.toString());
      
      // Ignore our own broadcasts
      if (packet.from.uid === this.currentUser?.uid) {
        return;
      }

      if (packet.type === 'DISCOVERY') {
        console.log('[UDP] Discovered user:', packet.from.username, 'at', rinfo.address);
        
        // Update user's IP address
        const discoveredUser: User = {
          ...packet.from,
          ipAddress: rinfo.address,
        };

        // Notify callbacks
        this.discoveryCallbacks.forEach(callback => callback(discoveredUser));

        // Send response if we haven't announced ourselves recently
        this.sendDiscoveryResponse(discoveredUser);
      }
    } catch (error) {
      console.error('[UDP] Failed to parse discovery packet:', error);
    }
  }

  startBroadcasting() {
    if (!this.currentUser) {
      console.error('[UDP] Cannot broadcast without user');
      return;
    }

    // Send initial broadcast
    this.broadcastDiscovery();

    // Send periodic broadcasts
    this.broadcastInterval = setInterval(() => {
      this.broadcastDiscovery();
    }, NETWORK_CONFIG.DISCOVERY_INTERVAL);

    console.log('[UDP] Started broadcasting');
  }

  stopBroadcasting() {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }
    console.log('[UDP] Stopped broadcasting');
  }

  private broadcastDiscovery() {
    if (!this.currentUser || !this.socket) return;

    const packet: NetworkPacket = {
      type: 'DISCOVERY',
      from: this.currentUser,
      data: { timestamp: Date.now() },
      timestamp: Date.now(),
    };

    const message = Buffer.from(JSON.stringify(packet));
    const broadcastAddress = '255.255.255.255';

    this.socket.send(
      message,
      0,
      message.length,
      NETWORK_CONFIG.DISCOVERY_PORT,
      broadcastAddress,
      (err: any) => {
        if (err) {
          console.error('[UDP] Broadcast failed:', err);
        } else {
          console.log('[UDP] Broadcast sent');
        }
      }
    );
  }

  private sendDiscoveryResponse(toUser: User) {
    if (!this.currentUser || !this.socket || !toUser.ipAddress) return;

    const packet: NetworkPacket = {
      type: 'DISCOVERY',
      from: this.currentUser,
      data: { timestamp: Date.now() },
      timestamp: Date.now(),
    };

    const message = Buffer.from(JSON.stringify(packet));

    this.socket.send(
      message,
      0,
      message.length,
      NETWORK_CONFIG.DISCOVERY_PORT,
      toUser.ipAddress,
      (err: any) => {
        if (err) {
          console.error('[UDP] Response send failed:', err);
        }
      }
    );
  }

  onUserDiscovered(callback: DiscoveryCallback) {
    this.discoveryCallbacks.add(callback);
    return () => {
      this.discoveryCallbacks.delete(callback);
    };
  }

  shutdown() {
    console.log('[UDP] Shutting down');
    
    this.stopBroadcasting();
    
    if (this.socket) {
      try {
        this.socket.close();
      } catch (error) {
        console.error('[UDP] Error closing socket:', error);
      }
      this.socket = null;
    }

    this.isListening = false;
    this.discoveryCallbacks.clear();
    this.currentUser = null;
  }
}

export default new UDPDiscovery();
