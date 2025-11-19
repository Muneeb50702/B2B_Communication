/**
 * RoleManager - Determines if device should be Host or Client
 * Auto-election based on network conditions and load
 */

import { EventEmitter } from 'events';

export type NodeRole = 'host' | 'client' | 'undecided';

export interface RoleDecision {
  role: NodeRole;
  reason: string;
  shouldCreateGroup: boolean;
  targetHost?: string; // For clients: which host to connect to
}

export interface NetworkState {
  nearbyDevices: number;
  availableHosts: Array<{
    id: string;
    clientCount: number;
    signalStrength: number;
  }>;
  currentRole?: NodeRole;
}

class RoleManager extends EventEmitter {
  private currentRole: NodeRole = 'undecided';
  private maxClientsPerHost = 7; // Reserve 1 slot for host-to-host
  private electionInProgress = false;

  /**
   * Decide role based on network state
   */
  async decideRole(networkState: NetworkState): Promise<RoleDecision> {
    console.log('[RoleManager] Deciding role...', networkState);

    // If already a host with clients, stay host
    if (networkState.currentRole === 'host') {
      return {
        role: 'host',
        reason: 'Already hosting clients',
        shouldCreateGroup: false,
      };
    }

    // Find available hosts with capacity
    const availableHosts = networkState.availableHosts.filter(
      host => host.clientCount < this.maxClientsPerHost
    );

    // Sort by client count (prefer less loaded) and signal strength
    availableHosts.sort((a, b) => {
      if (a.clientCount !== b.clientCount) {
        return a.clientCount - b.clientCount; // Fewer clients first
      }
      return b.signalStrength - a.signalStrength; // Stronger signal first
    });

    // Decision logic
    if (availableHosts.length === 0) {
      // No hosts available → Become host
      console.log('[RoleManager] No available hosts → Becoming host');
      this.currentRole = 'host';
      return {
        role: 'host',
        reason: 'No available hosts in range',
        shouldCreateGroup: true,
      };
    }

    if (networkState.nearbyDevices > 8 && availableHosts.length < 2) {
      // Network getting crowded, not enough hosts → Become host
      console.log('[RoleManager] Network crowded, becoming additional host');
      this.currentRole = 'host';
      return {
        role: 'host',
        reason: 'Network load balancing - need more hosts',
        shouldCreateGroup: true,
      };
    }

    // Join best available host
    const bestHost = availableHosts[0];
    console.log('[RoleManager] Joining host:', bestHost.id);
    this.currentRole = 'client';
    
    return {
      role: 'client',
      reason: `Joining host with ${bestHost.clientCount} clients`,
      shouldCreateGroup: false,
      targetHost: bestHost.id,
    };
  }

  /**
   * Check if device should promote to host
   */
  shouldPromoteToHost(currentClients: number, nearbyDevices: number): boolean {
    // Promote if:
    // 1. Current host is overloaded (>7 clients)
    // 2. Too many devices for available hosts
    const hostsNeeded = Math.ceil(nearbyDevices / 8);
    const currentHosts = Math.ceil(currentClients / 7);
    
    return currentHosts < hostsNeeded;
  }

  /**
   * Check if host should demote to client
   */
  shouldDemoteToClient(clientCount: number, nearbyHosts: number): boolean {
    // Demote if:
    // 1. No clients connected
    // 2. Other hosts have capacity
    return clientCount === 0 && nearbyHosts > 1;
  }

  /**
   * Get current role
   */
  getCurrentRole(): NodeRole {
    return this.currentRole;
  }

  /**
   * Force role change (for testing)
   */
  setRole(role: NodeRole): void {
    const oldRole = this.currentRole;
    this.currentRole = role;
    console.log(`[RoleManager] Role changed: ${oldRole} → ${role}`);
    this.emit('roleChanged', { oldRole, newRole: role });
  }

  /**
   * Calculate optimal number of hosts for network size
   */
  calculateOptimalHosts(totalDevices: number): number {
    // Each host can handle 7 clients
    // Add 1 for rounding up
    return Math.ceil(totalDevices / 8);
  }

  /**
   * Elect hosts from list of devices
   * Returns device IDs that should become hosts
   */
  electHosts(
    devices: Array<{ id: string; signalStrength: number }>,
    currentHosts: string[]
  ): string[] {
    const totalDevices = devices.length;
    const optimalHostCount = this.calculateOptimalHosts(totalDevices);
    const additionalHostsNeeded = Math.max(0, optimalHostCount - currentHosts.length);

    if (additionalHostsNeeded === 0) {
      return currentHosts;
    }

    // Sort by signal strength (strongest becomes host)
    const candidates = devices
      .filter(d => !currentHosts.includes(d.id))
      .sort((a, b) => b.signalStrength - a.signalStrength);

    // Select top N candidates
    const newHosts = candidates
      .slice(0, additionalHostsNeeded)
      .map(d => d.id);

    return [...currentHosts, ...newHosts];
  }
}

export default new RoleManager();
