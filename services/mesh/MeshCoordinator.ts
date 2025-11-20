/**
 * MeshCoordinator - Main orchestrator for hybrid mesh network
 * Manages role transitions, connections, and message routing
 */

import { EventEmitter } from 'events';
import WiFiDirectService from '../WiFiDirectService';
import RoleManager, { NodeRole, RoleDecision, NetworkState } from './RoleManager';
import TopologyManager from './TopologyManager';
import MeshRoutingService, { RoutedMessage } from './MeshRoutingService';
import { MeshNode, createMeshNode } from './MeshTypes';
import { nanoid } from 'nanoid';

export interface MeshConfig {
  deviceId?: string;
  deviceName: string;
  maxClientsPerHost: number;
  hostMeshConnections: number; // How many other hosts to connect to
  discoveryInterval: number;
  autoElection: boolean;
}

class MeshCoordinator extends EventEmitter {
  private config: MeshConfig;
  private currentNode?: MeshNode;
  private isInitialized = false;
  private discoveryTimer: NodeJS.Timeout | null = null;

  constructor() {
    super();
    
    this.config = {
      deviceId: nanoid(),
      deviceName: 'Unknown Device',
      maxClientsPerHost: 7,
      hostMeshConnections: 2,
      discoveryInterval: 15000, // 15 seconds
      autoElection: true,
    };

    this.setupEventListeners();
  }

