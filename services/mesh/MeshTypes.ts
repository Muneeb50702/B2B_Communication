/**
 * MeshNode - Represents a device in the mesh network
 */

export type NodeRole = 'host' | 'client' | 'undecided';

export interface MeshNode {
  id: string; // Unique device ID
  role: NodeRole;
  address: string; // IP or device address
  signalStrength: number; // RSSI or connection quality
  clientCount: number; // Number of clients (if host)
  connectedHosts: string[]; // Other hosts this host connects to
  parentHost?: string; // Host this client connects to
  lastSeen: number; // Timestamp
  capabilities: {
    canBeHost: boolean;
    batteryLevel: number;
    isCharging: boolean;
  };
}

export interface RoutingTable {
  directHosts: Map<string, string>; // hostId → address
  multiHopRoutes: Map<string, string[]>; // targetId → [hop1, hop2, ...]
  clientMap: Map<string, string>; // clientId → hostId
}

export interface NetworkTopology {
  nodes: Map<string, MeshNode>;
  lastUpdate: number;
}

/**
 * Create a new mesh node
 */
export function createMeshNode(
  id: string,
  address: string,
  role: NodeRole = 'undecided'
): MeshNode {
  return {
    id,
    role,
    address,
    signalStrength: 0,
    clientCount: 0,
    connectedHosts: [],
    lastSeen: Date.now(),
    capabilities: {
      canBeHost: true,
      batteryLevel: 100,
      isCharging: false,
    },
  };
}

/**
 * Create empty routing table
 */
export function createRoutingTable(): RoutingTable {
  return {
    directHosts: new Map(),
    multiHopRoutes: new Map(),
    clientMap: new Map(),
  };
}

/**
 * Create empty network topology
 */
export function createNetworkTopology(): NetworkTopology {
  return {
    nodes: new Map(),
    lastUpdate: Date.now(),
  };
}
