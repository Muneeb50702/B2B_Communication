import TcpSocket from 'react-native-tcp-socket';
import RNFS from 'react-native-fs';
import * as MediaLibrary from 'expo-media-library';
import { NETWORK_CONFIG } from '@/constants/network';
import type { User } from '@/types';

export interface FileTransfer {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  from: User;
  to: User;
  progress: number;
  status: 'pending' | 'transferring' | 'completed' | 'failed' | 'cancelled';
  filePath?: string;
}

type TransferCallback = (transfer: FileTransfer) => void;

export class FileTransferService {
  private server: any = null;
  private activeTransfers: Map<string, FileTransfer> = new Map();
  private transferCallbacks: Set<TransferCallback> = new Set();
  private currentUser: User | null = null;

  async startServer(user: User) {
    this.currentUser = user;

    return new Promise<void>((resolve, reject) => {
      try {
        this.server = TcpSocket.createServer((socket: any) => {
          console.log('[FileTransfer] Client connected');
          
          let fileBuffer = Buffer.alloc(0);
          let fileMetadata: any = null;
          let receivedSize = 0;

          socket.on('data', async (data: Buffer) => {
            if (!fileMetadata) {
              // First packet contains metadata
              try {
                const metadataStr = data.toString().split('\n')[0];
                fileMetadata = JSON.parse(metadataStr);
                console.log('[FileTransfer] Receiving file:', fileMetadata.fileName);

                const transfer: FileTransfer = {
                  id: fileMetadata.transferId,
                  fileName: fileMetadata.fileName,
                  fileSize: fileMetadata.fileSize,
                  fileType: fileMetadata.fileType,
                  from: fileMetadata.from,
                  to: this.currentUser!,
                  progress: 0,
                  status: 'transferring',
                };
                this.activeTransfers.set(transfer.id, transfer);
                this.notifyCallbacks(transfer);

                // Remove metadata from data
                const remainingData = data.subarray(data.indexOf(Buffer.from('\n')) + 1);
                if (remainingData.length > 0) {
                  fileBuffer = Buffer.concat([fileBuffer, remainingData]);
                  receivedSize += remainingData.length;
                }
              } catch (error) {
                console.error('[FileTransfer] Failed to parse metadata:', error);
              }
            } else {
              // Subsequent packets contain file data
              fileBuffer = Buffer.concat([fileBuffer, data]);
              receivedSize += data.length;

              // Update progress
              const transfer = this.activeTransfers.get(fileMetadata.transferId);
              if (transfer) {
                transfer.progress = (receivedSize / fileMetadata.fileSize) * 100;
                transfer.status = 'transferring';
                this.notifyCallbacks(transfer);
              }

              // Check if transfer complete
              if (receivedSize >= fileMetadata.fileSize) {
                await this.saveReceivedFile(fileMetadata, fileBuffer);
                socket.destroy();
              }
            }
          });

          socket.on('error', (error: Error) => {
            console.error('[FileTransfer] Socket error:', error);
            if (fileMetadata) {
              const transfer = this.activeTransfers.get(fileMetadata.transferId);
              if (transfer) {
                transfer.status = 'failed';
                this.notifyCallbacks(transfer);
              }
            }
          });

          socket.on('close', () => {
            console.log('[FileTransfer] Transfer complete');
          });
        });

        this.server.listen(
          { port: NETWORK_CONFIG.TCP_FILE_PORT, host: '0.0.0.0' },
          () => {
            console.log('[FileTransfer] Server listening on port', NETWORK_CONFIG.TCP_FILE_PORT);
            resolve();
          }
        );

        this.server.on('error', (error: Error) => {
          console.error('[FileTransfer] Server error:', error);
          reject(error);
        });
      } catch (error) {
        console.error('[FileTransfer] Failed to start server:', error);
        reject(error);
      }
    });
  }

