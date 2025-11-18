import type { HotspotConfig } from './WiFiManager';

export interface QRData {
  type: 'MXB_CONNECT';
  ssid: string;
  password: string;
  hostName: string;
  version: string;
}

class QRCodeService {
  /**
   * Generate QR data from hotspot config
   */
  generateQRData(config: HotspotConfig, hostName: string): string {
    const data: QRData = {
      type: 'MXB_CONNECT',
      ssid: config.ssid,
      password: config.password,
      hostName,
      version: '1.0',
    };

    return JSON.stringify(data);
  }

  /**
   * Parse scanned QR code data
   */
  parseQRData(qrString: string): QRData | null {
    try {
      const data = JSON.parse(qrString) as QRData;

      if (data.type !== 'MXB_CONNECT') {
        console.warn('[QRCode] Invalid QR code type:', data.type);
        return null;
      }

      if (!data.ssid || !data.password) {
        console.warn('[QRCode] Missing required fields in QR code');
        return null;
      }

      return data;
    } catch (error) {
      console.error('[QRCode] Failed to parse QR code:', error);
      return null;
    }
  }

  /**
   * Validate QR data structure
   */
  isValidQRData(data: any): data is QRData {
    return (
      data &&
      typeof data === 'object' &&
      data.type === 'MXB_CONNECT' &&
      typeof data.ssid === 'string' &&
      typeof data.password === 'string' &&
      typeof data.hostName === 'string'
    );
  }
}

export default new QRCodeService();