  /**
   * Initialize mesh network
   */
  async initialize(config: Partial<MeshConfig>): Promise<void> {
    // Prevent multiple initializations
    if (this.isInitialized) {
      console.log('[MeshCoordinator] Already initialized, cleaning up first...');
      await this.shutdown();
      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.config = { ...this.config, ...config };
    console.log('[MeshCoordinator] Initializing mesh network...', this.config);

    // Initialize WiFi Direct
    await WiFiDirectService.initialize();

    // Create our node
    this.currentNode = createMeshNode(
      this.config.deviceId!,
      '', // Address will be set when we create group or connect
      'undecided'
    );

    TopologyManager.updateNode(this.currentNode);

    this.isInitialized = true;
    this.emit('initialized', this.config);

    // Start auto-discovery after a delay to avoid "Framework busy"
    if (this.config.autoElection) {
      setTimeout(() => {
        this.startAutoDiscovery();
      }, 2000); // Wait 2 seconds before first discovery
    }
  }

  /**
   * Start automatic peer discovery and role election
   */
  private startAutoDiscovery(): void {
    console.log('[MeshCoordinator] Starting auto-discovery...');

    this.discoveryTimer = setInterval(async () => {
      try {
        // Discover peers
        await WiFiDirectService.discoverPeers();

        // Let discovery run for a few seconds
        setTimeout(() => {
          this.performRoleElection();
        }, 5000);
      } catch (error: any) {
        // Suppress "Framework busy" - expected when group already exists
        if (!error?.message?.includes('busy')) {
          console.error('[MeshCoordinator] Discovery error:', error);
        }
      }
    }, this.config.discoveryInterval);
  }

  /**
   * Perform role election based on network state
   */
  private async performRoleElection(): Promise<void> {
    if (!this.currentNode) return;

    // Build network state
    const hosts = TopologyManager.getHosts();
    const nearbyDevices = TopologyManager.getNearbyNodes().length;

    const networkState: NetworkState = {
      nearbyDevices,
      availableHosts: hosts.map(h => ({
        id: h.id,
        clientCount: h.clientCount,
        signalStrength: h.signalStrength,
      })),
      currentRole: this.currentNode.role,
    };

    // Decide role
    const decision = await RoleManager.decideRole(networkState);
    console.log('[MeshCoordinator] Role decision:', decision);

    // Apply decision
    if (decision.role !== this.currentNode.role) {
      await this.transitionToRole(decision);
    }
  }

  /**
   * Transition to new role
   */
  private async transitionToRole(decision: RoleDecision): Promise<void> {
    if (!this.currentNode) return;

    console.log(`[MeshCoordinator] Transitioning to ${decision.role}...`);

    if (decision.role === 'host') {
      await this.becomeHost();
    } else if (decision.role === 'client' && decision.targetHost) {
      await this.becomeClient(decision.targetHost);
    }

    // Update our node
    this.currentNode.role = decision.role;
    TopologyManager.updateNode(this.currentNode);

    this.emit('roleChanged', {
      role: decision.role,
      reason: decision.reason,
    });
  }

  /**
   * Become a host
   */
  private async becomeHost(): Promise<void> {
    console.log('[MeshCoordinator] Becoming host...');

    try {
      // Create WiFi Direct group
      const groupInfo = await WiFiDirectService.createGroup();
      console.log('[MeshCoordinator] Host group created:', groupInfo);

      // Update our node
      if (this.currentNode) {
        this.currentNode.address = groupInfo.ownerAddress;
        this.currentNode.role = 'host';
        TopologyManager.updateNode(this.currentNode);
      }

      // Start listening for clients
      this.emit('hostReady', groupInfo);

      // Connect to other hosts for mesh backbone
      await this.connectToOtherHosts();
    } catch (error) {
      console.error('[MeshCoordinator] Failed to become host:', error);
      throw error;
    }
  }

  /**
   * Become a client
   */
  private async becomeClient(targetHostId: string): Promise<void> {
    console.log('[MeshCoordinator] Becoming client, connecting to host:', targetHostId);

    try {
      const host = TopologyManager.getNode(targetHostId);
      if (!host) {
        throw new Error(`Host ${targetHostId} not found in topology`);
      }

      // Connect to host via WiFi Direct
      await WiFiDirectService.connect(host.address);

      // Update our node
      if (this.currentNode) {
        this.currentNode.role = 'client';
        this.currentNode.parentHost = targetHostId;
        TopologyManager.updateNode(this.currentNode);
      }

      // Register with routing service
      MeshRoutingService.mapClientToHost(this.config.deviceId!, targetHostId);

      this.emit('clientConnected', { hostId: targetHostId });
    } catch (error) {
      console.error('[MeshCoordinator] Failed to become client:', error);
      throw error;
    }
  }

  /**
   * Connect to other hosts for mesh backbone
   */
  private async connectToOtherHosts(): Promise<void> {
    const hosts = TopologyManager.getHosts().filter(
      h => h.id !== this.currentNode?.id
    );

    if (hosts.length === 0) {
      console.log('[MeshCoordinator] No other hosts to connect to');
      return;
    }

    // Sort by signal strength and client count
    hosts.sort((a, b) => b.signalStrength - a.signalStrength);

    // Connect to top N hosts
    const connectCount = Math.min(this.config.hostMeshConnections, hosts.length);
    console.log(`[MeshCoordinator] Connecting to ${connectCount} other hosts...`);

    for (let i = 0; i < connectCount; i++) {
      const host = hosts[i];
      try {
        // TODO: Implement host-to-host connection
        // This requires a different protocol than client-to-host
        console.log('[MeshCoordinator] Connecting to host:', host.id);
        
        // Add to routing table
        MeshRoutingService.addDirectHost(host.id, host.address);

        // Update our connections
        if (this.currentNode) {
          this.currentNode.connectedHosts.push(host.id);
          TopologyManager.updateNode(this.currentNode);
        }
      } catch (error) {
        console.error('[MeshCoordinator] Failed to connect to host:', host.id, error);
      }
    }

    // Rebuild routing table
    MeshRoutingService.rebuildRoutingTable();
  }

  /**
   * Send message through mesh
   */
  async sendMessage(to: string, payload: any): Promise<boolean> {
    const message: RoutedMessage = {
      id: nanoid(),
      from: this.config.deviceId!,
      to,
      payload,
      ttl: 5,
      path: [this.config.deviceId!],
      timestamp: Date.now(),
    };

    return await MeshRoutingService.routeMessage(message);
  }

  /**
   * Broadcast message to all nodes
   */
  async broadcastMessage(payload: any): Promise<void> {
    const message = {
      id: nanoid(),
      from: this.config.deviceId!,
      payload,
      ttl: 5,
      timestamp: Date.now(),
    };

    await MeshRoutingService.broadcastToHosts(message);
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // WiFi Direct events
    WiFiDirectService.onPeersChanged((peers) => {
      console.log('[MeshCoordinator] Peers changed:', peers.length);
      
      // Update topology with discovered peers
      peers.forEach(peer => {
        TopologyManager.updateNode({
          id: peer.deviceAddress,
          address: peer.deviceAddress,
          role: 'undecided',
        });
      });
    });

    WiFiDirectService.onConnectionChanged((info) => {
      console.log('[MeshCoordinator] Connection changed:', info);
      
      if (info.connected) {
        this.emit('connectionEstablished', info);
      } else {
        this.emit('connectionLost', info);
      }
    });

    // Routing events
    MeshRoutingService.on('forwardMessage', ({ message, nextHop }) => {
      console.log('[MeshCoordinator] Forwarding message to:', nextHop);
      // TODO: Actually send the message over the connection
      this.emit('messageForwarded', { message, nextHop });
    });

    // Topology events
    TopologyManager.on('nodeAdded', (node) => {
      console.log('[MeshCoordinator] Node added to topology:', node.id);
      this.emit('nodeDiscovered', node);
    });

    TopologyManager.on('nodeRemoved', (node) => {
      console.log('[MeshCoordinator] Node removed from topology:', node.id);
      this.emit('nodeLost', node);
      
      // If it was our parent host, we need to find a new one
      if (this.currentNode?.role === 'client' && this.currentNode.parentHost === node.id) {
        console.log('[MeshCoordinator] Parent host lost, re-electing...');
        this.performRoleElection();
      }
    });
  }

  /**
   * Get current node info
   */
  getCurrentNode(): MeshNode | undefined {
    return this.currentNode;
  }

  /**
   * Get network stats
   */
  getNetworkStats() {
    return {
      topology: TopologyManager.getStats(),
      routing: MeshRoutingService.getStats(),
      currentNode: this.currentNode,
    };
  }

  /**
   * Stop mesh network
   */
  async shutdown(): Promise<void> {
    console.log('[MeshCoordinator] Shutting down...');

    if (this.discoveryTimer) {
      clearInterval(this.discoveryTimer);
      this.discoveryTimer = null;
    }

    if (this.currentNode?.role === 'host') {
      await WiFiDirectService.removeGroup();
    }

    TopologyManager.clear();
    MeshRoutingService.clear();

    this.isInitialized = false;
    this.emit('shutdown');
  }
}

export default new MeshCoordinator();
