import type { User, Message } from '@/types';
import NetworkService from './NetworkService';
import MessagePersistence from './MessagePersistence';

type GroupMessageHandler = (message: Message) => void;

class GroupChatService {
  private groupMessages: Message[] = [];
  private messageHandlers: Set<GroupMessageHandler> = new Set();
  private currentUser: User | null = null;

  /**
   * Initialize group chat
   */
  async initialize(user: User): Promise<void> {
    console.log('[GroupChat] Initializing for user:', user.username);
    this.currentUser = user;
    
    // Load persisted messages
    this.groupMessages = await MessagePersistence.loadGroupMessages();
    console.log('[GroupChat] Loaded', this.groupMessages.length, 'persisted messages');
  }

  /**
   * Send message to group (all online users)
   */
  async sendGroupMessage(content: string): Promise<Message | null> {
    if (!this.currentUser) {
      console.error('[GroupChat] No current user set');
      return null;
    }

    const message: Message = {
      id: `group_${this.currentUser.uid}_${Date.now()}`,
      fromUid: this.currentUser.uid,
      toUid: 'GROUP_CHAT',
      content,
      timestamp: Date.now(),
      type: 'text',
      status: 'sending',
    };

    console.log('[GroupChat] Sending group message:', message.id);

    // Add to local messages
    this.groupMessages.push(message);
    this.notifyHandlers(message);

    // Persist to storage
    await MessagePersistence.saveGroupMessages(this.groupMessages);

    // Broadcast to all online users
    const onlineUsers = NetworkService.getDiscoveredUsers();
    
    for (const user of onlineUsers) {
      try {
        await NetworkService.sendMessage(user, {
          ...message,
          toUid: user.uid,
        });
      } catch (error) {
        console.error('[GroupChat] Failed to send to user:', user.uid, error);
      }
    }

    // Update status
    setTimeout(() => {
      const index = this.groupMessages.findIndex(m => m.id === message.id);
      if (index >= 0) {
        this.groupMessages[index] = { ...message, status: 'sent' };
        this.notifyHandlers(this.groupMessages[index]);
      }
    }, 500);

    return message;
  }

  /**
   * Handle incoming group message
   */
  handleIncomingMessage(message: Message): void {
    // Check if it's for group chat
    if (message.toUid !== 'GROUP_CHAT' && message.toUid !== this.currentUser?.uid) {
      return;
    }

    console.log('[GroupChat] Received group message:', message.id);

    // Avoid duplicates
    const exists = this.groupMessages.find(m => m.id === message.id);
    if (exists) {
      return;
    }

    // Add to messages
    this.groupMessages.push(message);
    this.notifyHandlers(message);

    // Persist to storage
    MessagePersistence.saveGroupMessages(this.groupMessages);
  }

  /**
   * Get all group messages
   */
  getMessages(): Message[] {
    return [...this.groupMessages].sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Clear all messages
   */
  clearMessages(): void {
    console.log('[GroupChat] Clearing all messages');
    this.groupMessages = [];
    MessagePersistence.clearGroupMessages();
  }

  /**
   * Register message handler
   */
  onMessage(handler: GroupMessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  /**
   * Notify all handlers
   */
  private notifyHandlers(message: Message): void {
    this.messageHandlers.forEach(handler => handler(message));
  }

  /**
   * Get message count
   */
  getMessageCount(): number {
    return this.groupMessages.length;
  }

  /**
   * Shutdown service
   */
  shutdown(): void {
    console.log('[GroupChat] Shutting down');
    this.groupMessages = [];
    this.messageHandlers.clear();
    this.currentUser = null;
  }
}

export default new GroupChatService();