  private async saveReceivedFile(metadata: any, fileBuffer: Buffer) {
    try {
      const transfer = this.activeTransfers.get(metadata.transferId);
      if (!transfer) return;

      // Request media library permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        console.error('[FileTransfer] Media library permission denied');
        transfer.status = 'failed';
        this.notifyCallbacks(transfer);
        return;
      }

      // Save to app's documents directory first
      const tempPath = `${RNFS.DocumentDirectoryPath}/${metadata.fileName}`;
      await RNFS.writeFile(tempPath, fileBuffer.toString('base64'), 'base64');

      // Save to media library (gallery)
      if (metadata.fileType.startsWith('image/') || metadata.fileType.startsWith('video/')) {
        const asset = await MediaLibrary.createAssetAsync(tempPath);
        console.log('[FileTransfer] Saved to gallery:', asset.uri);
        transfer.filePath = asset.uri;
      } else {
        transfer.filePath = tempPath;
      }

      transfer.progress = 100;
      transfer.status = 'completed';
      this.notifyCallbacks(transfer);

      console.log('[FileTransfer] File saved:', transfer.filePath);
    } catch (error) {
      console.error('[FileTransfer] Failed to save file:', error);
      const transfer = this.activeTransfers.get(metadata.transferId);
      if (transfer) {
        transfer.status = 'failed';
        this.notifyCallbacks(transfer);
      }
    }
  }

  async sendFile(toUser: User, fileUri: string, fileName: string, fileType: string): Promise<string | null> {
    if (!this.currentUser || !toUser.ipAddress) {
      console.error('[FileTransfer] Missing user or IP address');
      return null;
    }

    try {
      // Read file
      const fileExists = await RNFS.exists(fileUri);
      if (!fileExists) {
        console.error('[FileTransfer] File does not exist:', fileUri);
        return null;
      }

      const fileStat = await RNFS.stat(fileUri);
      const fileSize = Number(fileStat.size);

      // Create transfer record
      const transferId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const transfer: FileTransfer = {
        id: transferId,
        fileName,
        fileSize,
        fileType,
        from: this.currentUser,
        to: toUser,
        progress: 0,
        status: 'pending',
      };
      this.activeTransfers.set(transferId, transfer);
      this.notifyCallbacks(transfer);

      // Connect to recipient
      const socket = await new Promise<any>((resolve, reject) => {
        const client = TcpSocket.createConnection(
          {
            port: NETWORK_CONFIG.TCP_FILE_PORT,
            host: toUser.ipAddress,
          },
          () => {
            console.log('[FileTransfer] Connected to', toUser.username);
            resolve(client);
          }
        );

        client.on('error', (error: Error) => {
          console.error('[FileTransfer] Connection error:', error);
          reject(error);
        });
      });

      // Send metadata first
      const metadata = {
        transferId,
        fileName,
        fileSize,
        fileType,
        from: this.currentUser,
      };
      socket.write(JSON.stringify(metadata) + '\n');

      // Send file in chunks
      transfer.status = 'transferring';
      this.notifyCallbacks(transfer);

      const fileContent = await RNFS.readFile(fileUri, 'base64');
      const fileBuffer = Buffer.from(fileContent, 'base64');
      
      let sentSize = 0;
      const chunkSize = NETWORK_CONFIG.FILE_CHUNK_SIZE;

      while (sentSize < fileSize) {
        const chunk = fileBuffer.subarray(sentSize, sentSize + chunkSize);
        await new Promise<void>((resolve, reject) => {
          socket.write(chunk, (error: Error) => {
            if (error) reject(error);
            else resolve();
          });
        });

        sentSize += chunk.length;
        transfer.progress = (sentSize / fileSize) * 100;
        this.notifyCallbacks(transfer);
      }

      socket.destroy();

      transfer.status = 'completed';
      transfer.progress = 100;
      this.notifyCallbacks(transfer);

      console.log('[FileTransfer] File sent successfully');
      return transferId;
    } catch (error) {
      console.error('[FileTransfer] Failed to send file:', error);
      const transfer = this.activeTransfers.get('temp');
      if (transfer) {
        transfer.status = 'failed';
        this.notifyCallbacks(transfer);
      }
      return null;
    }
  }

  onTransferUpdate(callback: TransferCallback) {
    this.transferCallbacks.add(callback);
    return () => {
      this.transferCallbacks.delete(callback);
    };
  }

  private notifyCallbacks(transfer: FileTransfer) {
    this.transferCallbacks.forEach(callback => callback(transfer));
  }

  getActiveTransfers(): FileTransfer[] {
    return Array.from(this.activeTransfers.values());
  }

  shutdown() {
    console.log('[FileTransfer] Shutting down');

    if (this.server) {
      try {
        this.server.close();
      } catch (error) {
        console.error('[FileTransfer] Error closing server:', error);
      }
      this.server = null;
    }

    this.activeTransfers.clear();
    this.transferCallbacks.clear();
    this.currentUser = null;
  }
}

export default new FileTransferService();
