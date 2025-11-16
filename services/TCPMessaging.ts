import TcpSocket from 'react-native-tcp-socket';
import { NETWORK_CONFIG } from '@/constants/network';
import type { User, NetworkPacket, Message } from '@/types';

type PacketCallback = (packet: NetworkPacket) => void;

export class TCPMessaging {
  private server: any = null;
  private connections: Map<string, any> = new Map();
  private packetCallbacks: Set<PacketCallback> = new Set();
  private currentUser: User | null = null;
  private isServerRunning: boolean = false;

  async startServer(user: User) {
    this.currentUser = user;

    return new Promise<void>((resolve, reject) => {
      try {
        // Create TCP server
        this.server = TcpSocket.createServer((socket: any) => {
          console.log('[TCP] Client connected:', socket.address().address);
          
          let buffer = '';

          socket.on('data', (data: Buffer) => {
            buffer += data.toString();
            
            // Check if we have complete packets (separated by newlines)
            const packets = buffer.split('\n');
            buffer = packets.pop() || ''; // Keep incomplete packet in buffer

            packets.forEach(packetStr => {
              if (packetStr.trim()) {
                this.handlePacket(packetStr, socket);
              }
            });
          });

          socket.on('error', (error: Error) => {
            console.error('[TCP] Socket error:', error);
          });

          socket.on('close', () => {
            console.log('[TCP] Client disconnected');
            // Remove from connections
            this.connections.forEach((conn, key) => {
              if (conn === socket) {
                this.connections.delete(key);
              }
            });
          });
        });

        // Listen on TCP port
        this.server.listen(
          { port: NETWORK_CONFIG.TCP_MESSAGE_PORT, host: '0.0.0.0' },
          () => {
            this.isServerRunning = true;
            console.log('[TCP] Server listening on port', NETWORK_CONFIG.TCP_MESSAGE_PORT);
            resolve();
          }
        );

        this.server.on('error', (error: Error) => {
          console.error('[TCP] Server error:', error);
          reject(error);
        });
      } catch (error) {
        console.error('[TCP] Failed to start server:', error);
        reject(error);
      }
    });
  }

  private handlePacket(packetStr: string, socket: any) {
    try {
      const packet: NetworkPacket = JSON.parse(packetStr);
      
      console.log('[TCP] Received packet:', packet.type, 'from', packet.from.username);

      // Store connection for this user
      if (packet.from.uid) {
        this.connections.set(packet.from.uid, socket);
      }

      // Notify callbacks
      this.packetCallbacks.forEach(callback => callback(packet));
    } catch (error) {
      console.error('[TCP] Failed to parse packet:', error);
    }
  }

  async connectToUser(user: User): Promise<boolean> {
    if (!user.ipAddress) {
      console.error('[TCP] User has no IP address');
      return false;
    }

    // Check if already connected
    if (this.connections.has(user.uid)) {
      console.log('[TCP] Already connected to', user.username);
      return true;
    }

    return new Promise((resolve) => {
      try {
        const socket = TcpSocket.createConnection(
          {
            port: NETWORK_CONFIG.TCP_MESSAGE_PORT,
            host: user.ipAddress,
            timeout: 5000,
          },
          () => {
            console.log('[TCP] Connected to', user.username, 'at', user.ipAddress);
            this.connections.set(user.uid, socket);
            resolve(true);
          }
        );

        let buffer = '';

        socket.on('data', (data: Buffer) => {
          buffer += data.toString();
          
          const packets = buffer.split('\n');
          buffer = packets.pop() || '';

          packets.forEach(packetStr => {
            if (packetStr.trim()) {
              this.handlePacket(packetStr, socket);
            }
          });
        });

        socket.on('error', (error: Error) => {
          console.error('[TCP] Connection error:', error);
          resolve(false);
        });

        socket.on('close', () => {
          console.log('[TCP] Connection closed to', user.username);
          this.connections.delete(user.uid);
        });
      } catch (error) {
        console.error('[TCP] Failed to connect:', error);
        resolve(false);
      }
    });
  }

  async sendPacket(toUser: User, packet: NetworkPacket): Promise<boolean> {
    let socket = this.connections.get(toUser.uid);

    // If not connected, try to connect first
    if (!socket) {
      const connected = await this.connectToUser(toUser);
      if (!connected) {
        console.error('[TCP] Cannot send packet, not connected to', toUser.username);
        return false;
      }
      socket = this.connections.get(toUser.uid);
    }

    if (!socket) {
      return false;
    }

    return new Promise((resolve) => {
      try {
        const data = JSON.stringify(packet) + '\n';
        socket.write(data, (error: Error) => {
          if (error) {
            console.error('[TCP] Failed to send packet:', error);
            resolve(false);
          } else {
            console.log('[TCP] Sent packet:', packet.type, 'to', toUser.username);
            resolve(true);
          }
        });
      } catch (error) {
        console.error('[TCP] Send error:', error);
        resolve(false);
      }
    });
  }

  async sendMessage(toUser: User, message: Message): Promise<boolean> {
    if (!this.currentUser) return false;

    const packet: NetworkPacket = {
      type: 'MESSAGE',
      from: this.currentUser,
      to: toUser.uid,
      data: { message },
      timestamp: Date.now(),
    };

    return this.sendPacket(toUser, packet);
  }

  async sendFriendRequest(toUser: User): Promise<boolean> {
    if (!this.currentUser) return false;

    const packet: NetworkPacket = {
      type: 'FRIEND_REQUEST',
      from: this.currentUser,
      to: toUser.uid,
      data: {},
      timestamp: Date.now(),
    };

    return this.sendPacket(toUser, packet);
  }

  async acceptFriendRequest(toUser: User): Promise<boolean> {
    if (!this.currentUser) return false;

    const packet: NetworkPacket = {
      type: 'FRIEND_ACCEPT',
      from: this.currentUser,
      to: toUser.uid,
      data: {},
      timestamp: Date.now(),
    };

    return this.sendPacket(toUser, packet);
  }

  async rejectFriendRequest(toUser: User): Promise<boolean> {
    if (!this.currentUser) return false;

    const packet: NetworkPacket = {
      type: 'FRIEND_REJECT',
      from: this.currentUser,
      to: toUser.uid,
      data: {},
      timestamp: Date.now(),
    };

    return this.sendPacket(toUser, packet);
  }

  onPacket(callback: PacketCallback) {
    this.packetCallbacks.add(callback);
    return () => {
      this.packetCallbacks.delete(callback);
    };
  }

  shutdown() {
    console.log('[TCP] Shutting down');

    // Close all client connections
    this.connections.forEach((socket, uid) => {
      try {
        socket.destroy();
      } catch (error) {
        console.error('[TCP] Error closing connection:', error);
      }
    });
    this.connections.clear();

    // Close server
    if (this.server) {
      try {
        this.server.close();
      } catch (error) {
        console.error('[TCP] Error closing server:', error);
      }
      this.server = null;
    }

    this.isServerRunning = false;
    this.packetCallbacks.clear();
    this.currentUser = null;
  }

  getConnectionStatus() {
    return {
      isServerRunning: this.isServerRunning,
      activeConnections: this.connections.size,
    };
  }
}

export default new TCPMessaging();
