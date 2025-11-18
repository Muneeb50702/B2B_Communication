import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { FileText, Download, X, CheckCircle, AlertCircle } from 'lucide-react-native';
import { colors } from '@/constants/theme';
import type { FileTransfer } from '@/services/FileTransferService';
import FileTransferService from '@/services/FileTransferService';

interface FileTransferProgressProps {
  transfer: FileTransfer;
  isReceiving: boolean;
}

export default function FileTransferProgress({ 
  transfer, 
  isReceiving,
}: FileTransferProgressProps) {
  const { metadata, progress, status } = transfer;

  const handleCancel = () => {
    Alert.alert(
      'Cancel Transfer',
      'Are you sure you want to cancel this transfer?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: () => FileTransferService.cancelTransfer(transfer.id),
        },
      ]
    );
  };

  const handleOpen = () => {
    if (status === 'completed' && transfer.localUri) {
      Alert.alert(
        metadata.filename,
        'File received successfully',
        [
          {
            text: 'Share',
            onPress: () => FileTransferService.shareFile(transfer.id),
          },
          { text: 'Close' },
        ]
      );
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={20} color={colors.success} />;
      case 'failed':
      case 'cancelled':
        return <AlertCircle size={20} color={colors.danger} />;
      case 'transferring':
        return isReceiving ? (
          <Download size={20} color={colors.primary} />
        ) : (
          <FileText size={20} color={colors.primary} />
        );
      default:
        return <FileText size={20} color={colors.textSecondary} />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'pending':
        return 'Pending...';
      case 'transferring':
        return isReceiving ? 'Receiving...' : 'Sending...';
      case 'completed':
        return isReceiving ? 'Received' : 'Sent';
      case 'failed':
        return 'Failed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return '';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          {getStatusIcon()}
        </View>

        <View style={styles.info}>
          <Text style={styles.filename} numberOfLines={1}>
            {metadata.filename}
          </Text>
          <View style={styles.statusRow}>
            <Text style={styles.status}>{getStatusText()}</Text>
            {status === 'transferring' && (
              <Text style={styles.progress}>{Math.round(progress)}%</Text>
            )}
          </View>
          {status === 'transferring' && (
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill,
                  { width: `${progress}%` }
                ]} 
              />
            </View>
          )}
        </View>

        {status === 'transferring' && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}
          >
            <X size={20} color={colors.danger} />
          </TouchableOpacity>
        )}

        {status === 'completed' && isReceiving && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleOpen}
          >
            <Download size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    gap: 4,
  },
  filename: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  status: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  progress: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  cancelButton: {
    padding: 8,
  },
  actionButton: {
    padding: 8,
  },
});
