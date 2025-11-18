import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { Share } from 'react-native';
import type { User } from '@/types';
import NetworkService from './NetworkService';

export interface FileMetadata {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  fromUid: string;
  toUid: string;
  timestamp: number;
}

export interface FileTransfer {
  id: string;
  metadata: FileMetadata;
  progress: number;
  status: 'pending' | 'transferring' | 'completed' | 'failed' | 'cancelled';
  localUri?: string;
  error?: string;
}

type TransferProgressHandler = (transfer: FileTransfer) => void;
type TransferCompleteHandler = (transfer: FileTransfer) => void;

const CHUNK_SIZE = 64 * 1024; // 64KB chunks for fast transfer
const TRANSFER_DIR = `${FileSystem.documentDirectory}transfers/`;

class FileTransferService {
  private activeTransfers: Map<string, FileTransfer> = new Map();
  private progressHandlers: Set<TransferProgressHandler> = new Set();
  private completeHandlers: Set<TransferCompleteHandler> = new Set();

  constructor() {
    this.ensureTransferDirectory();
  }

  /**
   * Ensure transfer directory exists
   */
  private async ensureTransferDirectory(): Promise<void> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(TRANSFER_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(TRANSFER_DIR, { intermediates: true });
        console.log('[FileTransfer] Created transfer directory');
      }
    } catch (error) {
      console.error('[FileTransfer] Failed to create directory:', error);
    }
  }

  /**
   * Pick file from device
   */
  async pickFile(): Promise<DocumentPicker.DocumentPickerResult | null> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result || result.canceled) {
        return null;
      }

      return result;
    } catch (error) {
      console.error('[FileTransfer] File picker error:', error);
      return null;
    }
  }

  /**
   * Send file to user
   */
  async sendFile(toUser: User, fileUri: string, filename: string, mimeType: string, fromUid: string): Promise<string | null> {
    try {
      console.log('[FileTransfer] Starting file transfer:', filename);

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) {
        console.error('[FileTransfer] File does not exist');
        return null;
      }

      const size = (fileInfo as any).size || 0;
      const transferId = `transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create metadata
      const metadata: FileMetadata = {
        id: transferId,
        filename,
        size,
        mimeType,
        fromUid,
        toUid: toUser.uid,
        timestamp: Date.now(),
      };

      // Create transfer object
      const transfer: FileTransfer = {
        id: transferId,
        metadata,
        progress: 0,
        status: 'pending',
        localUri: fileUri,
      };

      this.activeTransfers.set(transferId, transfer);
      this.notifyProgress(transfer);

      // Send metadata first
      await NetworkService.sendMessage(toUser, {
        id: `file_meta_${transferId}`,
        fromUid: metadata.fromUid,
        toUid: metadata.toUid,
        content: JSON.stringify({ type: 'FILE_METADATA', metadata }),
        timestamp: Date.now(),
        type: 'file',
        status: 'sent',
      });

      // Read and send file in chunks
      transfer.status = 'transferring';
      this.notifyProgress(transfer);

      const fileContent = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const totalChunks = Math.ceil(fileContent.length / CHUNK_SIZE);

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, fileContent.length);
        const chunk = fileContent.substring(start, end);

        // Send chunk
        await NetworkService.sendMessage(toUser, {
          id: `file_chunk_${transferId}_${i}`,
          fromUid: metadata.fromUid,
          toUid: metadata.toUid,
          content: JSON.stringify({
            type: 'FILE_CHUNK',
            transferId,
            chunkIndex: i,
            totalChunks,
            data: chunk,
          }),
          timestamp: Date.now(),
          type: 'file',
          status: 'sent',
        });

        // Update progress
        transfer.progress = ((i + 1) / totalChunks) * 100;
        this.notifyProgress(transfer);

        // Small delay to prevent overwhelming the network
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Mark as completed
      transfer.status = 'completed';
      transfer.progress = 100;
      this.notifyProgress(transfer);
      this.notifyComplete(transfer);

      console.log('[FileTransfer] Transfer completed:', transferId);
      return transferId;
    } catch (error) {
      console.error('[FileTransfer] Send file error:', error);
      const transfer = this.activeTransfers.get(fileUri);
      if (transfer) {
        transfer.status = 'failed';
        transfer.error = String(error);
        this.notifyProgress(transfer);
      }
      return null;
    }
  }

  /**
   * Handle incoming file metadata
   */
  async handleFileMetadata(metadata: FileMetadata): Promise<void> {
    console.log('[FileTransfer] Received file metadata:', metadata.filename);

    const transfer: FileTransfer = {
      id: metadata.id,
      metadata,
      progress: 0,
      status: 'pending',
    };

    this.activeTransfers.set(metadata.id, transfer);
    this.notifyProgress(transfer);
  }

  /**
   * Handle incoming file chunk
   */
  async handleFileChunk(
    transferId: string,
    chunkIndex: number,
    totalChunks: number,
    data: string
  ): Promise<void> {
    const transfer = this.activeTransfers.get(transferId);
    if (!transfer) {
      console.error('[FileTransfer] Transfer not found:', transferId);
      return;
    }

    try {
      // Update status if first chunk
      if (chunkIndex === 0) {
        transfer.status = 'transferring';
      }

      // Store chunk data temporarily
      if (!(transfer as any).chunks) {
        (transfer as any).chunks = new Array(totalChunks);
      }
      (transfer as any).chunks[chunkIndex] = data;

      // Update progress
      transfer.progress = ((chunkIndex + 1) / totalChunks) * 100;
      this.notifyProgress(transfer);

      // Check if all chunks received
      const chunks = (transfer as any).chunks as string[];
      if (chunks.filter(Boolean).length === totalChunks) {
        await this.assembleFile(transfer, chunks);
      }
    } catch (error) {
      console.error('[FileTransfer] Handle chunk error:', error);
      transfer.status = 'failed';
      transfer.error = String(error);
      this.notifyProgress(transfer);
    }
  }

  /**
   * Assemble file from chunks
   */
  private async assembleFile(transfer: FileTransfer, chunks: string[]): Promise<void> {
    try {
      console.log('[FileTransfer] Assembling file:', transfer.metadata.filename);

      // Combine all chunks
      const completeData = chunks.join('');

      // Save to file system
      const filename = `${Date.now()}_${transfer.metadata.filename}`;
      const localUri = `${TRANSFER_DIR}${filename}`;

      await FileSystem.writeAsStringAsync(localUri, completeData, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Update transfer
      transfer.localUri = localUri;
      transfer.status = 'completed';
      transfer.progress = 100;

      // Clean up chunks
      delete (transfer as any).chunks;

      this.notifyProgress(transfer);
      this.notifyComplete(transfer);

      console.log('[FileTransfer] File saved:', localUri);
    } catch (error) {
      console.error('[FileTransfer] Assemble file error:', error);
      transfer.status = 'failed';
      transfer.error = String(error);
      this.notifyProgress(transfer);
    }
  }

  /**
   * Get transfer by ID
   */
  getTransfer(id: string): FileTransfer | undefined {
    return this.activeTransfers.get(id);
  }

  /**
   * Get all transfers
   */
  getAllTransfers(): FileTransfer[] {
    return Array.from(this.activeTransfers.values());
  }

  /**
   * Cancel transfer
   */
  cancelTransfer(id: string): void {
    const transfer = this.activeTransfers.get(id);
    if (transfer && transfer.status !== 'completed') {
      transfer.status = 'cancelled';
      this.notifyProgress(transfer);
      console.log('[FileTransfer] Transfer cancelled:', id);
    }
  }

  /**
   * Delete transfer
   */
  async deleteTransfer(id: string): Promise<void> {
    const transfer = this.activeTransfers.get(id);
    if (transfer?.localUri) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(transfer.localUri);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(transfer.localUri);
        }
      } catch (error) {
        console.error('[FileTransfer] Delete file error:', error);
      }
    }
    this.activeTransfers.delete(id);
  }

  /**
   * Open/share file
   */
  async shareFile(transferId: string): Promise<void> {
    const transfer = this.activeTransfers.get(transferId);
    if (!transfer?.localUri) {
      console.error('[FileTransfer] No file to share');
      return;
    }

    try {
      // Use the sharing API
      await Share.share({
        url: transfer.localUri,
        title: transfer.metadata.filename,
      });
    } catch (error) {
      console.error('[FileTransfer] Share error:', error);
    }
  }

  /**
   * Register progress handler
   */
  onProgress(handler: TransferProgressHandler): () => void {
    this.progressHandlers.add(handler);
    return () => this.progressHandlers.delete(handler);
  }

  /**
   * Register complete handler
   */
  onComplete(handler: TransferCompleteHandler): () => void {
    this.completeHandlers.add(handler);
    return () => this.completeHandlers.delete(handler);
  }

  /**
   * Notify progress handlers
   */
  private notifyProgress(transfer: FileTransfer): void {
    this.progressHandlers.forEach(handler => handler(transfer));
  }

  /**
   * Notify complete handlers
   */
  private notifyComplete(transfer: FileTransfer): void {
    this.completeHandlers.forEach(handler => handler(transfer));
  }

  /**
   * Shutdown service
   */
  shutdown(): void {
    console.log('[FileTransfer] Shutting down');
    this.activeTransfers.clear();
    this.progressHandlers.clear();
    this.completeHandlers.clear();
  }
}

export default new FileTransferService();
