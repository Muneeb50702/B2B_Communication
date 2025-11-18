import React, { useState } from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Paperclip } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import { colors } from '@/constants/theme';
import FileTransferService from '@/services/FileTransferService';
import type { User } from '@/types';

interface FilePickerButtonProps {
  toUser: User;
  onFilePicked?: () => void;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB limit

export default function FilePickerButton({ 
  toUser, 
  onFilePicked,
  disabled = false,
}: FilePickerButtonProps) {
  const [picking, setPicking] = useState(false);

  const handlePickFile = async () => {
    if (disabled || picking) return;

    setPicking(true);
    try {
      const result = await FileTransferService.pickFile();
      
      if (!result || result.canceled) {
        setPicking(false);
        return;
      }

      const file = result.assets[0];
      
      // Check file size
      if (file.size && file.size > MAX_FILE_SIZE) {
        Alert.alert(
          'File Too Large',
          'Please select a file smaller than 100MB',
          [{ text: 'OK' }]
        );
        setPicking(false);
        return;
      }

      // Confirm transfer
      Alert.alert(
        'Send File',
        `Send "${file.name}" (${formatFileSize(file.size || 0)}) to ${toUser.username}?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => setPicking(false),
          },
          {
            text: 'Send',
            onPress: async () => {
              try {
                await FileTransferService.sendFile(
                  toUser,
                  file.uri,
                  file.name,
                  file.mimeType || 'application/octet-stream',
                  toUser.uid // This will be fixed in AppContext
                );
                onFilePicked?.();
              } catch (error) {
                console.error('[FilePickerButton] Send error:', error);
                Alert.alert('Transfer Failed', 'Could not send file');
              } finally {
                setPicking(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('[FilePickerButton] Pick error:', error);
      Alert.alert('Error', 'Could not pick file');
      setPicking(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, (disabled || picking) && styles.buttonDisabled]}
      onPress={handlePickFile}
      disabled={disabled || picking}
    >
      {picking ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Paperclip size={24} color={disabled ? colors.textSecondary : colors.primary} />
      )}
    </TouchableOpacity>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
