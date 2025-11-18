import { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Wifi, WifiOff } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useApp } from "@/context/AppContext";
import { theme } from "@/constants/theme";
import WiFiDirectService, { WiFiDirectDevice, GroupInfo } from "@/services/WiFiDirectService";

export default function OnboardingWifiDirectScreen() {
  const [username, setUsername] = useState<string>("");
  const [selectedMode, setSelectedMode] = useState<"host" | "client" | null>(null);
  const [error, setError] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [availablePeers, setAvailablePeers] = useState<WiFiDirectDevice[]>([]);
  const [isDiscovering, setIsDiscovering] = useState<boolean>(false);

  const router = useRouter();
  const { setupUser } = useApp();

  useEffect(() => {
    // Initialize WiFi Direct
    initializeWiFiDirect();

    return () => {
      WiFiDirectService.removeAllListeners();
    };
  }, []);

  useEffect(() => {
    // Listen for peers changes
    const unsubscribe = WiFiDirectService.onPeersChanged((peers) => {
      console.log("[Onboarding] Peers found:", peers.length);
      setAvailablePeers(peers);
      setIsDiscovering(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    // Listen for connection changes
    const unsubscribe = WiFiDirectService.onConnectionChanged((info) => {
      console.log("[Onboarding] Connection changed:", info);
      
      if (info.connected) {
        Alert.alert(
          "Connected!",
          info.isGroupOwner 
            ? "You are the group owner" 
            : `Connected to ${info.groupOwnerAddress}`,
          [{ text: "OK", onPress: () => router.replace("/(tabs)/users") }]
        );
      }
    });

    return unsubscribe;
  }, []);

  const initializeWiFiDirect = async () => {
    try {
      await WiFiDirectService.initialize();
      console.log("[Onboarding] WiFi Direct initialized");
    } catch (error) {
      console.error("[Onboarding] WiFi Direct init error:", error);
      Alert.alert(
        "Error",
        "Failed to initialize WiFi Direct. Please check your device supports it."
      );
    }
  };

  const handleContinue = async () => {
    if (!username.trim()) {
      setError("Please enter a username");
      return;
    }

    if (!selectedMode) {
      setError("Please select a mode");
      return;
    }

    setIsProcessing(true);
    setError("");

    try {
      if (selectedMode === "host") {
        await handleHostSetup();
      } else {
        await handleClientSetup();
      }
    } catch (error) {
      console.error("[Onboarding] Setup error:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
      setIsProcessing(false);
    }
  };

  const handleHostSetup = async () => {
    try {
      // Create WiFi Direct group
      const groupInfo = await WiFiDirectService.createGroup();
      setGroupInfo(groupInfo);

      // Setup user
      await setupUser(username.trim(), true);

      setIsProcessing(false);

      // Show success
      Alert.alert(
        "Network Created!",
        `Network: ${groupInfo.networkName}\nPassword: ${groupInfo.passphrase}\n\nWaiting for connections...`,
        [{ text: "OK", onPress: () => router.replace("/(tabs)/users") }]
      );
    } catch (error) {
      console.error("[Onboarding] Host setup error:", error);
      setIsProcessing(false);
      Alert.alert("Error", "Failed to create WiFi Direct group");
    }
  };

  const handleClientSetup = async () => {
    try {
      // Setup user first
      await setupUser(username.trim(), false);

      setIsProcessing(false);

      // Start discovering peers
      setIsDiscovering(true);
      await WiFiDirectService.discoverPeers();

      Alert.alert(
        "Searching for Networks",
        "Looking for nearby devices...",
        [{ text: "OK" }]
      );
    } catch (error) {
      console.error("[Onboarding] Client setup error:", error);
      setIsProcessing(false);
      Alert.alert("Error", "Failed to discover peers");
    }
  };

  const handleConnectToPeer = async (device: WiFiDirectDevice) => {
    try {
      Alert.alert(
        "Connect to Device",
        `Connect to ${device.deviceName}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Connect",
            onPress: async () => {
              setIsProcessing(true);
              try {
                await WiFiDirectService.connect(device.deviceAddress);
                console.log("[Onboarding] Connection request sent");
              } catch (error) {
                console.error("[Onboarding] Connection error:", error);
                Alert.alert("Error", "Failed to connect to device");
                setIsProcessing(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error("[Onboarding] Connect error:", error);
    }
  };

  const renderPeerItem = ({ item }: { item: WiFiDirectDevice }) => (
    <TouchableOpacity
      style={styles.peerItem}
      onPress={() => handleConnectToPeer(item)}
    >
      <Wifi size={24} color={theme.colors.primary} />
      <View style={styles.peerInfo}>
        <Text style={styles.peerName}>{item.deviceName}</Text>
        <Text style={styles.peerAddress}>{item.deviceAddress}</Text>
      </View>
      <Text style={styles.connectText}>Connect</Text>
    </TouchableOpacity>
  );

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
            <Text style={styles.title}>WiFi Direct P2P Chat</Text>
            <Text style={styles.subtitle}>
              Fast, automatic device-to-device connection
            </Text>
          </View>

          {!selectedMode && (
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

                <TouchableOpacity
                  style={[styles.modeButton, selectedMode === "host" && styles.modeButtonActive]}
                  onPress={() => setSelectedMode("host")}
                >
                  <Wifi size={32} color={selectedMode === "host" ? theme.colors.primary : "#fff"} />
                  <View style={styles.modeText}>
                    <Text style={styles.modeTitle}>Create Network (Host)</Text>
                    <Text style={styles.modeSubtitle}>
                      Auto-create WiFi Direct group, no manual setup!
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modeButton, selectedMode === "client" && styles.modeButtonActive]}
                  onPress={() => setSelectedMode("client")}
                >
                  <WifiOff size={32} color={selectedMode === "client" ? theme.colors.primary : "#fff"} />
                  <View style={styles.modeText}>
                    <Text style={styles.modeTitle}>Join Network (Client)</Text>
                    <Text style={styles.modeSubtitle}>
                      Discover and connect to nearby devices
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.button, (!username.trim() || !selectedMode) && styles.buttonDisabled]}
                onPress={handleContinue}
                disabled={!username.trim() || !selectedMode || isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Continue</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {selectedMode === "client" && availablePeers.length > 0 && (
            <View style={styles.peersContainer}>
              <Text style={styles.peersTitle}>Available Devices</Text>
              <FlatList
                data={availablePeers}
                renderItem={renderPeerItem}
                keyExtractor={(item) => item.deviceAddress}
                style={styles.peersList}
              />
            </View>
          )}

          {isDiscovering && (
            <View style={styles.discoveringContainer}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.discoveringText}>Searching for devices...</Text>
            </View>
          )}
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
    justifyContent: "center",
    padding: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.8)",
    textAlign: "center",
  },
  form: {
    width: "100%",
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#fff",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  modeContainer: {
    marginBottom: 24,
  },
  modeButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  modeButtonActive: {
    backgroundColor: "#fff",
    borderColor: theme.colors.primary,
  },
  modeText: {
    flex: 1,
    marginLeft: 16,
  },
  modeTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 4,
  },
  modeSubtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
  },
  errorText: {
    color: "#ff6b6b",
    fontSize: 14,
    marginBottom: 16,
    textAlign: "center",
  },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  peersContainer: {
    marginTop: 24,
  },
  peersTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 16,
  },
  peersList: {
    maxHeight: 300,
  },
  peerItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  peerInfo: {
    flex: 1,
    marginLeft: 16,
  },
  peerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  peerAddress: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.7)",
  },
  connectText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.primary,
  },
  discoveringContainer: {
    marginTop: 48,
    alignItems: "center",
  },
  discoveringText: {
    fontSize: 16,
    color: "#fff",
    marginTop: 16,
  },
});
