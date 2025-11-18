import { Platform, PermissionsAndroid } from 'react-native';
import WifiManager from 'react-native-wifi-reborn';

export interface NetworkInfo {
  ssid: string;
  bssid: string;
  ip: string;
  strength: number;
}

export interface HotspotConfig {
  ssid: string;
  password: string;
}

class WiFiManagerService {
  private hotspotSSID: string = '';
  private hotspotPassword: string = '';
  
  /**
   * Request necessary permissions for WiFi operations
   */
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      console.log('[WiFiManager] iOS permissions handled by Info.plist');
      return true;
    }

    try {
      // Check if PermissionsAndroid is available
      if (!PermissionsAndroid || !PermissionsAndroid.requestMultiple) {
        console.warn('[WiFiManager] PermissionsAndroid API not available');
        return true; // Continue anyway on web/unsupported platforms
      }

      const requested = [
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        // Android 13+ nearby wifi; may be undefined on older APIs
        // @ts-ignore
        PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES,
        PermissionsAndroid.PERMISSIONS.ACCESS_WIFI_STATE,
        PermissionsAndroid.PERMISSIONS.CHANGE_WIFI_STATE,
        PermissionsAndroid.PERMISSIONS.ACCESS_NETWORK_STATE,
      ].filter((p) => typeof p === 'string' && p.length > 0) as string[];

      if (requested.length === 0) {
        console.warn('[WiFiManager] No permissions to request');
        return true;
      }

      const granted = await PermissionsAndroid.requestMultiple(requested as any);

      if (!granted) {
        console.warn('[WiFiManager] Permission result is null');
        return true; // Continue anyway
      }

      const allGranted = Object.values(granted).every(
        permission => permission === PermissionsAndroid.RESULTS.GRANTED
      );

      console.log('[WiFiManager] Permissions granted:', allGranted);
      return allGranted;
    } catch (error) {
      console.error('[WiFiManager] Permission request failed:', error);
      return true; // Continue anyway - permissions might be granted already
    }
  }

  /**
   * Check if WiFi is enabled
   */
  async isWifiEnabled(): Promise<boolean> {
    try {
      const enabled = await WifiManager.isEnabled();
      console.log('[WiFiManager] WiFi enabled:', enabled);
      return enabled;
    } catch (error) {
      console.error('[WiFiManager] Failed to check WiFi status:', error);
      return false;
    }
  }

  /**
   * Enable WiFi
   */
  async enableWifi(): Promise<boolean> {
    try {
      await WifiManager.setEnabled(true);
      console.log('[WiFiManager] WiFi enabled');
      return true;
    } catch (error) {
      console.error('[WiFiManager] Failed to enable WiFi:', error);
      return false;
    }
  }

  /**
   * Get current network information
   */
  async getCurrentNetwork(): Promise<NetworkInfo | null> {
    try {
      const ssid = await WifiManager.getCurrentWifiSSID();
      const ip = await WifiManager.getIP();
      const bssid = await WifiManager.getBSSID();
      
      console.log('[WiFiManager] Current network:', { ssid, ip, bssid });
      
      return {
        ssid: ssid.replace(/"/g, ''), // Remove quotes
        bssid,
        ip,
        strength: 0, // Strength not available from current API
      };
    } catch (error) {
      console.error('[WiFiManager] Failed to get current network:', error);
      return null;
    }
  }

  /**
   * Scan for available WiFi networks
   */
  async scanNetworks(): Promise<NetworkInfo[]> {
    try {
      await this.requestPermissions();
      const networks = await WifiManager.reScanAndLoadWifiList();
      
      console.log('[WiFiManager] Found networks:', networks.length);
      
      return networks.map(network => ({
        ssid: network.SSID,
        bssid: network.BSSID,
        ip: '',
        strength: network.level,
      }));
    } catch (error) {
      console.error('[WiFiManager] Failed to scan networks:', error);
      return [];
    }
  }

  /**
   * Get available WiFi networks (alias for scanNetworks)
   */
  async getAvailableNetworks(): Promise<Array<{ssid: string; level: number}>> {
    try {
      await this.requestPermissions();
      const networks = await WifiManager.reScanAndLoadWifiList();
      
      console.log('[WiFiManager] Found available networks:', networks.length);
      
      return networks.map(network => ({
        ssid: network.SSID,
        level: network.level,
      }));
    } catch (error) {
      console.error('[WiFiManager] Failed to get available networks:', error);
      return [];
    }
  }

  /**
   * Filter B2B networks from scan results
   */
  filterB2BNetworks(networks: NetworkInfo[]): NetworkInfo[] {
    return networks.filter(network => 
      network.ssid.startsWith('B2B-') || 
      network.ssid.includes('B2BComm')
    );
  }

  /**
   * Connect to a WiFi network
   */
  async connectToNetwork(ssid: string, password: string): Promise<boolean> {
    try {
      console.log('[WiFiManager] Connecting to:', ssid);
      
      await WifiManager.connectToProtectedSSID(
        ssid,
        password,
        false, // isWEP
        false  // isHidden
      );
      
      // Wait a moment for connection to establish
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const currentNetwork = await this.getCurrentNetwork();
      const connected = currentNetwork?.ssid === ssid;
      
      console.log('[WiFiManager] Connection result:', connected);
      return connected;
    } catch (error) {
      console.error('[WiFiManager] Failed to connect:', error);
      return false;
    }
  }

  /**
   * Create WiFi hotspot (Android only)
   */
  async createHotspot(username: string): Promise<HotspotConfig | null> {
    if (Platform.OS !== 'android') {
      console.warn('[WiFiManager] Hotspot creation only supported on Android');
      return null;
    }

    try {
      // Generate hotspot credentials
      this.hotspotSSID = `B2B-${username}`;
      this.hotspotPassword = this.generatePassword();
      
      console.log('[WiFiManager] Creating hotspot:', this.hotspotSSID);
      
      // Note: react-native-wifi-reborn doesn't have direct hotspot API
      // We'll need to use native Android APIs or guide user to enable manually
      // For now, return the config for manual setup
      
      return {
        ssid: this.hotspotSSID,
        password: this.hotspotPassword,
      };
    } catch (error) {
      console.error('[WiFiManager] Failed to create hotspot:', error);
      return null;
    }
  }

  /**
   * Get hotspot configuration
   */
  getHotspotConfig(): HotspotConfig | null {
    if (!this.hotspotSSID || !this.hotspotPassword) {
      return null;
    }
    
    return {
      ssid: this.hotspotSSID,
      password: this.hotspotPassword,
    };
  }

  /**
   * Generate secure random password
   */
  private generatePassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  /**
   * Disconnect from current network
   */
  async disconnect(): Promise<void> {
    try {
      await WifiManager.disconnect();
      console.log('[WiFiManager] Disconnected');
    } catch (error) {
      console.error('[WiFiManager] Failed to disconnect:', error);
    }
  }

  /**
   * Get local IP address
   */
  async getLocalIP(): Promise<string> {
    try {
      const ip = await WifiManager.getIP();
      console.log('[WiFiManager] Local IP:', ip);
      return ip;
    } catch (error) {
      console.error('[WiFiManager] Failed to get IP:', error);
      return '0.0.0.0';
    }
  }
}

export default new WiFiManagerService();
