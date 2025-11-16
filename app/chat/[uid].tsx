import { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { Send, Paperclip } from "lucide-react-native";
import { useApp } from "@/context/AppContext";
import { theme } from "@/constants/theme";
import type { Message } from "@/types";

export default function ChatScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const {
    currentUser,
    getConversation,
    sendMessage,
    markConversationAsRead,
  } = useApp();

  const [messageText, setMessageText] = useState<string>("");
  const flatListRef = useRef<FlatList>(null);

  const conversation = getConversation(uid as string);

  useEffect(() => {
    if (conversation) {
      markConversationAsRead(uid as string);
    }
  }, [uid, conversation]);

  const handleSend = async () => {
    if (!messageText.trim()) return;

    await sendMessage(uid as string, messageText.trim());
    setMessageText("");

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.fromUid === currentUser?.uid;

    return (
      <View
        style={[
          styles.messageContainer,
          isMe ? styles.messageContainerMe : styles.messageContainerOther,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isMe ? styles.messageBubbleMe : styles.messageBubbleOther,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isMe ? styles.messageTextMe : styles.messageTextOther,
            ]}
          >
            {item.content}
          </Text>
          <View style={styles.messageFooter}>
            <Text
              style={[
                styles.messageTime,
                isMe ? styles.messageTimeMe : styles.messageTimeOther,
              ]}
            >
              {formatTime(item.timestamp)}
            </Text>
            {isMe && (
              <Text
                style={[
                  styles.messageStatus,
                  item.status === "sent" && styles.messageStatusSent,
                ]}
              >
                {item.status === "sending" ? "•" : "✓"}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  if (!conversation) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: "Chat",
          }}
        />
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>Conversation not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: conversation.user.username,
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {conversation.messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              No messages yet. Start the conversation!
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={conversation.messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: false })
            }
          />
        )}

        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.attachButton} activeOpacity={0.7}>
            <Paperclip size={24} color={theme.colors.primary} />
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            value={messageText}
            onChangeText={setMessageText}
            placeholder="Type a message..."
            placeholderTextColor={theme.colors.textSecondary}
            multiline
            maxLength={1000}
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              !messageText.trim() && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!messageText.trim()}
            activeOpacity={0.7}
          >
            <Send
              size={20}
              color={messageText.trim() ? "#FFFFFF" : theme.colors.textTertiary}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  messagesList: {
    padding: theme.spacing.md,
  },
  messageContainer: {
    marginBottom: theme.spacing.sm,
    maxWidth: "80%",
  },
  messageContainerMe: {
    alignSelf: "flex-end",
  },
  messageContainerOther: {
    alignSelf: "flex-start",
  },
  messageBubble: {
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
  },
  messageBubbleMe: {
    backgroundColor: theme.colors.primary,
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: theme.fontSize.md,
    lineHeight: 20,
  },
  messageTextMe: {
    color: "#FFFFFF",
  },
  messageTextOther: {
    color: theme.colors.text,
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  messageTime: {
    fontSize: theme.fontSize.xs,
  },
  messageTimeMe: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  messageTimeOther: {
    color: theme.colors.textSecondary,
  },
  messageStatus: {
    fontSize: theme.fontSize.xs,
    color: "rgba(255, 255, 255, 0.7)",
  },
  messageStatusSent: {
    color: "rgba(255, 255, 255, 0.9)",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  attachButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.backgroundSecondary,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.xxl,
  },
  emptyStateText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    textAlign: "center",
  },
});
