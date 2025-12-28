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
}
