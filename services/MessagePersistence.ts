import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Message } from '@/types';

const STORAGE_KEYS = {
  GROUP_MESSAGES: 'group_messages',
  MESSAGE_HISTORY: 'message_history_',
} as const;

const MAX_MESSAGES_PER_CHAT = 500;
const MAX_GROUP_MESSAGES = 200;

class MessagePersistence {
  /**
   * Save group messages
   */
  async saveGroupMessages(messages: Message[]): Promise<void> {
    try {
      // Keep only recent messages
      const recentMessages = messages.slice(-MAX_GROUP_MESSAGES);
      await AsyncStorage.setItem(
        STORAGE_KEYS.GROUP_MESSAGES,
        JSON.stringify(recentMessages)
      );
      console.log('[MessagePersistence] Saved', recentMessages.length, 'group messages');
    } catch (error) {
      console.error('[MessagePersistence] Failed to save group messages:', error);
    }
  }

  /**
   * Load group messages
   */
  async loadGroupMessages(): Promise<Message[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.GROUP_MESSAGES);
      if (data) {
        const messages = JSON.parse(data) as Message[];
        console.log('[MessagePersistence] Loaded', messages.length, 'group messages');
        return messages;
      }
      return [];
    } catch (error) {
      console.error('[MessagePersistence] Failed to load group messages:', error);
      return [];
    }
  }

  /**
   * Clear group messages
   */
  async clearGroupMessages(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.GROUP_MESSAGES);
      console.log('[MessagePersistence] Cleared group messages');
    } catch (error) {
      console.error('[MessagePersistence] Failed to clear group messages:', error);
    }
  }

  /**
   * Save private chat messages
   */
  async saveChatMessages(uid: string, messages: Message[]): Promise<void> {
    try {
      // Keep only recent messages
      const recentMessages = messages.slice(-MAX_MESSAGES_PER_CHAT);
      const key = STORAGE_KEYS.MESSAGE_HISTORY + uid;
      await AsyncStorage.setItem(key, JSON.stringify(recentMessages));
      console.log('[MessagePersistence] Saved', recentMessages.length, 'messages for', uid);
    } catch (error) {
      console.error('[MessagePersistence] Failed to save chat messages:', error);
    }
  }

  /**
   * Load private chat messages
   */
  async loadChatMessages(uid: string): Promise<Message[]> {
    try {
      const key = STORAGE_KEYS.MESSAGE_HISTORY + uid;
      const data = await AsyncStorage.getItem(key);
      if (data) {
        const messages = JSON.parse(data) as Message[];
        console.log('[MessagePersistence] Loaded', messages.length, 'messages for', uid);
        return messages;
      }
      return [];
    } catch (error) {
      console.error('[MessagePersistence] Failed to load chat messages:', error);
      return [];
    }
  }

  /**
   * Clear chat messages for a user
   */
  async clearChatMessages(uid: string): Promise<void> {
    try {
      const key = STORAGE_KEYS.MESSAGE_HISTORY + uid;
      await AsyncStorage.removeItem(key);
      console.log('[MessagePersistence] Cleared messages for', uid);
    } catch (error) {
      console.error('[MessagePersistence] Failed to clear chat messages:', error);
    }
  }

  /**
   * Clear all message history
   */
  async clearAllMessages(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const messageKeys = keys.filter(
        (key) => 
          key === STORAGE_KEYS.GROUP_MESSAGES || 
          key.startsWith(STORAGE_KEYS.MESSAGE_HISTORY)
      );
      
      if (messageKeys.length > 0) {
        await AsyncStorage.multiRemove(messageKeys);
        console.log('[MessagePersistence] Cleared all messages');
      }
    } catch (error) {
      console.error('[MessagePersistence] Failed to clear all messages:', error);
    }
  }

  /**
   * Get storage stats
   */
  async getStorageStats(): Promise<{ 
    groupMessageCount: number;
    privateChatCount: number;
    totalSize: number;
  }> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const messageKeys = keys.filter(
        (key) => 
          key === STORAGE_KEYS.GROUP_MESSAGES || 
          key.startsWith(STORAGE_KEYS.MESSAGE_HISTORY)
      );

      let groupMessageCount = 0;
      let privateChatCount = 0;
      let totalSize = 0;

      for (const key of messageKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          totalSize += data.length;
          const messages = JSON.parse(data) as Message[];
          
          if (key === STORAGE_KEYS.GROUP_MESSAGES) {
            groupMessageCount = messages.length;
          } else {
            privateChatCount += messages.length;
          }
        }
      }

      return {
        groupMessageCount,
        privateChatCount,
        totalSize,
      };
    } catch (error) {
      console.error('[MessagePersistence] Failed to get storage stats:', error);
      return {
        groupMessageCount: 0,
        privateChatCount: 0,
        totalSize: 0,
      };
    }
  }
}

export default new MessagePersistence();
