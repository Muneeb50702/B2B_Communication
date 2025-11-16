import WifiManager from 'react-native-wifi-reborn';
import { Platform, PermissionsAndroid } from 'react-native';

export interface WiFiNetwork {
  SSID: string;
  BSSID: string;
  capabilities: string;
  frequency: number;
  level: number;
  timestamp: number;
}

export class WiFiHelper {
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return true;
    }

    try {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        'android.permission.ACCESS_WIFI_STATE' as any,
        'android.permission.CHANGE_WIFI_STATE' as any,
      ]);

      return (
        granted['android.permission.ACCESS_FINE_LOCATION'] === 'granted' &&
        granted['android.permission.ACCESS_WIFI_STATE'] === 'granted' &&
        granted['android.permission.CHANGE_WIFI_STATE'] === 'granted'
      );
    } catch (error) {
      console.error('[WiFi] Permission request failed:', error);
      return false;
    }
  }

  async getCurrentSSID(): Promise<string | null> {
    try {
      const ssid = await WifiManager.getCurrentWifiSSID();
      console.log('[WiFi] Current SSID:', ssid);
      return ssid;
    } catch (error) {
      console.error('[WiFi] Failed to get current SSID:', error);
      return null;
    }
  }

  async getAvailableNetworks(): Promise<WiFiNetwork[]> {
    try {
      const hasPermissions = await this.requestPermissions();
      if (!hasPermissions) {
        console.error('[WiFi] Permissions not granted');
        return [];
      }

      const networks = await WifiManager.loadWifiList();
      console.log('[WiFi] Found', networks.length, 'networks');
      return networks;
    } catch (error) {
      console.error('[WiFi] Failed to scan networks:', error);
      return [];
    }
  }

  async connectToNetwork(ssid: string, password: string): Promise<boolean> {
    try {
      const hasPermissions = await this.requestPermissions();
      if (!hasPermissions) {
        console.error('[WiFi] Permissions not granted');
        return false;
      }

      console.log('[WiFi] Connecting to:', ssid);
      await WifiManager.connectToProtectedSSID(ssid, password, false, false);
      
      // Wait a bit for connection to establish
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const currentSSID = await this.getCurrentSSID();
      const connected = currentSSID === ssid || currentSSID === `"${ssid}"`;
      
      if (connected) {
        console.log('[WiFi] Successfully connected to:', ssid);
      } else {
        console.error('[WiFi] Failed to connect to:', ssid);
      }
      
      return connected;
    } catch (error) {
      console.error('[WiFi] Connection failed:', error);
      return false;
    }
  }

  async disconnect(): Promise<boolean> {
    try {
      await WifiManager.disconnect();
      console.log('[WiFi] Disconnected');
      return true;
    } catch (error) {
      console.error('[WiFi] Disconnect failed:', error);
      return false;
    }
  }

  async isWiFiEnabled(): Promise<boolean> {
    try {
      const enabled = await WifiManager.isEnabled();
      console.log('[WiFi] WiFi enabled:', enabled);
      return enabled;
    } catch (error) {
      console.error('[WiFi] Failed to check WiFi status:', error);
      return false;
    }
  }

  async enableWiFi(): Promise<boolean> {
    try {
      await WifiManager.setEnabled(true);
      console.log('[WiFi] WiFi enabled');
      return true;
    } catch (error) {
      console.error('[WiFi] Failed to enable WiFi:', error);
      return false;
    }
  }
}

export default new WiFiHelper();
