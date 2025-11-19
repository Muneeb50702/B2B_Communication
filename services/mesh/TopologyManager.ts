/**
 * TopologyManager - Maintains network map of all nodes
 */

import { EventEmitter } from 'events';
import {
  MeshNode,
  NetworkTopology,
  createNetworkTopology,
  createMeshNode,
} from './MeshTypes';

class TopologyManager extends EventEmitter {
  private topology: NetworkTopology = createNetworkTopology();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private nodeTimeout = 30000; // 30 seconds

  constructor() {
    super();
    this.startCleanupTimer();
  }

  /**
   * Add or update node in topology
   */
  updateNode(node: Partial<MeshNode> & { id: string; address: string }): void {
    const existing = this.topology.nodes.get(node.id);

    if (existing) {
      // Update existing node
      const updated: MeshNode = {
        ...existing,
        ...node,
        lastSeen: Date.now(),
      };
      this.topology.nodes.set(node.id, updated);
      console.log('[TopologyManager] Node updated:', node.id, updated.role);
    } else {
      // Add new node
      const newNode = createMeshNode(node.id, node.address, node.role);
      Object.assign(newNode, node);
      newNode.lastSeen = Date.now();
      this.topology.nodes.set(node.id, newNode);
      console.log('[TopologyManager] Node added:', node.id, newNode.role);
      this.emit('nodeAdded', newNode);
    }

    this.topology.lastUpdate = Date.now();
    this.emit('topologyChanged', this.getTopology());
  }

  /**
   * Remove node from topology
   */
  removeNode(nodeId: string): void {
    const node = this.topology.nodes.get(nodeId);
    if (node) {
      this.topology.nodes.delete(nodeId);
      console.log('[TopologyManager] Node removed:', nodeId);
      this.emit('nodeRemoved', node);
      this.topology.lastUpdate = Date.now();
      this.emit('topologyChanged', this.getTopology());
    }
  }

  /**
   * Get node by ID
   */
  getNode(nodeId: string): MeshNode | undefined {
    return this.topology.nodes.get(nodeId);
  }

  /**
   * Get all nodes with specific role
   */
  getNodesByRole(role: 'host' | 'client' | 'undecided'): MeshNode[] {
    return Array.from(this.topology.nodes.values()).filter(
      node => node.role === role
    );
  }

  /**
   * Get all hosts
   */
  getHosts(): MeshNode[] {
    return this.getNodesByRole('host');
  }

  /**
   * Get all clients
   */
  getClients(): MeshNode[] {
    return this.getNodesByRole('client');
  }

  /**
   * Get full topology
   */
  getTopology(): NetworkTopology {
    return {
      nodes: new Map(this.topology.nodes),
      lastUpdate: this.topology.lastUpdate,
    };
  }

  /**
   * Get nearby nodes (within signal range)
   */
  getNearbyNodes(minSignalStrength: number = -70): MeshNode[] {
    return Array.from(this.topology.nodes.values()).filter(
      node => node.signalStrength >= minSignalStrength
    );
  }

  /**
   * Get hosts with available capacity
   */
  getAvailableHosts(maxClientsPerHost: number = 7): MeshNode[] {
    return this.getHosts().filter(
      host => host.clientCount < maxClientsPerHost
    );
  }

  /**
   * Find best host for new client
   */
  findBestHost(): MeshNode | null {
    const hosts = this.getAvailableHosts();
    if (hosts.length === 0) return null;

    // Sort by client count (ascending) and signal strength (descending)
    hosts.sort((a, b) => {
      if (a.clientCount !== b.clientCount) {
        return a.clientCount - b.clientCount;
      }
      return b.signalStrength - a.signalStrength;
    });

    return hosts[0];
  }

  /**
   * Get network statistics
   */
  getStats() {
    const nodes = Array.from(this.topology.nodes.values());
    const hosts = nodes.filter(n => n.role === 'host');
    const clients = nodes.filter(n => n.role === 'client');
    const totalClients = hosts.reduce((sum, h) => sum + h.clientCount, 0);

    return {
      totalNodes: nodes.length,
      hosts: hosts.length,
      clients: clients.length,
      totalClientConnections: totalClients,
      averageClientsPerHost: hosts.length > 0 ? totalClients / hosts.length : 0,
      lastUpdate: this.topology.lastUpdate,
    };
  }

  /**
   * Clean up stale nodes
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const staleNodes: string[] = [];

      this.topology.nodes.forEach((node, id) => {
        if (now - node.lastSeen > this.nodeTimeout) {
          staleNodes.push(id);
        }
      });

      staleNodes.forEach(id => this.removeNode(id));

      if (staleNodes.length > 0) {
        console.log(`[TopologyManager] Cleaned up ${staleNodes.length} stale nodes`);
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Stop cleanup timer
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clear all nodes
   */
  clear(): void {
    this.topology.nodes.clear();
    this.topology.lastUpdate = Date.now();
    console.log('[TopologyManager] Topology cleared');
    this.emit('topologyChanged', this.getTopology());
  }
}

export default new TopologyManager();
