import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { X, ScanLine } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import QRCodeService, { type QRData } from '@/services/QRCodeService';

interface QRScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScan: (data: QRData) => void;
}

export default function QRScannerModal({
  visible,
  onClose,
  onScan,
}: QRScannerModalProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (visible) {
      requestCameraPermission();
      setScanned(false);
    }
  }, [visible]);

  const requestCameraPermission = async () => {
    try {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
      
      if (status !== 'granted') {
        Alert.alert(
          'Camera Permission Required',
          'Please enable camera access in Settings to scan QR codes.',
          [
            { text: 'Cancel', onPress: onClose },
            { text: 'Open Settings', onPress: () => {
              // Open settings would go here
              console.log('[QRScanner] Open settings');
            }},
          ]
        );
      }
    } catch (error) {
      console.error('[QRScanner] Permission request failed:', error);
      setHasPermission(false);
    }
  };

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;

    console.log('[QRScanner] Code scanned:', type, data);
    setScanned(true);

    const qrData = QRCodeService.parseQRData(data);
    
    if (!qrData) {
      Alert.alert(
        'Invalid QR Code',
        'This QR code is not a valid MXB Connect network code. Please scan a code from the host device.',
        [
          { text: 'Scan Again', onPress: () => setScanned(false) },
          { text: 'Cancel', onPress: onClose },
        ]
      );
      return;
    }

    Alert.alert(
      'Network Found',
      `Connect to ${qrData.ssid}?\n\nHost: ${qrData.hostName}`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            setScanned(false);
          },
        },
        {
          text: 'Connect',
          onPress: () => {
            onScan(qrData);
            onClose();
          },
        },
      ]
    );
  };

  if (hasPermission === null) {
    return (
      <Modal visible={visible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.container}>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Requesting camera access...</Text>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  if (hasPermission === false) {
    return (
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.title}>Camera Access Required</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>
                Camera permission is required to scan QR codes. Please enable it in your device settings.
              </Text>
              <TouchableOpacity style={styles.retryButton} onPress={requestCameraPermission}>
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.cameraContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Scan Network QR Code</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.cameraWrapper}>
            <BarCodeScanner
              onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
              style={styles.camera}
              barCodeTypes={[BarCodeScanner.Constants.BarCodeType.qr]}
            />
            
            <View style={styles.scannerOverlay}>
              <View style={styles.scannerFrame} />
              <ScanLine size={200} color="#FFFFFF" style={styles.scanIcon} />
            </View>

            {scanned && (
              <View style={styles.scannedOverlay}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={styles.scannedText}>Processing...</Text>
              </View>
            )}
          </View>

          <View style={styles.instructions}>
            <Text style={styles.instructionsText}>
              Point your camera at the QR code displayed on the host device
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  cameraContainer: {
    flex: 1,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xxl,
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  closeButton: {
    padding: theme.spacing.sm,
  },
  cameraWrapper: {
    flex: 1,
    position: 'relative',
    marginHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: theme.borderRadius.lg,
    backgroundColor: 'transparent',
  },
  scanIcon: {
    position: 'absolute',
  },
  scannedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  scannedText: {
    fontSize: theme.fontSize.md,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  instructions: {
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  instructionsText: {
    fontSize: theme.fontSize.sm,
    color: '#FFFFFF',
    textAlign: 'center',
    opacity: 0.8,
  },
  loadingContainer: {
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  loadingText: {
    fontSize: theme.fontSize.md,
    color: '#FFFFFF',
  },
  errorContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  errorText: {
    fontSize: theme.fontSize.md,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 22,
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  retryButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
