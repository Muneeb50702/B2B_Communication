import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Share,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { X, Copy, Share2, Wifi } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import type { QRData } from '@/services/QRCodeService';

interface QRDisplayModalProps {
  visible: boolean;
  qrData: string;
  hotspotInfo: QRData;
  onClose: () => void;
}

export default function QRDisplayModal({
  visible,
  qrData,
  hotspotInfo,
  onClose,
}: QRDisplayModalProps) {
  const handleCopyCredentials = () => {
    const credentials = `Network: ${hotspotInfo.ssid}\nPassword: ${hotspotInfo.password}`;
    // Copy to clipboard logic would go here
    console.log('[QRDisplay] Copied:', credentials);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join my MXB Connect network!\n\nNetwork: ${hotspotInfo.ssid}\nPassword: ${hotspotInfo.password}\n\nOr scan the QR code in the app.`,
        title: 'MXB Connect Network',
      });
    } catch (error) {
      console.error('[QRDisplay] Share failed:', error);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Network QR Code</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.qrContainer}>
              <QRCode
                value={qrData}
                size={250}
                backgroundColor="white"
                color={theme.colors.primary}
              />
            </View>

            <View style={styles.infoCard}>
              <View style={styles.infoHeader}>
                <Wifi size={20} color={theme.colors.primary} />
                <Text style={styles.infoTitle}>Hotspot Details</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Network Name:</Text>
                <Text style={styles.infoValue}>{hotspotInfo.ssid}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Password:</Text>
                <Text style={styles.infoValue}>{hotspotInfo.password}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Host:</Text>
                <Text style={styles.infoValue}>{hotspotInfo.hostName}</Text>
              </View>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleCopyCredentials}
              >
                <Copy size={20} color={theme.colors.primary} />
                <Text style={styles.actionText}>Copy Details</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleShare}
              >
                <Share2 size={20} color={theme.colors.primary} />
                <Text style={styles.actionText}>Share</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.instructions}>
              <Text style={styles.instructionsTitle}>How to Connect:</Text>
              <Text style={styles.instructionsText}>
                1. Open MXB Connect on another device{'\n'}
                2. Tap "Join Network"{'\n'}
                3. Scan this QR code{'\n'}
                4. Or manually connect to the network above
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.text,
  },
  closeButton: {
    padding: theme.spacing.sm,
  },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  qrContainer: {
    alignItems: 'center',
    padding: theme.spacing.xl,
    backgroundColor: '#FFFFFF',
    borderRadius: theme.borderRadius.lg,
  },
  infoCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  infoTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  infoLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  infoValue: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.text,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  instructions: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  instructionsTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.text,
  },
  instructionsText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
});
