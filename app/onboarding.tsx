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
  Alert,
  Linking,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Wifi, WifiOff, QrCode } from "lucide-react-native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { useApp } from "@/context/AppContext";
import { theme } from "@/constants/theme";
import WiFiManager from "@/services/WiFiManager";
import WiFiDirectService from "@/services/WiFiDirectService";
import MeshCoordinator from "@/services/mesh/MeshCoordinator";
import QRCodeService from "@/services/QRCodeService";
import QRDisplayModal from "@/components/QRDisplayModal";
import QRScannerModal from "@/components/QRScannerModal";
import type { QRData } from "@/services/QRCodeService";

export default function OnboardingScreen() {
  const [username, setUsername] = useState<string>("");
  const [selectedMode, setSelectedMode] = useState<"host" | "client" | null>(
    null
  );
  const [error, setError] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showQRDisplay, setShowQRDisplay] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [qrData, setQrData] = useState<string>("");
  const [hotspotInfo, setHotspotInfo] = useState<QRData | null>(null);
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

    setIsProcessing(true);
    setError("");

    try {
      if (selectedMode === "host") {
        await handleHostSetup();
      } else {
        await handleClientSetup();
      }
    } catch (err) {
      console.error('[Onboarding] Setup failed:', err);
      setError("Setup failed. Please try again.");
      setIsProcessing(false);
    }
  };

  const handleHostSetup = async () => {
    try {
      // Check WiFi permissions
      const hasPermissions = await WiFiManager.requestPermissions();
      
      if (!hasPermissions) {
        Alert.alert(
          'Permissions Required',
          'WiFi and location permissions are needed to create WiFi Direct network.',
          [
            { text: 'Cancel', onPress: () => setIsProcessing(false) },
            { text: 'Open Settings', onPress: () => openSettings() },
          ]
        );
        return;
      }

      // Check if WiFi is enabled
      const wifiEnabled = await WiFiManager.isWifiEnabled();
      
      if (!wifiEnabled) {
        Alert.alert(
          'Enable WiFi',
          'Please enable WiFi to create WiFi Direct network.',
          [
            { text: 'Cancel', onPress: () => setIsProcessing(false) },
            {
              text: 'Enable WiFi',
              onPress: async () => {
                const enabled = await WiFiManager.enableWifi();
                if (enabled) {
                  await proceedWithHostSetup();
                } else {
                  setError('Failed to enable WiFi. Please enable it manually.');
                  setIsProcessing(false);
                }
              },
            },
          ]
        );
        return;
      }

      // Check if mobile hotspot is enabled
      await WiFiDirectService.initialize();
      const hotspotEnabled = await WiFiDirectService.isHotspotEnabled();
      
      if (hotspotEnabled) {
        Alert.alert(
          'Turn OFF Mobile Hotspot',
          'WiFi Direct cannot work when mobile hotspot is enabled. Please turn it off in your device settings.',
          [
            { text: 'Cancel', onPress: () => setIsProcessing(false) },
            { 
              text: 'Open Settings', 
              onPress: () => {
                openSettings();
                setIsProcessing(false);
              }
            },
          ]
        );
        return;
      }

      await proceedWithHostSetup();
    } catch (error) {
      console.error('[Onboarding] Host setup error:', error);
      throw error;
    }
  };

  const proceedWithHostSetup = async () => {
    try {
      // Initialize Mesh Network as HOST
      console.log('[Onboarding] Initializing mesh network as host...');
      
      await MeshCoordinator.initialize({
        deviceName: username.trim(),
        maxClientsPerHost: 7,
        hostMeshConnections: 2,
        discoveryInterval: 15000,
        autoElection: true,
      });

      // Listen for when host is ready (with timeout)
      const hostReadyPromise = new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Host setup timeout - taking too long'));
        }, 30000); // 30 second timeout
        
        MeshCoordinator.once('hostReady', (groupInfo) => {
          clearTimeout(timeout);
          resolve(groupInfo);
        });
      });

      // Wait for host to be ready
      const groupInfo = await hostReadyPromise;
      
      console.log('[Onboarding] Mesh host ready:', groupInfo);

      // Generate QR code with WiFi Direct info
      const qrInfo: QRData = {
        type: 'MXB_CONNECT_P2P',
        ssid: groupInfo.networkName,
        password: groupInfo.passphrase,
        hostName: username.trim(),
        version: '2.0', // P2P version
      };

      const qrString = QRCodeService.generateQRData({
        ssid: groupInfo.networkName,
        password: groupInfo.passphrase
      }, username.trim());
      
      setQrData(qrString);
      setHotspotInfo(qrInfo);
      
      // Setup user
      await setupUser(username.trim(), true);
      
      setIsProcessing(false);
      
      // Show QR code modal
      Alert.alert(
        'Mesh Network Host Created',
        `Network: ${groupInfo.networkName}\nPassword: ${groupInfo.passphrase}\n\n✅ Mesh host ready!\n📡 Auto-discovering peers...\nShow QR code to others to join.`,
        [
          {
            text: 'Show QR Code',
            onPress: () => setShowQRDisplay(true),
          },
          {
            text: 'Continue',
            onPress: () => router.replace("/(tabs)/users"),
          },
        ]
      );
    } catch (error: any) {
      console.error('[Onboarding] Mesh host setup error:', error);
      setIsProcessing(false);
      
      // Better error messages
      let errorMessage = 'Failed to create mesh network host.';
      
      if (error.message?.includes('busy')) {
        errorMessage = 'WiFi Direct is busy. Please:\n1. Turn OFF mobile hotspot\n2. Disconnect from any WiFi networks\n3. Try again';
      } else if (error.message?.includes('unsupported')) {
        errorMessage = 'WiFi Direct is not supported on this device.';
      } else if (error.message?.includes('timeout')) {
        errorMessage = 'Host setup is taking longer than expected. This may be normal - try continuing anyway.';
      }
      
      Alert.alert(
        'Error',
        errorMessage,
        [{ text: 'OK' }]
      );
      throw error;
    }
  };

  const handleClientSetup = async () => {
    try {
      // Check WiFi permissions
      const hasPermissions = await WiFiManager.requestPermissions();
      
      if (!hasPermissions) {
        Alert.alert(
          'Permissions Required',
          'WiFi and location permissions are needed to scan networks.',
          [
            { text: 'Cancel', onPress: () => setIsProcessing(false) },
            { text: 'Open Settings', onPress: () => openSettings() },
          ]
        );
        return;
      }

      // Check if WiFi is enabled
      const wifiEnabled = await WiFiManager.isWifiEnabled();
      
      if (!wifiEnabled) {
        Alert.alert(
          'Enable WiFi',
          'Please enable WiFi to scan for networks.',
          [
            { text: 'Cancel', onPress: () => setIsProcessing(false) },
            {
              text: 'Enable WiFi',
              onPress: async () => {
                const enabled = await WiFiManager.enableWifi();
                if (enabled) {
                  await proceedWithClientSetup();
                } else {
                  setError('Failed to enable WiFi. Please enable it manually.');
                  setIsProcessing(false);
                }
              },
            },
          ]
        );
        return;
      }

      // Check if mobile hotspot is enabled
      await WiFiDirectService.initialize();
      const hotspotEnabled = await WiFiDirectService.isHotspotEnabled();
      
      if (hotspotEnabled) {
        Alert.alert(
          'Turn OFF Mobile Hotspot',
          'WiFi Direct cannot work when mobile hotspot is enabled. Please turn it off in your device settings.',
          [
            { text: 'Cancel', onPress: () => setIsProcessing(false) },
            { 
              text: 'Open Settings', 
              onPress: () => {
                openSettings();
                setIsProcessing(false);
              }
            },
          ]
        );
        return;
      }

      await proceedWithClientSetup();
    } catch (error) {
      console.error('[Onboarding] Client setup error:', error);
      throw error;
    }
  };

  const proceedWithClientSetup = async () => {
    try {
      // Initialize Mesh Network as CLIENT (with auto-election)
      console.log('[Onboarding] Initializing mesh network as client...');
      
      await MeshCoordinator.initialize({
        deviceName: username.trim(),
        maxClientsPerHost: 7,
        hostMeshConnections: 2,
        discoveryInterval: 15000,
        autoElection: true, // Will auto-promote to host if needed
      });

      // Listen for role changes
      MeshCoordinator.on('roleChanged', ({ role, reason }) => {
        console.log('[Onboarding] Role changed:', role, reason);
        Alert.alert(
          'Role Updated',
          `Your device is now: ${role.toUpperCase()}\nReason: ${reason}`
        );
      });

      // Listen for successful client connection
      MeshCoordinator.once('clientConnected', ({ hostId }) => {
        console.log('[Onboarding] Connected to mesh host:', hostId);
        Alert.alert(
          'Connected!',
          `✅ Connected to mesh network!\n🕸️ You are now part of the mesh.`,
          [
            {
              text: 'Continue',
              onPress: () => router.replace("/(tabs)/users"),
            },
          ]
        );
      });

      // Listen for if we become host instead
      MeshCoordinator.once('hostReady', (groupInfo) => {
        console.log('[Onboarding] Promoted to mesh host:', groupInfo);
        Alert.alert(
          'Now Hosting!',
          `📡 No hosts available - you became a host!\nNetwork: ${groupInfo.networkName}`,
          [
            {
              text: 'Continue',
              onPress: () => router.replace("/(tabs)/users"),
            },
          ]
        );
      });
      
      // Setup user
      await setupUser(username.trim(), false);
      
      setIsProcessing(false);
      
      // Show options: scan QR or let auto-discovery work
      Alert.alert(
        'Join Mesh Network',
        '🕸️ Auto-discovery active!\nSearching for available hosts...\n\nOr scan QR code to join directly.',
        [
          {
            text: 'Scan QR Code',
            onPress: () => setShowQRScanner(true),
          },
          {
            text: 'Wait for Discovery',
            onPress: () => {
              Alert.alert(
                'Discovering...',
                '📡 Scanning for mesh hosts...\nYou will be notified when connected.',
                [{ text: 'OK', onPress: () => router.replace("/(tabs)/users") }]
              );
            },
          },
        ]
      );
    } catch (error) {
      console.error('[Onboarding] Mesh client setup error:', error);
      throw error;
    }
  };

  const discoverWiFiDirectPeers = async () => {
    try {
      setIsProcessing(true);
      
      console.log('[Onboarding] Starting WiFi Direct peer discovery...');
      
      // Start discovering peers
      await WiFiDirectService.discoverPeers();
      
      // Listen for discovered peers
      const peers: any[] = [];
      
      WiFiDirectService.onPeersChanged((discoveredPeers) => {
        console.log('[Onboarding] Peers discovered:', discoveredPeers);
        peers.push(...discoveredPeers);
      });
      
      // Wait 10 seconds for discovery
      setTimeout(() => {
        WiFiDirectService.stopPeerDiscovery();
        setIsProcessing(false);
        
        if (peers.length === 0) {
          Alert.alert(
            'No Networks Found',
            'No WiFi Direct networks found nearby. Please:\n1. Make sure host has created network\n2. Try scanning QR code instead',
            [{ text: 'OK' }]
          );
          return;
        }
        
        // Show available peers
        showPeersList(peers);
      }, 10000);
      
      // Show discovery in progress
      Alert.alert(
        'Discovering Networks',
        'Searching for WiFi Direct networks nearby...\nThis will take about 10 seconds.',
        [
          {
            text: 'Cancel',
            onPress: () => {
              WiFiDirectService.stopPeerDiscovery();
              setIsProcessing(false);
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('[Onboarding] WiFi Direct discovery error:', error);
      setIsProcessing(false);
      Alert.alert(
        'Error',
        'Failed to discover networks. Please try scanning QR code instead.',
        [{ text: 'OK' }]
      );
    }
  };

  const showPeersList = (peers: any[]) => {
    // Filter out duplicates by device address
    const uniquePeers = peers.filter((peer, index, self) =>
      index === self.findIndex((p) => p.deviceAddress === peer.deviceAddress)
    );
    
    if (uniquePeers.length === 0) {
      Alert.alert(
        'No Networks Found',
        'No WiFi Direct networks found. Try scanning QR code.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    Alert.alert(
      'Available Networks',
      `Found ${uniquePeers.length} network(s). Select one to connect:`,
      [
        ...uniquePeers.map(peer => ({
          text: `${peer.deviceName} (${peer.status === 0 ? 'Available' : 'Busy'})`,
          onPress: () => connectToWiFiDirectPeer(peer.deviceAddress),
        })),
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const connectToWiFiDirectPeer = async (deviceAddress: string) => {
    try {
      setIsProcessing(true);
      
      console.log('[Onboarding] Connecting to peer:', deviceAddress);
      
      // Listen for connection changes
      WiFiDirectService.onConnectionChanged(async (info) => {
        if (info.connected) {
          console.log('[Onboarding] Connected to WiFi Direct network!');
          
          setIsProcessing(false);
          
          Alert.alert(
            'Connected',
            'Successfully connected to WiFi Direct network!',
            [{ text: 'OK', onPress: () => router.replace("/(tabs)/users") }]
          );
        }
      });
      
      // Initiate connection
      await WiFiDirectService.connect(deviceAddress);
      
      // Show connection prompt
      Alert.alert(
        'Connection Requested',
        'Connection request sent. Waiting for host to accept...',
        [
          {
            text: 'Cancel',
            onPress: () => {
              setIsProcessing(false);
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('[Onboarding] WiFi Direct connection error:', error);
      setIsProcessing(false);
      Alert.alert(
        'Connection Failed',
        'Failed to connect to network. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleQRScan = async (data: QRData) => {
    try {
      console.log('[Onboarding] QR scanned, type:', data.type);
      
      if (data.type === 'MXB_CONNECT_P2P') {
        // WiFi Direct connection - we need to discover and connect
        console.log('[Onboarding] WiFi Direct QR code detected');
        
        Alert.alert(
          'WiFi Direct Network',
          'This is a WiFi Direct network. The app will search for the network and connect automatically.',
          [
            {
              text: 'OK',
              onPress: async () => {
                setShowQRScanner(false);
                // Start discovery to find the host
                await discoverWiFiDirectPeers();
              }
            }
          ]
        );
        
      } else {
        // Legacy hotspot connection
        console.log('[Onboarding] Legacy hotspot connection to:', data.ssid);
        
        const connected = await WiFiManager.connectToNetwork(data.ssid, data.password);
        
        if (connected) {
          Alert.alert(
            'Connected',
            `Successfully connected to ${data.ssid}`,
            [{ text: 'OK', onPress: () => router.replace("/(tabs)/users") }]
          );
        } else {
          Alert.alert(
            'Connection Failed',
            'Could not connect to the network. Please check the QR code and try again.',
            [
              { text: 'Scan Again', onPress: () => setShowQRScanner(true) },
              { text: 'Cancel', onPress: () => router.replace("/(tabs)/users") },
            ]
          );
        }
      }
    } catch (error) {
      console.error('[Onboarding] QR scan connection error:', error);
      Alert.alert(
        'Error',
        'Failed to connect to network.',
        [{ text: 'OK', onPress: () => router.replace("/(tabs)/users") }]
      );
    }
  };

  const openSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
    setIsProcessing(false);
  };

  const showAvailableNetworks = async () => {
    try {
      setIsProcessing(true);
      
      // Request location permission if needed
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Location permission is needed to scan WiFi networks.',
          [
            { text: 'Cancel', onPress: () => setIsProcessing(false) },
            { text: 'Open Settings', onPress: openSettings }
          ]
        );
        return;
      }

      // Get available networks
      const networks = await WiFiManager.getAvailableNetworks();
      setIsProcessing(false);

      if (!networks || networks.length === 0) {
        Alert.alert(
          'No Networks Found',
          'Could not find any available networks. Please try scanning a QR code instead.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Filter for B2B networks
      const b2bNetworks = networks.filter(network => 
        network.ssid?.startsWith('B2B-')
      );

      if (b2bNetworks.length === 0) {
        Alert.alert(
          'No B2B Networks',
          'No B2B Chat networks found nearby. Please try scanning a QR code or wait for a host to create a network.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Show network selection
      Alert.alert(
        'Available Networks',
        'Select a network to join:',
        [
          ...b2bNetworks.map(network => ({
            text: `${network.ssid} (Signal: ${Math.abs(network.level || 0)}%)`,
            onPress: async () => {
              // Prompt for password
              Alert.prompt(
                'Enter Password',
                `Enter the password for ${network.ssid}`,
                async (password) => {
                  if (password) {
                    try {
                      const connected = await WiFiManager.connectToNetwork(network.ssid!, password);
                      if (connected) {
                        Alert.alert(
                          'Connected',
                          `Successfully connected to ${network.ssid}`,
                          [{ text: 'OK', onPress: () => router.replace("/(tabs)/users") }]
                        );
                      } else {
                        Alert.alert('Error', 'Failed to connect. Please check the password.');
                      }
                    } catch (error) {
                      console.error('[Onboarding] Network connection error:', error);
                      Alert.alert('Error', 'Failed to connect to network.');
                    }
                  }
                },
                'secure-text'
              );
            }
          })),
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } catch (error) {
      console.error('[Onboarding] Browse networks error:', error);
      setIsProcessing(false);
      Alert.alert(
        'Error',
        'Failed to scan for networks. Please try again or scan a QR code.',
        [{ text: 'OK' }]
      );
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
                (!username || !selectedMode || isProcessing) && styles.continueButtonDisabled,
              ]}
              onPress={handleContinue}
              disabled={!username || !selectedMode || isProcessing}
              activeOpacity={0.8}
            >
              {isProcessing ? (
                <ActivityIndicator color={theme.colors.primary} />
              ) : (
                <Text style={styles.continueButtonText}>Continue</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              No internet required • Completely offline
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {hotspotInfo && (
        <QRDisplayModal
          visible={showQRDisplay}
          qrData={qrData}
          hotspotInfo={hotspotInfo}
          onClose={() => setShowQRDisplay(false)}
        />
      )}

      <QRScannerModal
        visible={showQRScanner}
        onClose={() => {
          setShowQRScanner(false);
          router.replace("/(tabs)/users");
        }}
        onScan={handleQRScan}
      />
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
