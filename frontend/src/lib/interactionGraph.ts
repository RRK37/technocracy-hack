/**
 * Interaction Graph - tracks cumulative conversation time between character pairs
 * Used for the abstract layer visualization
 */

export interface InteractionEdge {
    charA: string;  // Character ID (smaller ID first for consistent key)
    charB: string;  // Character ID
    weight: number; // Cumulative conversation time in ms
}

/**
 * Create a consistent key for a character pair (sorted IDs)
 */
function makeEdgeKey(idA: string, idB: string): string {
    return idA < idB ? `${idA}-${idB}` : `${idB}-${idA}`;
}

export class InteractionGraph {
    private edges: Map<string, InteractionEdge> = new Map();

    /**
     * Record interaction time between two characters
     */
    recordInteraction(charA: string, charB: string, deltaMs: number): void {
        const key = makeEdgeKey(charA, charB);
        const existing = this.edges.get(key);

        if (existing) {
            existing.weight += deltaMs;
        } else {
            // Ensure charA < charB for consistency
            const [smaller, larger] = charA < charB ? [charA, charB] : [charB, charA];
            this.edges.set(key, {
                charA: smaller,
                charB: larger,
                weight: deltaMs,
            });
        }
    }

    /**
     * Get edge weight between two characters
     */
    getWeight(charA: string, charB: string): number {
        const key = makeEdgeKey(charA, charB);
        return this.edges.get(key)?.weight ?? 0;
    }

    /**
     * Get all edges for rendering
     */
    getAllEdges(): InteractionEdge[] {
        return Array.from(this.edges.values());
    }

    /**
     * Get maximum weight (for normalization)
     */
    getMaxWeight(): number {
        let max = 0;
        for (const edge of this.edges.values()) {
            if (edge.weight > max) max = edge.weight;
        }
        return max;
    }

    /**
     * Clear all tracked interactions
     */
    clear(): void {
        this.edges.clear();
    }

    /**
     * Decay a specific edge's weight
     * Returns true if edge still exists, false if it was removed
     */
    decayEdge(charA: string, charB: string, decayAmount: number): boolean {
        const key = makeEdgeKey(charA, charB);
        const edge = this.edges.get(key);
        if (!edge) return false;

        edge.weight = Math.max(0, edge.weight - decayAmount);

        // Remove edge if weight drops to zero
        if (edge.weight <= 0) {
            this.edges.delete(key);
            return false;
        }
        return true;
    }

    /**
     * Decay all edges by a linear amount (same amount per second for all edges)
     * @param decayPerSecond - fixed weight to subtract per second
     * @param deltaMs - time elapsed in milliseconds
     * @param activeConversations - Set of edge keys currently in conversation (won't decay)
     */
    decayAllEdges(decayPerSecond: number, deltaMs: number, activeConversations: Set<string> = new Set()): void {
        const decayAmount = (decayPerSecond * deltaMs) / 1000;

        for (const [key, edge] of this.edges.entries()) {
            // Skip edges that are currently in active conversation
            if (activeConversations.has(key)) continue;

            // Linear decay - subtract fixed amount
            edge.weight = edge.weight - decayAmount;

            // Remove edge if weight drops to zero or below
            if (edge.weight <= 0) {
                this.edges.delete(key);
            }
        }
    }

    /**
     * Get edge key for a character pair (for tracking active conversations)
     */
    static getEdgeKey(charA: string, charB: string): string {
        return makeEdgeKey(charA, charB);
    }
}
