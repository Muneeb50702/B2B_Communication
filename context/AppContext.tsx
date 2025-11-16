import createContextHook from "@nkzw/create-context-hook";
import { useState, useEffect, useMemo, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type {
  User,
  FriendRequest,
  Message,
  Conversation,
  NetworkPacket,
} from "@/types";
import NetworkService from "@/services/NetworkService";

const STORAGE_KEYS = {
  USER: "user",
  FRIENDS: "friends",
  CONVERSATIONS: "conversations",
  FRIEND_REQUESTS: "friendRequests",
} as const;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const [AppProvider, useApp] = createContextHook(() => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isHost, setIsHost] = useState<boolean>(false);
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  useEffect(() => {
    loadStoredData();
    setupNotifications();
  }, []);

  useEffect(() => {
    if (currentUser && isInitialized) {
      NetworkService.initialize(currentUser, isHost);
      NetworkService.startDiscovery();

      const unsubscribe = NetworkService.onMessage(handleNetworkPacket);

      return () => {
        unsubscribe();
        NetworkService.shutdown();
      };
    }
  }, [currentUser, isHost, isInitialized]);

  const loadStoredData = async () => {
    console.log("[AppContext] Loading stored data");

    try {
      const [userData, friendsData, conversationsData, requestsData] =
        await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.USER),
          AsyncStorage.getItem(STORAGE_KEYS.FRIENDS),
          AsyncStorage.getItem(STORAGE_KEYS.CONVERSATIONS),
          AsyncStorage.getItem(STORAGE_KEYS.FRIEND_REQUESTS),
        ]);

      if (userData) {
        const user = JSON.parse(userData) as User;
        setCurrentUser(user);
        console.log("[AppContext] User loaded:", user.username);
      }

      if (friendsData) {
        setFriends(JSON.parse(friendsData));
      }

      if (conversationsData) {
        setConversations(JSON.parse(conversationsData));
      }

      if (requestsData) {
        setFriendRequests(JSON.parse(requestsData));
      }

      setIsInitialized(true);
    } catch (error) {
      console.error("[AppContext] Failed to load stored data:", error);
      setIsInitialized(true);
    }
  };

  const setupNotifications = async () => {
    if (Platform.OS === "web") {
      console.log("[AppContext] Notifications not available on web");
      return;
    }

    try {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.log("[AppContext] Notification permissions not granted");
      }
    } catch (error) {
      console.error("[AppContext] Failed to setup notifications:", error);
    }
  };

  const handleNetworkPacket = useCallback(
    (packet: NetworkPacket) => {
      console.log("[AppContext] Received packet:", packet.type);

      switch (packet.type) {
        case "DISCOVERY_RESPONSE":
          handleUserDiscovered(packet.from);
          break;

        case "FRIEND_REQUEST":
          handleFriendRequest(packet);
          break;

        case "FRIEND_ACCEPT":
          handleFriendAccept(packet);
          break;

        case "FRIEND_REJECT":
          handleFriendReject(packet);
          break;

        case "MESSAGE":
          handleMessageReceived(packet);
          break;

        case "USER_OFFLINE":
          handleUserOffline(packet.from);
          break;

        case "HEARTBEAT":
          handleHeartbeat(packet.from);
          break;
      }
    },
    [friends, friendRequests, conversations]
  );

  const handleUserDiscovered = (user: User) => {
    console.log("[AppContext] User discovered:", user.username);

    setOnlineUsers((prev) => {
      const exists = prev.find((u) => u.uid === user.uid);
      if (exists) {
        return prev.map((u) => (u.uid === user.uid ? user : u));
      }
      return [...prev, user];
    });
  };

  const handleFriendRequest = async (packet: NetworkPacket) => {
    console.log("[AppContext] Friend request from:", packet.from.username);

    const request: FriendRequest = {
      id: `${packet.from.uid}_${Date.now()}`,
      fromUser: packet.from,
      timestamp: packet.timestamp,
      status: "pending",
    };

    setFriendRequests((prev) => [...prev, request]);

    await AsyncStorage.setItem(
      STORAGE_KEYS.FRIEND_REQUESTS,
      JSON.stringify([...friendRequests, request])
    );

    if (Platform.OS !== "web") {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Friend Request",
          body: `${packet.from.username} wants to connect with you`,
          data: { requestId: request.id },
        },
        trigger: null,
      });
    }
  };

  const handleFriendAccept = async (packet: NetworkPacket) => {
    console.log("[AppContext] Friend request accepted by:", packet.from.username);

    setFriends((prev) => {
      const updated = [...prev, packet.from];
      AsyncStorage.setItem(STORAGE_KEYS.FRIENDS, JSON.stringify(updated));
      return updated;
    });

    setFriendRequests((prev) => {
      const updated = prev.filter((r) => r.fromUser.uid !== packet.from.uid);
      AsyncStorage.setItem(STORAGE_KEYS.FRIEND_REQUESTS, JSON.stringify(updated));
      return updated;
    });
  };

  const handleFriendReject = (packet: NetworkPacket) => {
    console.log("[AppContext] Friend request rejected by:", packet.from.username);

    setFriendRequests((prev) => {
      const updated = prev.filter((r) => r.fromUser.uid !== packet.from.uid);
      AsyncStorage.setItem(STORAGE_KEYS.FRIEND_REQUESTS, JSON.stringify(updated));
      return updated;
    });
  };

  const handleMessageReceived = async (packet: NetworkPacket) => {
    const message = packet.data.message as Message;
    console.log("[AppContext] Message received:", message.id);

    setConversations((prev) => {
      const existingConvIndex = prev.findIndex(
        (c) => c.uid === packet.from.uid
      );

      let updated: Conversation[];

      if (existingConvIndex >= 0) {
        updated = [...prev];
        updated[existingConvIndex] = {
          ...updated[existingConvIndex],
          messages: [...updated[existingConvIndex].messages, message],
          lastMessage: message,
          unreadCount: updated[existingConvIndex].unreadCount + 1,
        };
      } else {
        const newConv: Conversation = {
          uid: packet.from.uid,
          user: packet.from,
          messages: [message],
          unreadCount: 1,
          lastMessage: message,
        };
        updated = [newConv, ...prev];
      }

      AsyncStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(updated));
      return updated;
    });

    if (Platform.OS !== "web") {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: packet.from.username,
          body: message.type === "text" ? message.content : "Sent a file",
          data: { fromUid: packet.from.uid },
        },
        trigger: null,
      });
    }
  };

  const handleUserOffline = (user: User) => {
    console.log("[AppContext] User went offline:", user.username);

    setOnlineUsers((prev) => prev.filter((u) => u.uid !== user.uid));

    if (isHost && Platform.OS !== "web") {
      Notifications.scheduleNotificationAsync({
        content: {
          title: "User Disconnected",
          body: `${user.username} left the network`,
        },
        trigger: null,
      });
    }
  };

  const handleHeartbeat = (user: User) => {
    setOnlineUsers((prev) => {
      const exists = prev.find((u) => u.uid === user.uid);
      if (exists) {
        return prev.map((u) =>
          u.uid === user.uid ? { ...u, lastSeen: Date.now() } : u
        );
      }
      return prev;
    });
  };

  const setupUser = async (username: string, asHost: boolean) => {
    console.log("[AppContext] Setting up user:", { username, asHost });

    const uid = `${username}_${Math.random().toString(36).substr(2, 9)}`;
    const user: User = {
      uid,
      username,
      ipAddress: "0.0.0.0",
      port: 3001,
      status: "online",
      lastSeen: Date.now(),
    };

    setCurrentUser(user);
    setIsHost(asHost);

    await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));

    console.log("[AppContext] User created:", uid);
  };

  const sendFriendRequest = (toUser: User) => {
    console.log("[AppContext] Sending friend request to:", toUser.username);
    NetworkService.sendFriendRequest(toUser);
  };

  const acceptFriendRequest = async (requestId: string) => {
    const request = friendRequests.find((r) => r.id === requestId);
    if (!request) return;

    console.log("[AppContext] Accepting friend request from:", request.fromUser.username);

    NetworkService.acceptFriendRequest(request.fromUser);

    setFriends((prev) => {
      const updated = [...prev, request.fromUser];
      AsyncStorage.setItem(STORAGE_KEYS.FRIENDS, JSON.stringify(updated));
      return updated;
    });

    setFriendRequests((prev) => {
      const updated = prev.filter((r) => r.id !== requestId);
      AsyncStorage.setItem(STORAGE_KEYS.FRIEND_REQUESTS, JSON.stringify(updated));
      return updated;
    });
  };

  const rejectFriendRequest = async (requestId: string) => {
    const request = friendRequests.find((r) => r.id === requestId);
    if (!request) return;

    console.log("[AppContext] Rejecting friend request from:", request.fromUser.username);

    NetworkService.rejectFriendRequest(request.fromUser);

    setFriendRequests((prev) => {
      const updated = prev.filter((r) => r.id !== requestId);
      AsyncStorage.setItem(STORAGE_KEYS.FRIEND_REQUESTS, JSON.stringify(updated));
      return updated;
    });
  };

  const sendMessage = async (toUid: string, content: string) => {
    if (!currentUser) return;

    const friend = friends.find((f) => f.uid === toUid);
    if (!friend) {
      console.error("[AppContext] Cannot send message to non-friend");
      return;
    }

    const message: Message = {
      id: `${currentUser.uid}_${Date.now()}`,
      fromUid: currentUser.uid,
      toUid,
      content,
      timestamp: Date.now(),
      type: "text",
      status: "sending",
    };

    console.log("[AppContext] Sending message:", message.id);

    setConversations((prev) => {
      const existingConvIndex = prev.findIndex((c) => c.uid === toUid);

      let updated: Conversation[];

      if (existingConvIndex >= 0) {
        updated = [...prev];
        updated[existingConvIndex] = {
          ...updated[existingConvIndex],
          messages: [...updated[existingConvIndex].messages, message],
          lastMessage: message,
        };
      } else {
        const newConv: Conversation = {
          uid: toUid,
          user: friend,
          messages: [message],
          unreadCount: 0,
          lastMessage: message,
        };
        updated = [newConv, ...prev];
      }

      AsyncStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(updated));
      return updated;
    });

    NetworkService.sendMessage(friend, message);

    setTimeout(() => {
      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.uid === toUid) {
            return {
              ...conv,
              messages: conv.messages.map((m) =>
                m.id === message.id ? { ...m, status: "sent" } : m
              ),
            };
          }
          return conv;
        })
      );
    }, 500);
  };

  const markConversationAsRead = (uid: string) => {
    setConversations((prev) => {
      const updated = prev.map((c) =>
        c.uid === uid ? { ...c, unreadCount: 0 } : c
      );
      AsyncStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(updated));
      return updated;
    });
  };

  const getConversation = (uid: string): Conversation | undefined => {
    return conversations.find((c) => c.uid === uid);
  };

  const totalUnreadCount = useMemo(() => {
    return conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);
  }, [conversations]);

  const pendingRequestsCount = useMemo(() => {
    return friendRequests.filter((r) => r.status === "pending").length;
  }, [friendRequests]);

  return {
    currentUser,
    isHost,
    onlineUsers,
    friends,
    friendRequests,
    conversations,
    isInitialized,
    totalUnreadCount,
    pendingRequestsCount,
    setupUser,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    sendMessage,
    markConversationAsRead,
    getConversation,
  };
});
