import { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Wifi, WifiOff } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useApp } from "@/context/AppContext";
import { theme } from "@/constants/theme";

export default function OnboardingScreen() {
  const [username, setUsername] = useState<string>("");
  const [selectedMode, setSelectedMode] = useState<"host" | "client" | null>(
    null
  );
  const [error, setError] = useState<string>("");
  const { setupUser } = useApp();
  const router = useRouter();

  const handleContinue = async () => {
    if (!username.trim()) {
      setError("Please enter a username");
      return;
    }

    if (username.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }

    if (!selectedMode) {
      setError("Please select a mode");
      return;
    }

    try {
      await setupUser(username.trim(), selectedMode === "host");
      router.replace("/(tabs)/users");
    } catch (err) {
      setError("Failed to setup user. Please try again.");
      console.error(err);
    }
  };

  return (
    <LinearGradient
      colors={["#007AFF", "#5856D6"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Welcome to P2P Chat</Text>
            <Text style={styles.subtitle}>
              Fast, offline communication for your local network
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Your Username</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={(text) => {
                  setUsername(text);
                  setError("");
                }}
                placeholder="Enter your username"
                placeholderTextColor={theme.colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
              />
            </View>

            <View style={styles.modeContainer}>
              <Text style={styles.label}>Select Mode</Text>
              <View style={styles.modeButtons}>
                <TouchableOpacity
                  style={[
                    styles.modeButton,
                    selectedMode === "host" && styles.modeButtonSelected,
                  ]}
                  onPress={() => {
                    setSelectedMode("host");
                    setError("");
                  }}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.modeIcon,
                      selectedMode === "host" && styles.modeIconSelected,
                    ]}
                  >
                    <Wifi
                      size={32}
                      color={
                        selectedMode === "host" ? "#FFFFFF" : theme.colors.primary
                      }
                    />
                  </View>
                  <Text
                    style={[
                      styles.modeTitle,
                      selectedMode === "host" && styles.modeTextSelected,
                    ]}
                  >
                    Host Network
                  </Text>
                  <Text
                    style={[
                      styles.modeDescription,
                      selectedMode === "host" && styles.modeTextSelected,
                    ]}
                  >
                    Create a hotspot and let others connect
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modeButton,
                    selectedMode === "client" && styles.modeButtonSelected,
                  ]}
                  onPress={() => {
                    setSelectedMode("client");
                    setError("");
                  }}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.modeIcon,
                      selectedMode === "client" && styles.modeIconSelected,
                    ]}
                  >
                    <WifiOff
                      size={32}
                      color={
                        selectedMode === "client" ? "#FFFFFF" : theme.colors.primary
                      }
                    />
                  </View>
                  <Text
                    style={[
                      styles.modeTitle,
                      selectedMode === "client" && styles.modeTextSelected,
                    ]}
                  >
                    Join Network
                  </Text>
                  <Text
                    style={[
                      styles.modeDescription,
                      selectedMode === "client" && styles.modeTextSelected,
                    ]}
                  >
                    Connect to an existing hotspot
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[
                styles.continueButton,
                (!username || !selectedMode) && styles.continueButtonDisabled,
              ]}
              onPress={handleContinue}
              disabled={!username || !selectedMode}
              activeOpacity={0.8}
            >
              <Text style={styles.continueButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              No internet required • Completely offline
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: theme.spacing.lg,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: theme.spacing.xxl,
  },
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: "700" as const,
    color: "#FFFFFF",
    marginBottom: theme.spacing.sm,
    textAlign: "center",
  },
  subtitle: {
    fontSize: theme.fontSize.md,
    color: "#FFFFFF",
    opacity: 0.9,
    textAlign: "center",
  },
  form: {
    gap: theme.spacing.lg,
  },
  inputContainer: {
    gap: theme.spacing.sm,
  },
  label: {
    fontSize: theme.fontSize.md,
    fontWeight: "600" as const,
    color: "#FFFFFF",
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  modeContainer: {
    gap: theme.spacing.sm,
  },
  modeButtons: {
    flexDirection: "row",
    gap: theme.spacing.md,
  },
  modeButton: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  modeButtonSelected: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  modeIcon: {
    width: 64,
    height: 64,
    borderRadius: theme.borderRadius.full,
    backgroundColor: "rgba(0, 122, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  modeIconSelected: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  modeTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: "700" as const,
    color: theme.colors.text,
    textAlign: "center",
  },
  modeDescription: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: "center",
  },
  modeTextSelected: {
    color: "#FFFFFF",
  },
  error: {
    color: "#FFFFFF",
    fontSize: theme.fontSize.sm,
    textAlign: "center",
    backgroundColor: "rgba(255, 59, 48, 0.3)",
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  continueButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: "center",
    marginTop: theme.spacing.md,
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: "700" as const,
    color: theme.colors.primary,
  },
  footer: {
    marginTop: theme.spacing.xxl,
    alignItems: "center",
  },
  footerText: {
    fontSize: theme.fontSize.sm,
    color: "#FFFFFF",
    opacity: 0.8,
  },
});
