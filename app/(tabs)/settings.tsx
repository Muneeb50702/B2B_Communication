import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Wifi, User, LogOut, Smartphone, Trash2 } from "lucide-react-native";
import { useApp } from "@/context/AppContext";
import { theme } from "@/constants/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MessagePersistence from "@/services/MessagePersistence";

export default function SettingsScreen() {
  const { currentUser, isHost, friends } = useApp();
  const router = useRouter();

  const handleLogout = () => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm("Are you sure you want to log out?");
      if (confirmed) {
        performLogout();
      }
    } else {
      Alert.alert("Log Out", "Are you sure you want to log out?", [
        { text: "Cancel", style: "cancel" },
        { text: "Log Out", style: "destructive", onPress: performLogout },
      ]);
    }
  };

  const performLogout = async () => {
    try {
      await AsyncStorage.multiRemove([
        "user",
        "friends",
        "conversations",
        "friendRequests",
      ]);
      router.replace("/onboarding");
    } catch (error) {
      console.error("Failed to logout:", error);
    }
  };

  const handleClearMessages = () => {
    Alert.alert(
      "Clear Message History",
      "This will delete all chat history. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Clear All", 
          style: "destructive", 
          onPress: async () => {
            try {
              await MessagePersistence.clearAllMessages();
              Alert.alert("Success", "All message history has been cleared");
            } catch (error) {
              console.error("Failed to clear messages:", error);
              Alert.alert("Error", "Failed to clear message history");
            }
          }
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Settings",
        }}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <View style={styles.card}>
            <View style={styles.profileHeader}>
              <View style={styles.avatar}>
                <User size={32} color={theme.colors.primary} />
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.username}>{currentUser?.username}</Text>
                <Text style={styles.uid}>{currentUser?.uid}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Network</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Wifi size={20} color={theme.colors.primary} />
              <Text style={styles.label}>Mode</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {isHost ? "Host" : "Client"}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.row}>
              <Smartphone size={20} color={theme.colors.primary} />
              <Text style={styles.label}>Platform</Text>
              <Text style={styles.value}>{Platform.OS}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.row}>
              <User size={20} color={theme.colors.primary} />
              <Text style={styles.label}>Friends</Text>
              <Text style={styles.value}>{friends.length}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.row}
              onPress={handleClearMessages}
              activeOpacity={0.7}
            >
              <Trash2 size={20} color={theme.colors.danger} />
              <Text style={[styles.label, { color: theme.colors.danger }]}>
                Clear Message History
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            <Text style={styles.aboutText}>
              P2P Chat enables fast, offline communication over local WiFi
              networks. Perfect for scenarios where internet is unavailable or
              not needed.
            </Text>
            {Platform.OS === "web" && (
              <>
                <View style={styles.divider} />
                <Text style={styles.warningText}>
                  ⚠️ Web preview has limited networking features. For full P2P
                  functionality, use a native build with react-native-udp and
                  react-native-tcp-socket.
                </Text>
              </>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <LogOut size={20} color={theme.colors.danger} />
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.md,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: "600" as const,
    color: theme.colors.textSecondary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
  },
  card: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: theme.borderRadius.full,
    backgroundColor: "rgba(0, 122, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: theme.spacing.md,
  },
  profileInfo: {
    flex: 1,
  },
  username: {
    fontSize: theme.fontSize.lg,
    fontWeight: "700" as const,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  uid: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
  },
  label: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    marginLeft: theme.spacing.sm,
    flex: 1,
  },
  value: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    fontWeight: "600" as const,
  },
  badge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  badgeText: {
    fontSize: theme.fontSize.xs,
    fontWeight: "700" as const,
    color: "#FFFFFF",
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.sm,
  },
  aboutText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  warningText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.warning,
    lineHeight: 20,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xl,
  },
  logoutButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: "600" as const,
    color: theme.colors.danger,
  },
});
