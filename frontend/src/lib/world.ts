/**
 * World configuration and constants for the character simulation
 */

export const WORLD_CONFIG = {
  WIDTH: 3000,
  HEIGHT: 1500,
  NUM_CHARACTERS: 20,
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

export const CAMERA_CONFIG = {
  MIN_ZOOM: 0.5,
  MAX_ZOOM: 5, // Increased from 3 to allow more zoom
  ZOOM_SENSITIVITY: 0.001, // Smoother, more controlled zooming
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
}

// World modes
export enum WorldMode {
  INTERACTIVE = 'interactive',  // Full interaction dynamics: trap circles, character interactions
  OBSERVE = 'observe',          // Just wandering characters, no interactions
  SCRATCH = 'scratch',          // Sandbox mode for experimenting with new features
}

// Mode feature configuration
export interface ModeFeatures {
  trapCircles: boolean;         // Can create/show trap circles
  interactions: boolean;        // Characters can interact with each other
  interactionRadius: boolean;   // Show interaction radius around characters
  sitting: boolean;             // Characters can sit when clicked
  audienceFormation: boolean;   // Arrange characters in audience rows
}

// Configuration for each world mode
export const MODE_CONFIG: Record<WorldMode, ModeFeatures> = {
  [WorldMode.INTERACTIVE]: {
    trapCircles: true,
    interactions: true,
    interactionRadius: true,
    sitting: true,
    audienceFormation: false,
  },
  [WorldMode.OBSERVE]: {
    trapCircles: false,
    interactions: false,
    interactionRadius: false,
    sitting: false,
    audienceFormation: false,
  },
  [WorldMode.SCRATCH]: {
    // Sandbox mode - audience formation enabled
    trapCircles: false,
    interactions: false,
    interactionRadius: false,
    sitting: false,
    audienceFormation: true,
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
