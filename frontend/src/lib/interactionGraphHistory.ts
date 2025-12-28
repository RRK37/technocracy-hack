/**
 * Interaction Graph History - stores snapshots of the interaction graph over time
 * Used for time-travel playback of the abstract layer visualization
 */

// Configuration for history storage
export const HISTORY_CONFIG = {
    SNAPSHOT_INTERVAL_MS: 1000,  // Take snapshot every 1 second (adjustable)
    MAX_SNAPSHOTS: 100,          // Keep max 100 seconds of history
} as const;

// Character position at a point in time
export interface CharacterPosition {
    id: string;
    x: number;
    y: number;
}

// Edge state at a point in time
export interface EdgeSnapshot {
    charA: string;
    charB: string;
    weight: number;
}

// Complete snapshot of graph state at a moment
export interface GraphSnapshot {
    timestamp: number;
    edges: EdgeSnapshot[];
    positions: CharacterPosition[];
}

/**
 * Manages time history of the interaction graph
 */
export class InteractionGraphHistory {
    private snapshots: GraphSnapshot[] = [];

    /**
     * Take a snapshot of the current graph and character positions
     */
    takeSnapshot(
        edges: Array<{ charA: string; charB: string; weight: number }>,
        positions: Array<{ id: string; x: number; y: number }>
    ): void {
        const snapshot: GraphSnapshot = {
            timestamp: Date.now(),
            edges: edges.map(e => ({ ...e })),
            positions: positions.map(p => ({ ...p })),
        };

        this.snapshots.push(snapshot);

        // Trim old snapshots if over limit
        while (this.snapshots.length > HISTORY_CONFIG.MAX_SNAPSHOTS) {
            this.snapshots.shift();
        }
    }

    /**
     * Get the snapshot closest to the given timestamp
     */
    getSnapshotAt(timestamp: number): GraphSnapshot | null {
        if (this.snapshots.length === 0) return null;

        // Find the snapshot with the closest timestamp (prefer earlier)
        let closest = this.snapshots[0];
        let closestDiff = Math.abs(timestamp - closest.timestamp);

        for (const snapshot of this.snapshots) {
            const diff = Math.abs(timestamp - snapshot.timestamp);
            if (diff < closestDiff) {
                closest = snapshot;
                closestDiff = diff;
            }
        }

        return closest;
    }

    /**
     * Get the snapshot at a specific index
     */
    getSnapshotAtIndex(index: number): GraphSnapshot | null {
        if (index < 0 || index >= this.snapshots.length) return null;
        return this.snapshots[index];
    }

    /**
     * Get the time range covered by history
     */
    getTimeRange(): { start: number; end: number } | null {
        if (this.snapshots.length === 0) return null;
        return {
            start: this.snapshots[0].timestamp,
            end: this.snapshots[this.snapshots.length - 1].timestamp,
        };
    }

    /**
     * Get the number of snapshots stored
     */
    getSnapshotCount(): number {
        return this.snapshots.length;
    }

    /**
     * Get all snapshot timestamps (for slider)
     */
    getTimestamps(): number[] {
        return this.snapshots.map(s => s.timestamp);
    }

    /**
     * Clear all history
     */
    clear(): void {
        this.snapshots = [];
    }
}
