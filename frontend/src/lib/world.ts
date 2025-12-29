/**
 * World configuration and constants for the character simulation
 */

export const WORLD_CONFIG = {
  WIDTH: 3000,
  HEIGHT: 1500,
  DEPTH: 1500,  // Z-axis bounds for 3D mode
  NUM_CHARACTERS: 21, // 8 VCs + Jordan (presenter) + 12 general participants
} as const;

// Trap circle that acts as a boundary
export interface TrapCircle {
  id: string;
  x: number;
  y: number;
  radius: number;
}

export const CHARACTER_CONFIG = {
  WIDTH: 64,
  HEIGHT: 64,
  HITBOX_RADIUS: 10,
  CLICKABLE_RADIUS: 40, // Fixed radius for click/hover detection
  INTERACTION_RADIUS_MIN: 50, // Min visual radius (at aura 0)
  INTERACTION_RADIUS_MAX: 200, // Max visual radius (at aura 1)
  INTERACTION_CHANCE: 0.001, // 0.5% chance per frame when radii overlap (about 30% per second at 60fps)
  SPEED: 0.5, // Increased from 0.5 for more visible movement
  ANIMATION_SPEED: 0.2, // Increased from 0.15 for smoother animation
  DIRECTION_CHANGE_CHANCE: 0.01, // 1% chance per frame
} as const;

// Configuration for lightweight conversing feature (Abstract Layers mode)
export const CONVERSING_CONFIG = {
  CHANCE_PER_FRAME: 0.006, // Chance per frame for two wandering agents to start conversing
  MIN_DURATION_MS: 5000,     // Minimum conversation duration (5 seconds)
  MAX_DURATION_MS: 15000,    // Maximum conversation duration (15 seconds)
  BUBBLE_DURATION_MS: 3000,  // How long the "is talking to" bubble shows
} as const;

export const CAMERA_CONFIG = {
  MIN_ZOOM: 0.2,  // Allow extreme zoom out for abstract layer overview
  MAX_ZOOM: 5, // Increased from 3 to allow more zoom
  ZOOM_SENSITIVITY: 0.001, // Smoother, more controlled zooming
} as const;

// Configuration for abstract layer visualization
export const ABSTRACT_LAYER_CONFIG = {
  ZOOM_THRESHOLD_HIGH: 0.7,   // Start fading to abstract at this zoom level
  ZOOM_THRESHOLD_LOW: 0.5,    // Fully abstract below this zoom level (blend zone: 0.5-0.7)
  DOT_RADIUS: 10,             // Character dot size in abstract view
  DOT_COLOR: '#ff6b6b',       // Character dot color
  DOT_BORDER_COLOR: '#cc5555',// Dot border color
  MIN_LINE_WIDTH: 1,          // Minimum connection line width (more visible)
  MAX_LINE_WIDTH: 12,         // Maximum connection line width (more dramatic difference)
  LINE_COLOR: 'rgba(100, 200, 255, 0.6)',  // Connection line color
  SHOW_LABELS: true,          // Show character initials on dots
} as const;

// Configuration for gravity attraction between connected agents
export const GRAVITY_CONFIG = {
  ENABLED: true,              // Enable/disable gravity attraction
  STRENGTH: 0.0008,           // Base attraction strength (tune this!)
  MAX_FORCE: 0.5,             // Maximum force to prevent extreme acceleration
  MIN_DISTANCE: 50,           // Minimum distance to prevent overlap
  EQUILIBRIUM_DISTANCE: 80,   // Agents stop accelerating at this distance
  DAMPING: 0.98,              // Velocity decay factor (lower = more friction)
} as const;

export const SPEECH_CONFIG = {
  DURATION_MS: 5000, // 5 seconds
  MAX_DELAY_MS: 4000, // Maximum stagger delay
  PADDING: 10,
  BORDER_RADIUS: 8,
  POINTER_SIZE: 10,
} as const;

// Sprite animation directions
export enum Direction {
  UP = 0,
  LEFT = 1,
  DOWN = 2,
  RIGHT = 3,
}

// Character states
export enum CharacterState {
  WANDERING = 'WANDERING',
  TALKING = 'TALKING',
  SITTING = 'SITTING',
  INTERACTING = 'INTERACTING', // Two characters interacting with each other
  AUDIENCE = 'AUDIENCE',       // Sitting in audience formation
  PRESENTING = 'PRESENTING',   // Standing at front as presenter
  WALKING_TO_AREA = 'WALKING_TO_AREA', // Walking to a target then wandering
  DISCUSSING = 'DISCUSSING',   // In a discussion circle, facing center
  CONVERSING = 'CONVERSING',   // Lightweight talking with another agent, still moving
}

