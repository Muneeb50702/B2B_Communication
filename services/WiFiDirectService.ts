import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { WiFiDirectModule } = NativeModules;

export interface WiFiDirectDevice {
  deviceName: string;
  deviceAddress: string;
  status: number;
}

export interface GroupInfo {
  networkName: string;
  passphrase: string;
  ownerAddress: string;
  isGroupOwner: boolean;
}

export interface ConnectionInfo {
  connected: boolean;
  isGroupOwner: boolean;
  groupOwnerAddress?: string;
}

class WiFiDirectService {
  private eventEmitter: NativeEventEmitter;
  private listeners: { [key: string]: any } = {};

  constructor() {
    if (Platform.OS === 'android' && WiFiDirectModule) {
      this.eventEmitter = new NativeEventEmitter(WiFiDirectModule);
    }
  }

  /**
   * Initialize WiFi Direct
   */
  async initialize(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      throw new Error('WiFi Direct is only supported on Android');
    }
    
    try {
      const result = await WiFiDirectModule.initialize();
      console.log('[WiFiDirect] Initialized successfully');
      return result;
    } catch (error) {
      console.error('[WiFiDirect] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create a WiFi Direct group (host mode)
   */
  async createGroup(): Promise<GroupInfo> {
    try {
      const groupInfo = await WiFiDirectModule.createGroup();
      console.log('[WiFiDirect] Group created:', groupInfo);
      return groupInfo;
    } catch (error) {
      console.error('[WiFiDirect] Failed to create group:', error);
      throw error;
    }
  }

  /**
   * Discover nearby peers
   */
  async discoverPeers(): Promise<boolean> {
    try {
      const result = await WiFiDirectModule.discoverPeers();
      console.log('[WiFiDirect] Peer discovery started');
      return result;
    } catch (error) {
      console.error('[WiFiDirect] Peer discovery failed:', error);
      throw error;
    }
  }

  /**
   * Connect to a peer
   */
  async connect(deviceAddress: string): Promise<boolean> {
    try {
      const result = await WiFiDirectModule.connect(deviceAddress);
      console.log('[WiFiDirect] Connection initiated to:', deviceAddress);
      return result;
    } catch (error) {
      console.error('[WiFiDirect] Connection failed:', error);
      throw error;
    }
  }

  /**
   * Remove the current group
   */
  async removeGroup(): Promise<boolean> {
    try {
      const result = await WiFiDirectModule.removeGroup();
      console.log('[WiFiDirect] Group removed');
      return result;
    } catch (error) {
      console.error('[WiFiDirect] Failed to remove group:', error);
      throw error;
    }
  }

  /**
   * Get current connection info
   */
  async getConnectionInfo(): Promise<ConnectionInfo | null> {
    try {
      const info = await WiFiDirectModule.getConnectionInfo();
      return info;
    } catch (error) {
      console.error('[WiFiDirect] Failed to get connection info:', error);
      return null;
    }
  }

  /**
   * Stop peer discovery
   */
  async stopPeerDiscovery(): Promise<boolean> {
    try {
      const result = await WiFiDirectModule.stopPeerDiscovery();
      console.log('[WiFiDirect] Peer discovery stopped');
      return result;
    } catch (error) {
      console.error('[WiFiDirect] Failed to stop discovery:', error);
      throw error;
    }
  }

  /**
   * Listen for WiFi P2P state changes
   */
  onStateChanged(callback: (enabled: boolean) => void): () => void {
    if (!this.eventEmitter) return () => {};
    
    const subscription = this.eventEmitter.addListener('WiFiP2PStateChanged', callback);
    this.listeners['state'] = subscription;
    
    return () => subscription.remove();
  }

  /**
   * Listen for peers list changes
   */
  onPeersChanged(callback: (peers: WiFiDirectDevice[]) => void): () => void {
    if (!this.eventEmitter) return () => {};
    
    const subscription = this.eventEmitter.addListener('PeersChanged', callback);
    this.listeners['peers'] = subscription;
    
    return () => subscription.remove();
  }

  /**
   * Listen for connection changes
   */
  onConnectionChanged(callback: (info: ConnectionInfo) => void): () => void {
    if (!this.eventEmitter) return () => {};
    
    const subscription = this.eventEmitter.addListener('ConnectionChanged', callback);
    this.listeners['connection'] = subscription;
    
    return () => subscription.remove();
  }

  /**
   * Listen for this device info changes
   */
  onThisDeviceChanged(callback: (device: WiFiDirectDevice) => void): () => void {
    if (!this.eventEmitter) return () => {};
    
    const subscription = this.eventEmitter.addListener('ThisDeviceChanged', callback);
    this.listeners['device'] = subscription;
    
    return () => subscription.remove();
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(): void {
    Object.values(this.listeners).forEach(listener => {
      if (listener && listener.remove) {
        listener.remove();
      }
    });
    this.listeners = {};
  }
}

export default new WiFiDirectService();
