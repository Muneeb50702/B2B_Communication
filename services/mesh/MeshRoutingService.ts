/**
 * MeshRoutingService - Multi-hop message routing
 */

import { EventEmitter } from 'events';
import { RoutingTable, createRoutingTable } from './MeshTypes';
import TopologyManager from './TopologyManager';

export interface RoutedMessage {
  id: string;
  from: string;
  to: string;
  payload: any;
  ttl: number;
  path: string[]; // Hops taken
  timestamp: number;
}

class MeshRoutingService extends EventEmitter {
  private routingTable: RoutingTable = createRoutingTable();
  private messageCache = new Map<string, number>(); // messageId → timestamp
  private maxTTL = 5; // Maximum hops
  private cacheTimeout = 60000; // 1 minute

  constructor() {
    super();
    this.startCacheCleanup();
  }

  /**
   * Add direct host connection
   */
  addDirectHost(hostId: string, address: string): void {
    this.routingTable.directHosts.set(hostId, address);
    console.log('[MeshRouting] Direct host added:', hostId);
  }

  /**
   * Remove direct host
   */
  removeDirectHost(hostId: string): void {
    this.routingTable.directHosts.delete(hostId);
    console.log('[MeshRouting] Direct host removed:', hostId);
  }

  /**
   * Map client to their host
   */
  mapClientToHost(clientId: string, hostId: string): void {
    this.routingTable.clientMap.set(clientId, hostId);
  }

  /**
   * Get route to target node
   */
  getRoute(targetId: string): string[] | null {
    // Check if it's a direct host
    if (this.routingTable.directHosts.has(targetId)) {
      return [targetId];
    }

    // Check if it's a client - route through their host
    const hostId = this.routingTable.clientMap.get(targetId);
    if (hostId) {
      return this.getRoute(hostId); // Recursive: route to the host
    }

    // Check multi-hop routes
    const multiHop = this.routingTable.multiHopRoutes.get(targetId);
    if (multiHop) {
      return multiHop;
    }

    // No route found
    console.warn('[MeshRouting] No route to:', targetId);
    return null;
  }

  /**
   * Route message to destination
   */
  async routeMessage(message: RoutedMessage): Promise<boolean> {
    // Check TTL
    if (message.ttl <= 0) {
      console.warn('[MeshRouting] Message TTL exceeded:', message.id);
      return false;
    }

    // Check for duplicate (already seen this message)
    if (this.messageCache.has(message.id)) {
      console.log('[MeshRouting] Duplicate message ignored:', message.id);
      return false;
    }

    // Cache message ID
    this.messageCache.set(message.id, Date.now());

    // Get route
    const route = this.getRoute(message.to);
    if (!route) {
      console.error('[MeshRouting] No route to destination:', message.to);
      return false;
    }

    // Forward message
    const nextHop = route[0];
    console.log('[MeshRouting] Forwarding message', message.id, 'to', nextHop);

    // Decrement TTL and add to path
    message.ttl--;
    message.path.push(nextHop);

    // Emit for transmission
    this.emit('forwardMessage', {
      message,
      nextHop,
      route,
    });

    return true;
  }

  /**
   * Broadcast message to all hosts
   */
  async broadcastToHosts(message: Omit<RoutedMessage, 'to' | 'path'>): Promise<void> {
    const hosts = Array.from(this.routingTable.directHosts.keys());
    console.log('[MeshRouting] Broadcasting to', hosts.length, 'hosts');

    for (const hostId of hosts) {
      const routedMsg: RoutedMessage = {
        ...message,
        to: hostId,
        path: [hostId],
      };
      await this.routeMessage(routedMsg);
    }
  }

  /**
   * Build routing table from topology
   */
  rebuildRoutingTable(): void {
    console.log('[MeshRouting] Rebuilding routing table...');
    
    // Clear multi-hop routes
    this.routingTable.multiHopRoutes.clear();
    this.routingTable.clientMap.clear();

    // Get all hosts
    const hosts = TopologyManager.getHosts();
    
    // Map clients to hosts
    hosts.forEach(host => {
      // TODO: Get clients for each host when we have that data
      // For now, we rely on manual mapping via mapClientToHost()
    });

    // Build multi-hop routes using BFS
    this.buildMultiHopRoutes();

    console.log('[MeshRouting] Routing table rebuilt');
    console.log('  - Direct hosts:', this.routingTable.directHosts.size);
    console.log('  - Multi-hop routes:', this.routingTable.multiHopRoutes.size);
    console.log('  - Client mappings:', this.routingTable.clientMap.size);
  }

  /**
   * Build multi-hop routes using breadth-first search
   */
  private buildMultiHopRoutes(): void {
    const hosts = TopologyManager.getHosts();
    const visited = new Set<string>();
    const queue: Array<{ hostId: string; path: string[] }> = [];

    // Start from directly connected hosts
    this.routingTable.directHosts.forEach((_, hostId) => {
      queue.push({ hostId, path: [hostId] });
      visited.add(hostId);
    });

    // BFS to find multi-hop routes
    while (queue.length > 0) {
      const { hostId, path } = queue.shift()!;
      const host = TopologyManager.getNode(hostId);

      if (!host || path.length >= this.maxTTL) continue;

      // Explore connected hosts
      host.connectedHosts.forEach(nextHostId => {
        if (!visited.has(nextHostId)) {
          visited.add(nextHostId);
          const newPath = [...path, nextHostId];
          this.routingTable.multiHopRoutes.set(nextHostId, newPath);
          queue.push({ hostId: nextHostId, path: newPath });
        }
      });
    }
  }

  /**
   * Clean up old cached messages
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const expiredKeys: string[] = [];

      this.messageCache.forEach((timestamp, messageId) => {
        if (now - timestamp > this.cacheTimeout) {
          expiredKeys.push(messageId);
        }
      });

      expiredKeys.forEach(key => this.messageCache.delete(key));

      if (expiredKeys.length > 0) {
        console.log(`[MeshRouting] Cleaned up ${expiredKeys.length} cached messages`);
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Get routing statistics
   */
  getStats() {
    return {
      directHosts: this.routingTable.directHosts.size,
      multiHopRoutes: this.routingTable.multiHopRoutes.size,
      clientMappings: this.routingTable.clientMap.size,
      cachedMessages: this.messageCache.size,
    };
  }

  /**
   * Clear all routes
   */
  clear(): void {
    this.routingTable.directHosts.clear();
    this.routingTable.multiHopRoutes.clear();
    this.routingTable.clientMap.clear();
    this.messageCache.clear();
    console.log('[MeshRouting] Routes cleared');
  }
}

export default new MeshRoutingService();
