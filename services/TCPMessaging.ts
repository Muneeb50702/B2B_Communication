import TcpSocket from 'react-native-tcp-socket';
import type { User, Message, NetworkPacket } from '@/types';

const TCP_PORT = 3002;
const CHUNK_SIZE = 65536; // 64KB chunks for file transfer

export type MessageCallback = (packet: NetworkPacket) => void;

interface Connection {
  socket: any;
  user: User;
  buffer: string;
}

class TCPMessagingService {
  private server: any = null;
  private connections: Map<string, Connection> = new Map();
  private callbacks: Set<MessageCallback> = new Set();
  private currentUser: User | null = null;

  /**
   * Initialize TCP server
   */
  async initialize(user: User): Promise<boolean> {
    try {
      console.log('[TCPMessaging] Initializing server...');
      
      this.currentUser = user;

      // Create TCP server
      this.server = TcpSocket.createServer((socket: any) => {
        this.handleNewConnection(socket);
      });

      // Start listening
      await new Promise<void>((resolve, reject) => {
        this.server!.listen({ port: TCP_PORT, host: '0.0.0.0' }, (err?: Error) => {
          if (err) {
            console.error('[TCPMessaging] Failed to start server:', err);
            reject(err);
          } else {
            console.log('[TCPMessaging] Server listening on port:', TCP_PORT);
            resolve();
          }
        });
      });

      return true;
    } catch (error) {
      console.error('[TCPMessaging] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Handle new incoming connection
   */
  private handleNewConnection(socket: any): void {
    const address = socket.address();
    console.log('[TCPMessaging] New connection from:', address);

    const connection: Connection = {
      socket,
      user: {
        uid: '',
        username: 'Unknown',
        ipAddress: address?.address || '',
        port: address?.port || 0,
        status: 'online',
        lastSeen: Date.now(),
      },
      buffer: '',
    };

    // Handle data
    socket.on('data', (data: Buffer) => {
      this.handleData(connection, data);
    });

    // Handle connection close
    socket.on('close', () => {
      console.log('[TCPMessaging] Connection closed:', connection.user.username);
      this.connections.delete(connection.user.uid);
    });

    // Handle errors
    socket.on('error', (err: Error) => {
      console.error('[TCPMessaging] Socket error:', err);
      this.connections.delete(connection.user.uid);
    });
  }

  /**
   * Connect to a remote peer
   */
  async connectToPeer(user: User): Promise<boolean> {
    try {
      console.log('[TCPMessaging] Connecting to peer:', user.username);

      // Check if already connected
      if (this.connections.has(user.uid)) {
        console.log('[TCPMessaging] Already connected to:', user.username);
        return true;
      }

      const socket = TcpSocket.createConnection(
        {
          port: TCP_PORT,
          host: user.ipAddress,
        },
        () => {
          console.log('[TCPMessaging] Connected to:', user.username);
        }
      );

      const connection: Connection = {
        socket,
        user,
        buffer: '',
      };

      // Store connection
      this.connections.set(user.uid, connection);

      // Handle errors
      socket.on('error', (err: Error) => {
        console.error('[TCPMessaging] Connection error:', err);
        this.connections.delete(user.uid);
      });

      // Handle data
      socket.on('data', (data: Buffer) => {
        this.handleData(connection, data);
      });

      // Handle close
      socket.on('close', () => {
        console.log('[TCPMessaging] Connection closed:', user.username);
        this.connections.delete(user.uid);
      });

      return true;
    } catch (error) {
      console.error('[TCPMessaging] Failed to connect:', error);
      return false;
    }
  }

  /**
   * Handle incoming data
   */
  private handleData(connection: Connection, data: Buffer): void {
    try {
      // Append to buffer
      connection.buffer += data.toString();

      // Try to parse complete messages (separated by newlines)
      const messages = connection.buffer.split('\n');
      connection.buffer = messages.pop() || ''; // Keep incomplete message in buffer

      messages.forEach(msg => {
        if (msg.trim()) {
          this.handleMessage(connection, msg);
        }
      });
    } catch (error) {
      console.error('[TCPMessaging] Failed to handle data:', error);
    }
  }

  /**
   * Handle parsed message
   */
  private handleMessage(connection: Connection, message: string): void {
    try {
      const packet: NetworkPacket = JSON.parse(message);
      
      console.log('[TCPMessaging] Received packet:', packet.type);

      // Update connection user info if provided
      if (packet.from && !connection.user.uid) {
        connection.user = packet.from;
        this.connections.set(packet.from.uid, connection);
      }

      // Notify callbacks
      this.callbacks.forEach(callback => callback(packet));
    } catch (error) {
      console.error('[TCPMessaging] Failed to parse message:', error);
    }
  }

  /**
   * Send packet to user
   */
  async sendPacket(toUser: User, packet: NetworkPacket): Promise<boolean> {
    try {
      let connection = this.connections.get(toUser.uid);

      // Connect if not already connected
      if (!connection) {
        const connected = await this.connectToPeer(toUser);
        if (!connected) {
          console.error('[TCPMessaging] Failed to connect to:', toUser.username);
          return false;
        }
        connection = this.connections.get(toUser.uid);
      }

      if (!connection) {
        console.error('[TCPMessaging] No connection found for:', toUser.username);
        return false;
      }

      // Add newline delimiter
      const message = JSON.stringify(packet) + '\n';
      const buffer = Buffer.from(message);

      // Send data
      connection.socket.write(buffer, (err?: Error) => {
        if (err) {
          console.error('[TCPMessaging] Send failed:', err);
        }
      });

      return true;
    } catch (error) {
      console.error('[TCPMessaging] Failed to send packet:', error);
      return false;
    }
  }

  /**
   * Send message to user
   */
  async sendMessage(toUser: User, message: Message): Promise<boolean> {
    if (!this.currentUser) {
      console.error('[TCPMessaging] Current user not set');
      return false;
    }

    const packet: NetworkPacket = {
      type: 'MESSAGE',
      from: this.currentUser,
      to: toUser.uid,
      data: { message },
      timestamp: Date.now(),
    };

    return this.sendPacket(toUser, packet);
  }

  /**
   * Send friend request
   */
  async sendFriendRequest(toUser: User): Promise<boolean> {
    if (!this.currentUser) {
      console.error('[TCPMessaging] Current user not set');
      return false;
    }

    const packet: NetworkPacket = {
      type: 'FRIEND_REQUEST',
      from: this.currentUser,
      to: toUser.uid,
      data: {},
      timestamp: Date.now(),
    };

    return this.sendPacket(toUser, packet);
  }

  /**
   * Accept friend request
   */
  async acceptFriendRequest(toUser: User): Promise<boolean> {
    if (!this.currentUser) {
      console.error('[TCPMessaging] Current user not set');
      return false;
    }

    const packet: NetworkPacket = {
      type: 'FRIEND_ACCEPT',
      from: this.currentUser,
      to: toUser.uid,
      data: {},
      timestamp: Date.now(),
    };

    return this.sendPacket(toUser, packet);
  }

  /**
   * Reject friend request
   */
  async rejectFriendRequest(toUser: User): Promise<boolean> {
    if (!this.currentUser) {
      console.error('[TCPMessaging] Current user not set');
      return false;
    }

    const packet: NetworkPacket = {
      type: 'FRIEND_REJECT',
      from: this.currentUser,
      to: toUser.uid,
      data: {},
      timestamp: Date.now(),
    };

    return this.sendPacket(toUser, packet);
  }

  /**
   * Register callback for messages
   */
  onMessage(callback: MessageCallback): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Get connection status
   */
  isConnected(uid: string): boolean {
    return this.connections.has(uid);
  }

  /**
   * Get all active connections
   */
  getConnections(): User[] {
    return Array.from(this.connections.values()).map(conn => conn.user);
  }

  /**
   * Disconnect from user
   */
  disconnectFromPeer(uid: string): void {
    const connection = this.connections.get(uid);
    if (connection) {
      console.log('[TCPMessaging] Disconnecting from:', connection.user.username);
      connection.socket.destroy();
      this.connections.delete(uid);
    }
  }

  /**
   * Shutdown service
   */
  shutdown(): void {
    console.log('[TCPMessaging] Shutting down...');

    // Close all connections
    this.connections.forEach((connection, uid) => {
      connection.socket.destroy();
    });
    this.connections.clear();

    // Close server
    if (this.server) {
      this.server.close();
      this.server = null;
    }

    this.callbacks.clear();
    this.currentUser = null;
  }
}

export default new TCPMessagingService();
