import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Stack } from "expo-router";
import { Users as UsersIcon, Bell } from "lucide-react-native";
import { useApp } from "@/context/AppContext";
import { theme } from "@/constants/theme";
import type { User } from "@/types";

export default function UsersScreen() {
  const {
    onlineUsers,
    friends,
    sendFriendRequest,
    friendRequests,
    pendingRequestsCount,
    acceptFriendRequest,
    rejectFriendRequest,
  } = useApp();

  const isFriend = (user: User) => {
    return friends.some((f) => f.uid === user.uid);
  };

  const hasPendingRequest = (user: User) => {
    return friendRequests.some(
      (r) => r.fromUser.uid === user.uid && r.status === "pending"
    );
  };

  const renderUser = ({ item }: { item: User }) => {
    const isAlreadyFriend = isFriend(item);
    const hasPending = hasPendingRequest(item);

    return (
      <View style={styles.userCard}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <UsersIcon size={24} color={theme.colors.primary} />
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.username}>{item.username}</Text>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: theme.colors.online },
                ]}
              />
              <Text style={styles.statusText}>Online</Text>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          {isAlreadyFriend ? (
            <View style={styles.friendBadge}>
              <Text style={styles.friendBadgeText}>Friend</Text>
            </View>
          ) : hasPending ? (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>Pending</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => sendFriendRequest(item)}
              activeOpacity={0.7}
            >
              <Text style={styles.addButtonText}>Add Friend</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderRequest = ({ item }: { item: any }) => {
    return (
      <View style={styles.requestCard}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <UsersIcon size={24} color={theme.colors.primary} />
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.username}>{item.fromUser.username}</Text>
            <Text style={styles.requestText}>Wants to connect</Text>
          </View>
        </View>

        <View style={styles.requestActions}>
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => acceptFriendRequest(item.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.acceptButtonText}>Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.rejectButton}
            onPress={() => rejectFriendRequest(item.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.rejectButtonText}>Reject</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const pendingRequests = friendRequests.filter((r) => r.status === "pending");

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Online Users",
          headerRight: () =>
            pendingRequestsCount > 0 ? (
              <View style={styles.notificationBadge}>
                <Bell size={20} color={theme.colors.primary} />
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{pendingRequestsCount}</Text>
                </View>
              </View>
            ) : null,
        }}
      />

      {pendingRequests.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Friend Requests</Text>
          <FlatList
            data={pendingRequests}
            keyExtractor={(item) => item.id}
            renderItem={renderRequest}
            scrollEnabled={false}
          />
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Online Users ({onlineUsers.length})
        </Text>
        {onlineUsers.length === 0 ? (
          <View style={styles.emptyState}>
            <UsersIcon size={48} color={theme.colors.textTertiary} />
            <Text style={styles.emptyStateTitle}>No users online</Text>
            <Text style={styles.emptyStateText}>
              {Platform.OS === "web"
                ? "Web preview has limited networking"
                : "Connect to the same WiFi network to see other users"}
            </Text>
          </View>
        ) : (
          <FlatList
            data={onlineUsers}
            keyExtractor={(item) => item.uid}
            renderItem={renderUser}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  section: {
    padding: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: "700" as const,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  userCard: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  requestCard: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.full,
    backgroundColor: "rgba(0, 122, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: theme.spacing.sm,
  },
  userDetails: {
    flex: 1,
  },
  username: {
    fontSize: theme.fontSize.md,
    fontWeight: "600" as const,
    color: theme.colors.text,
    marginBottom: 2,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: theme.borderRadius.full,
    marginRight: theme.spacing.xs,
  },
  statusText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  requestText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  actions: {
    marginLeft: theme.spacing.sm,
  },
  addButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  addButtonText: {
    fontSize: theme.fontSize.sm,
    fontWeight: "600" as const,
    color: "#FFFFFF",
  },
  friendBadge: {
    backgroundColor: theme.colors.success,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  friendBadgeText: {
    fontSize: theme.fontSize.sm,
    fontWeight: "600" as const,
    color: "#FFFFFF",
  },
  pendingBadge: {
    backgroundColor: theme.colors.warning,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  pendingBadgeText: {
    fontSize: theme.fontSize.sm,
    fontWeight: "600" as const,
    color: "#FFFFFF",
  },
  requestActions: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  acceptButton: {
    backgroundColor: theme.colors.success,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  acceptButtonText: {
    fontSize: theme.fontSize.sm,
    fontWeight: "600" as const,
    color: "#FFFFFF",
  },
  rejectButton: {
    backgroundColor: theme.colors.danger,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  rejectButtonText: {
    fontSize: theme.fontSize.sm,
    fontWeight: "600" as const,
    color: "#FFFFFF",
  },
  emptyState: {
    alignItems: "center",
    padding: theme.spacing.xxl,
  },
  emptyStateTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: "600" as const,
    color: theme.colors.text,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  emptyStateText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: "center",
  },
  notificationBadge: {
    position: "relative",
    marginRight: theme.spacing.md,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: theme.colors.danger,
    borderRadius: theme.borderRadius.full,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: "#FFFFFF",
  },
});