// World modes
export enum WorldMode {
  INTERACTIVE = 'interactive',  // Full interaction dynamics: trap circles, character interactions
  OBSERVE = 'observe',          // Just wandering characters, no interactions
  PRESENTING = 'presenting',    // Audience formation with presenter at front
  DISCUSS = 'discuss',          // Waiting room: audience in top-left, presenter on right
  PITCH = 'pitch',              // Combined Present + Discuss with stage transitions
  SCRATCH = 'scratch',          // Sandbox mode for experimenting with new features
  ABSTRACT_LAYERS = 'abstract-layers', // 2D abstract layer visualization
  ABSTRACT_3D = 'abstract-3d',  // 3D abstract layer visualization with free-fly camera
}

// Pitch mode stages
export enum PitchStage {
  IDLE = 'idle',               // Characters wander randomly
  PRESENTING = 'presenting',   // Audience formation with Jordan presenting
  DISCUSSING = 'discussing',   // Trap circle with auto-discussions
}

// Mode feature configuration
export interface ModeFeatures {
  trapCircles: boolean;         // Can create/show trap circles
  interactions: boolean;        // Characters can interact with each other
  interactionRadius: boolean;   // Show interaction radius around characters
  sitting: boolean;             // Characters can sit when clicked
  audienceFormation: boolean;   // Arrange characters in audience rows
  conversing: boolean;          // Enable random agent-to-agent conversations
  abstractLayer: boolean;       // Enable zoom-based abstract layer visualization
}

// Configuration for each world mode
export const MODE_CONFIG: Record<WorldMode, ModeFeatures> = {
  [WorldMode.INTERACTIVE]: {
    trapCircles: true,
    interactions: true,
    interactionRadius: true,
    sitting: true,
    audienceFormation: false,
    conversing: false,
    abstractLayer: false,
  },
  [WorldMode.OBSERVE]: {
    trapCircles: false,
    interactions: false,
    interactionRadius: false,
    sitting: false,
    audienceFormation: false,
    conversing: false,
    abstractLayer: false,
  },
  [WorldMode.PRESENTING]: {
    // Audience formation with Jordan as presenter
    trapCircles: false,
    interactions: false,
    interactionRadius: false,
    sitting: false,
    audienceFormation: true,
    conversing: false,
    abstractLayer: false,
  },
  [WorldMode.DISCUSS]: {
    // Waiting room: audience in trap circle (hidden), presenter stands on right
    trapCircles: false,
    interactions: false,
    interactionRadius: false,
    sitting: false,
    audienceFormation: false,
    conversing: false,
    abstractLayer: false,
  },
  [WorldMode.PITCH]: {
    // Pitch mode: dynamically controlled by stage
    trapCircles: false,
    interactions: false,
    interactionRadius: false,
    sitting: false,
    audienceFormation: false, // Controlled per-stage
    conversing: false,
    abstractLayer: false,
  },
  [WorldMode.SCRATCH]: {
    // Sandbox mode - starts with OBSERVE defaults
    // Modify these as you experiment with new features
    trapCircles: false,
    interactions: false,
    interactionRadius: false,
    sitting: false,
    audienceFormation: false,
    conversing: false,
    abstractLayer: false,
  },
  [WorldMode.ABSTRACT_LAYERS]: {
    // Abstract Layers mode - features lightweight agent conversations and zoom-based visualization
    trapCircles: false,
    interactions: false,
    interactionRadius: false,
    sitting: false,
    audienceFormation: false,
    conversing: true,       // Enable random conversations
    abstractLayer: true,    // Enable zoom-based abstract visualization
  },
  [WorldMode.ABSTRACT_3D]: {
    // 3D Abstract mode - same as ABSTRACT_LAYERS but rendered in 3D with free-fly camera
    trapCircles: false,
    interactions: false,
    interactionRadius: false,
    sitting: false,
    audienceFormation: false,
    conversing: true,       // Enable random conversations
    abstractLayer: true,    // Enable abstract visualization
  },
};

/**
 * Pre-defined responses for speech bubbles
 */
export const BRAIN_RESPONSES = [
  "I love this!",
  "I'm hungry",
  "Where am I?",
  "This is amazing!",
  "What's happening?",
  "Hello there!",
  "I'm confused",
  "This is fun!",
  "Who are you?",
  "I'm tired",
  "Let's go!",
  "Wow!",
  "Interesting...",
  "Tell me more",
  "I don't know",
  "Maybe later",
  "That's nice",
  "I agree!",
  "Not sure about that",
  "Good point",
];

/**
 * Get a random response from the brain
 */
export function getRandomResponse(): string {
  return BRAIN_RESPONSES[Math.floor(Math.random() * BRAIN_RESPONSES.length)];
}

/**
 * Get a random position within world bounds
 */
export function getRandomPosition(): { x: number; y: number } {
  return {
    x: Math.random() * WORLD_CONFIG.WIDTH,
    y: Math.random() * WORLD_CONFIG.HEIGHT,
  };
}

/**
 * Get a random velocity
 */
export function getRandomVelocity(): { vx: number; vy: number } {
  const angle = Math.random() * Math.PI * 2;
  return {
    vx: Math.cos(angle) * CHARACTER_CONFIG.SPEED,
    vy: Math.sin(angle) * CHARACTER_CONFIG.SPEED,
  };
}

/**
 * Clamp a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
