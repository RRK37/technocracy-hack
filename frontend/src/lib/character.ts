/**
 * Character class for the simulation
 */

import type { Character as CharacterData } from '@/src/types/character';
import {
  CHARACTER_CONFIG,
  WORLD_CONFIG,
  SPEECH_CONFIG,
  Direction,
  CharacterState,
  getRandomResponse,
  TrapCircle,
} from './world';
import { drawSprite, drawShadow, drawSpeechBubble } from './canvas-utils';

// Helper function to constrain a value within min/max bounds
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class SimulationCharacter {
  // Identity
  id: string;
  data: CharacterData;

  // Position and movement
  x: number;
  y: number;
  z: number;  // Z-axis position for 3D mode
  vx: number;
  vy: number;
  vz: number; // Z-axis velocity for 3D mode

  // Animation
  frameIndex: number = 0;
  row: Direction = Direction.DOWN;
  tickCount: number = 0;

  // State
  state: CharacterState = CharacterState.WANDERING;
  speechText: string = '';
  speechTimer: number = 0;
  speechBubbleHidden: boolean = false; // Toggle to hide/show speech bubble
  pendingSpeechTimeout: NodeJS.Timeout | null = null;

  // Sprite images
  image: HTMLImageElement | null = null;
  imageLoaded: boolean = false;
  sitImage: HTMLImageElement | null = null;
  sitImageLoaded: boolean = false;
  idleImage: HTMLImageElement | null = null;
  idleImageLoaded: boolean = false;

  // Saved velocity when sitting or interacting
  savedVx: number = 0;
  savedVy: number = 0;

  // Saved position when interacting (to restore after - NOT used anymore, kept for compatibility)
  savedX: number = 0;
  savedY: number = 0;

  // Interaction partner (when in INTERACTING state)
  interactionPartner: SimulationCharacter | null = null;

  // All participants in this interaction (for group interactions)
  interactionGroup: SimulationCharacter[] = [];

  // Circle center for this interaction (for joining characters)
  interactionCircleX: number = 0;
  interactionCircleY: number = 0;

  // Interaction role: 'dominant' (higher aura, stands) or 'submissive' (lower aura, sits)
  interactionRole: 'dominant' | 'submissive' | null = null;

  // Target position for walking to interaction
  interactionTargetX: number = 0;
  interactionTargetY: number = 0;
  walkingToInteraction: boolean = false;

  // Audience formation properties
  audienceTargetX: number = 0;
  audienceTargetY: number = 0;
  isPresenter: boolean = false;
  walkingToAudiencePosition: boolean = false;

  // Walk-to-area properties (for walking then wandering)
  walkTargetX: number = 0;
  walkTargetY: number = 0;

  // Discussion properties (for circle discussions)
  discussionCenterX: number = 0;
  discussionCenterY: number = 0;

  // Conversing properties (lightweight talking while still moving)
  conversingWith: SimulationCharacter | null = null;
  conversingEndTime: number = 0;  // Timestamp when conversation ends
  conversingBubbleText: string = '';  // "is talking to [name]"

  // Aura determines interaction radius (0-1, randomly assigned)
  aura: number;

  // Get interaction radius based on aura
  get interactionRadius(): number {
    const min = CHARACTER_CONFIG.INTERACTION_RADIUS_MIN;
    const max = CHARACTER_CONFIG.INTERACTION_RADIUS_MAX;
    return min + (this.aura * (max - min));
  }

  constructor(characterData: CharacterData, x: number, y: number, vx: number, vy: number) {
    this.id = characterData.id.toString();
    this.data = characterData;
    this.x = x;
    this.y = y;
    this.z = Math.random() * WORLD_CONFIG.DEPTH; // Random z for 3D spread
    this.vx = vx;
    this.vy = vy;
    this.vz = (Math.random() - 0.5) * CHARACTER_CONFIG.SPEED; // Random z velocity

    // Assign random aura (0-1)
    this.aura = Math.random();

    // Load sprite image
    this.loadImage();
  }

  /**
   * Load the character's walk sprite
   */
  private loadImage(): void {
    this.image = new Image();

    // Allow cross-origin if needed
    this.image.crossOrigin = 'anonymous';

    this.image.onload = () => {
      this.imageLoaded = true;
    };

    this.image.onerror = (error) => {
      console.error(`Failed to load sprite for character ${this.id}:`, this.data.sprites.walk.url, error);
      this.imageLoaded = false;
    };

    // Use the walk sprite from the character data
    this.image.src = this.data.sprites.walk.url;

    // Load sit sprite
    this.loadSitImage();
  }

  /**
   * Load the character's sit sprite
   */
  private loadSitImage(): void {
    this.sitImage = new Image();
    this.sitImage.crossOrigin = 'anonymous';

    this.sitImage.onload = () => {
      this.sitImageLoaded = true;
    };

    this.sitImage.onerror = (error) => {
      console.error(`Failed to load sit sprite for character ${this.id}:`, error);
      this.sitImageLoaded = false;
    };

    // Use the sit sprite from the character data
    if (this.data.sprites.sit?.url) {
      this.sitImage.src = this.data.sprites.sit.url;
    }

    // Load idle sprite
    this.loadIdleImage();
  }

  /**
   * Load the character's idle sprite
   */
  private loadIdleImage(): void {
    this.idleImage = new Image();
    this.idleImage.crossOrigin = 'anonymous';

    this.idleImage.onload = () => {
      this.idleImageLoaded = true;
    };

    this.idleImage.onerror = (error) => {
      console.error(`Failed to load idle sprite for character ${this.id}:`, error);
      this.idleImageLoaded = false;
    };

    // Use the idle sprite from the character data
    if (this.data.sprites.idle?.url) {
      this.idleImage.src = this.data.sprites.idle.url;
    }
  }

  /**
   * Update character position and state
   */
  update(deltaTime: number = 1, allCharacters: SimulationCharacter[] = [], trapCircles: TrapCircle[] = []): void {
    // Update speech timer (independent of movement state)
    if (this.speechTimer > 0) {
      this.speechTimer -= deltaTime * 16.67; // Approximate ms per frame at 60fps
      if (this.speechTimer <= 0) {
        this.speechText = '';
        // Only return to wandering if we were talking (not sitting)
        if (this.state === CharacterState.TALKING) {
          this.state = CharacterState.WANDERING;
        }
      }
    }

    // Move character
    this.move(trapCircles);

    // Handle collisions if other characters are provided
    if (allCharacters.length > 0) {
      this.handleCollisions(allCharacters);
    }

    // Update animation
    this.updateAnimation();
  }

  /**
   * Move the character and handle world boundaries
   */
  private move(trapCircles: TrapCircle[] = []): void {
    // Don't move if sitting or discussing
    if (this.state === CharacterState.SITTING || this.state === CharacterState.DISCUSSING) {
      return;
    }

    // Handle walking to audience position
    if ((this.state === CharacterState.AUDIENCE || this.state === CharacterState.PRESENTING) && this.walkingToAudiencePosition) {
      const dx = this.audienceTargetX - this.x;
      const dy = this.audienceTargetY - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 3) {
        // Arrived at target position
        this.x = this.audienceTargetX;
        this.y = this.audienceTargetY;
        this.walkingToAudiencePosition = false;
        this.vx = 0;
        this.vy = 0;
        // Face down (toward audience) for presenter, face up (toward presenter) for audience
        this.row = this.isPresenter ? Direction.DOWN : Direction.UP;
      } else {
        // Walk toward target at normal speed
        const speed = CHARACTER_CONFIG.SPEED * 1.5;
        this.vx = (dx / distance) * speed;
        this.vy = (dy / distance) * speed;
        this.x += this.vx;
        this.y += this.vy;

        // Update facing direction based on movement
        if (Math.abs(this.vx) > Math.abs(this.vy)) {
          this.row = this.vx > 0 ? Direction.RIGHT : Direction.LEFT;
        } else {
          this.row = this.vy > 0 ? Direction.DOWN : Direction.UP;
        }
      }
      return;
    }

    // Don't move if in audience/presenting (and not walking)
    if (this.state === CharacterState.AUDIENCE || this.state === CharacterState.PRESENTING) {
      return;
    }

    // Handle walking to area (then transition to wandering)
    if (this.state === CharacterState.WALKING_TO_AREA) {
      const dx = this.walkTargetX - this.x;
      const dy = this.walkTargetY - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 5) {
        // Arrived at target - transition to wandering with random velocity
        this.x = this.walkTargetX;
        this.y = this.walkTargetY;
        this.state = CharacterState.WANDERING;
        const angle = Math.random() * Math.PI * 2;
        this.vx = Math.cos(angle) * CHARACTER_CONFIG.SPEED;
        this.vy = Math.sin(angle) * CHARACTER_CONFIG.SPEED;
      } else {
        // Walk toward target at normal speed
        const speed = CHARACTER_CONFIG.SPEED * 1.5;
        this.vx = (dx / distance) * speed;
        this.vy = (dy / distance) * speed;
        this.x += this.vx;
        this.y += this.vy;

        // Update facing direction based on movement
        if (Math.abs(this.vx) > Math.abs(this.vy)) {
          this.row = this.vx > 0 ? Direction.RIGHT : Direction.LEFT;
        } else {
          this.row = this.vy > 0 ? Direction.DOWN : Direction.UP;
        }
      }
      return;
    }

    // Handle walking to interaction position
    if (this.state === CharacterState.INTERACTING && this.walkingToInteraction) {
      const dx = this.interactionTargetX - this.x;
      const dy = this.interactionTargetY - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 3) {
        // Arrived at target position
        this.x = this.interactionTargetX;
        this.y = this.interactionTargetY;
        this.walkingToInteraction = false;
        this.vx = 0;
        this.vy = 0;
      } else {
        // Walk toward target at normal speed
        const speed = CHARACTER_CONFIG.SPEED * 1.5; // Slightly faster walk
        this.vx = (dx / distance) * speed;
        this.vy = (dy / distance) * speed;
        this.x += this.vx;
        this.y += this.vy;

        // Update facing direction based on movement
        if (Math.abs(this.vx) > Math.abs(this.vy)) {
          this.row = this.vx > 0 ? Direction.RIGHT : Direction.LEFT;
        } else {
          this.row = this.vy > 0 ? Direction.DOWN : Direction.UP;
        }
      }
      return;
    }

    // Don't move if interacting (and not walking)
    if (this.state === CharacterState.INTERACTING) {
      return;
    }

    // Update position
    this.x += this.vx;
    this.y += this.vy;

    // Bounce off world boundaries
    if (this.x < 0 || this.x > WORLD_CONFIG.WIDTH) {
      this.vx *= -1;
      this.x = Math.max(0, Math.min(WORLD_CONFIG.WIDTH, this.x));
    }
    if (this.y < 0 || this.y > WORLD_CONFIG.HEIGHT) {
      this.vy *= -1;
      this.y = Math.max(0, Math.min(WORLD_CONFIG.HEIGHT, this.y));
    }

    // Randomly change direction
    if (Math.random() < CHARACTER_CONFIG.DIRECTION_CHANGE_CHANCE) {
      const angle = Math.random() * Math.PI * 2;
      this.vx = Math.cos(angle) * CHARACTER_CONFIG.SPEED;
      this.vy = Math.sin(angle) * CHARACTER_CONFIG.SPEED;
    }

    // Handle trap circle boundaries
    for (const circle of trapCircles) {
      const dx = this.x - circle.x;
      const dy = this.y - circle.y;
      const distFromCenter = Math.sqrt(dx * dx + dy * dy);
      const prevDx = (this.x - this.vx) - circle.x;
      const prevDy = (this.y - this.vy) - circle.y;
      const prevDistFromCenter = Math.sqrt(prevDx * prevDx + prevDy * prevDy);

      // Was inside, trying to exit - push back inside
      if (prevDistFromCenter < circle.radius && distFromCenter >= circle.radius) {
        const angle = Math.atan2(dy, dx);
        this.x = circle.x + Math.cos(angle) * (circle.radius - 5);
        this.y = circle.y + Math.sin(angle) * (circle.radius - 5);
        // Reverse velocity (bounce)
        this.vx *= -1;
        this.vy *= -1;
      }
      // Was outside, trying to enter - push back outside (for user-created trap circles)
      else if (prevDistFromCenter > circle.radius && distFromCenter <= circle.radius) {
        const angle = Math.atan2(dy, dx);
        this.x = circle.x + Math.cos(angle) * (circle.radius + 5);
        this.y = circle.y + Math.sin(angle) * (circle.radius + 5);
        // Reverse velocity (bounce)
        this.vx *= -1;
        this.vy *= -1;
      }
      // If character is inside circle, ensure they stay inside (continuous containment)
      else if (prevDistFromCenter < circle.radius && distFromCenter >= circle.radius - 2) {
        // Too close to edge while inside - push toward center
        const angle = Math.atan2(dy, dx);
        this.x = circle.x + Math.cos(angle) * (circle.radius - 10);
        this.y = circle.y + Math.sin(angle) * (circle.radius - 10);
        this.vx *= -1;
        this.vy *= -1;
      }
    }
  }

  /**
   * Handle collisions with other characters
   */
  private handleCollisions(others: SimulationCharacter[]): void {
    for (const other of others) {
      if (other.id === this.id) continue;

      const dx = other.x - this.x;
      const dy = other.y - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const minDistance = CHARACTER_CONFIG.HITBOX_RADIUS * 2;

      if (distance < minDistance) {
        // Collision detected: Push apart
        const angle = Math.atan2(dy, dx);

        const targetX = this.x + Math.cos(angle) * minDistance;
        const targetY = this.y + Math.sin(angle) * minDistance;

        const ax = (targetX - other.x) * 0.05;
        const ay = (targetY - other.y) * 0.05;

        this.vx -= ax;
        this.vy -= ay;
        other.vx += ax;
        other.vy += ay;
      }
    }
  }

  /**
   * Update animation frame based on movement direction
   */
  private updateAnimation(): void {
    // Determine direction based on velocity
    const absVx = Math.abs(this.vx);
    const absVy = Math.abs(this.vy);

    if (absVx > absVy) {
      // Moving more horizontally
      this.row = this.vx > 0 ? Direction.RIGHT : Direction.LEFT;
    } else {
      // Moving more vertically
      this.row = this.vy > 0 ? Direction.DOWN : Direction.UP;
    }

    // Cycle through frames
    this.tickCount += CHARACTER_CONFIG.ANIMATION_SPEED;
    if (this.tickCount >= 1) {
      this.tickCount = 0;
      this.frameIndex = (this.frameIndex + 1) % 9;
    }
  }

  /**
   * Make the character say something
   */
  ask(question: string): void {
    // Clear any pending speech
    if (this.pendingSpeechTimeout) {
      clearTimeout(this.pendingSpeechTimeout);
      this.pendingSpeechTimeout = null;
    }

    // Set speech text and timer
    this.speechText = getRandomResponse();
    this.speechTimer = SPEECH_CONFIG.DURATION_MS;

    // Only change state to TALKING if not sitting or interacting
    if (this.state !== CharacterState.SITTING && this.state !== CharacterState.INTERACTING) {
      this.state = CharacterState.TALKING;
    }
  }

  /**
   * Toggle sitting state - right click to sit/stand
   */
  toggleSit(): void {
    if (this.state === CharacterState.SITTING) {
      // Stand up - restore velocity
      this.state = CharacterState.WANDERING;
      this.vx = this.savedVx;
      this.vy = this.savedVy;
    } else {
      // Sit down - save velocity and stop
      this.savedVx = this.vx;
      this.savedVy = this.vy;
      this.vx = 0;
      this.vy = 0;
      this.state = CharacterState.SITTING;
    }
  }

  /**
   * Toggle the speech bubble visibility
   */
  toggleSpeechBubble(): void {
    this.speechBubbleHidden = !this.speechBubbleHidden;
  }

  /**
   * Start interaction with another character
   * Returns the midpoint position for creating a trap circle
   */
  startInteraction(partner: SimulationCharacter): { x: number; y: number; radius: number } | null {
    // Don't interact if already interacting
    if (this.state === CharacterState.INTERACTING || partner.state === CharacterState.INTERACTING) {
      return null;
    }

    // Determine who is dominant (higher aura) and submissive (lower aura)
    const isDominant = this.aura >= partner.aura;
    const dominant = isDominant ? this : partner;
    const submissive = isDominant ? partner : this;

    // Save velocities (for restoration when interaction ends)
    this.savedVx = this.vx;
    this.savedVy = this.vy;
    partner.savedVx = partner.vx;
    partner.savedVy = partner.vy;

    // Calculate midpoint and radius for trap circle
    const midX = (this.x + partner.x) / 2;
    const midY = (this.y + partner.y) / 2;
    const radius = 200; // Fixed radius for interaction circle

    // Set target positions (characters will walk there):
    // Use clamp to keep positions within world boundaries
    const padding = CHARACTER_CONFIG.WIDTH / 2;

    // Dominant (higher aura): right edge of circle
    dominant.interactionTargetX = clamp(midX + radius - 20, padding, WORLD_CONFIG.WIDTH - padding);
    dominant.interactionTargetY = clamp(midY, padding, WORLD_CONFIG.HEIGHT - padding);

    // Submissive (lower aura): left side of circle (further from dominant)
    submissive.interactionTargetX = clamp(midX - 25, padding, WORLD_CONFIG.WIDTH - padding);
    submissive.interactionTargetY = clamp(midY, padding, WORLD_CONFIG.HEIGHT - padding);

    // Set state and partner reference
    this.state = CharacterState.INTERACTING;
    partner.state = CharacterState.INTERACTING;
    this.interactionPartner = partner;
    partner.interactionPartner = this;

    // Set interaction roles and walking flag
    dominant.interactionRole = 'dominant';
    submissive.interactionRole = 'submissive';
    this.walkingToInteraction = true;
    partner.walkingToInteraction = true;

    // Set circle center for joining characters
    this.interactionCircleX = midX;
    this.interactionCircleY = midY;
    partner.interactionCircleX = midX;
    partner.interactionCircleY = midY;

    // Set interaction group
    this.interactionGroup = [this, partner];
    partner.interactionGroup = [this, partner];

    return { x: midX, y: midY, radius };
  }

  /**
   * End interaction with partner
   */
  endInteraction(): void {
    if (this.state !== CharacterState.INTERACTING) return;

    // End interaction for all group members
    const group = [...this.interactionGroup];

    for (const member of group) {
      member.state = CharacterState.WANDERING;
      member.vx = member.savedVx;
      member.vy = member.savedVy;
      member.interactionPartner = null;
      member.interactionRole = null;
      member.walkingToInteraction = false;
      member.interactionGroup = [];
      member.interactionCircleX = 0;
      member.interactionCircleY = 0;
    }
  }

  /**
   * Join an existing interaction (for third+ characters)
   * Returns true if successfully joined
   */
  joinInteraction(existingMember: SimulationCharacter): boolean {
    if (this.state !== CharacterState.WANDERING) return false;
    if (existingMember.state !== CharacterState.INTERACTING) return false;

    // Save velocities
    this.savedVx = this.vx;
    this.savedVy = this.vy;

    // Count current submissive members to calculate position
    const submissiveCount = existingMember.interactionGroup.filter(
      m => m.interactionRole === 'submissive'
    ).length;

    // Set target position: sit next to existing sitting character(s)
    // Each new joiner sits slightly behind and to the left
    const circleX = existingMember.interactionCircleX;
    const circleY = existingMember.interactionCircleY;

    // Use clamp to keep within world boundaries
    const padding = CHARACTER_CONFIG.WIDTH / 2;
    this.interactionTargetX = clamp(circleX - 5 - (submissiveCount * 20), padding, WORLD_CONFIG.WIDTH - padding);
    this.interactionTargetY = clamp(circleY + (submissiveCount * 30), padding, WORLD_CONFIG.HEIGHT - padding);

    // Set state
    this.state = CharacterState.INTERACTING;
    this.interactionRole = 'submissive'; // Joiners always sit
    this.walkingToInteraction = true;
    this.interactionCircleX = circleX;
    this.interactionCircleY = circleY;

    // Add to all group members
    const newGroup = [...existingMember.interactionGroup, this];
    for (const member of newGroup) {
      member.interactionGroup = newGroup;
    }
    this.interactionGroup = newGroup;

    // Set partner to the dominant member
    const dominant = existingMember.interactionGroup.find(m => m.interactionRole === 'dominant');
    if (dominant) {
      this.interactionPartner = dominant;
    }

    return true;
  }

  /**
   * Force reset to wandering state (used when switching modes)
   */
  resetToWandering(): void {
    // If interacting, end the interaction
    if (this.state === CharacterState.INTERACTING) {
      this.endInteraction();
      return; // endInteraction already sets the state
    }

    // If sitting or in audience, restore velocity
    if (this.state === CharacterState.SITTING || this.state === CharacterState.AUDIENCE || this.state === CharacterState.PRESENTING) {
      this.vx = this.savedVx || CHARACTER_CONFIG.SPEED * (Math.random() - 0.5) * 2;
      this.vy = this.savedVy || CHARACTER_CONFIG.SPEED * (Math.random() - 0.5) * 2;
      // Reset audience-specific properties
      this.isPresenter = false;
      this.walkingToAudiencePosition = false;
    }

    // Clear conversing state
    if (this.state === CharacterState.CONVERSING) {
      this.endConversing();
    }

    // Reset state
    this.state = CharacterState.WANDERING;
    this.speechText = '';
    this.speechTimer = 0;

    // Ensure character has some velocity
    if (Math.abs(this.vx) < 0.1 && Math.abs(this.vy) < 0.1) {
      const angle = Math.random() * Math.PI * 2;
      this.vx = Math.cos(angle) * CHARACTER_CONFIG.SPEED;
      this.vy = Math.sin(angle) * CHARACTER_CONFIG.SPEED;
    }
    // Reset z velocity for 3D mode
    this.vz = 0;
  }

  /**
   * Set walk target (will walk there then start wandering)
   */
  setWalkTarget(x: number, y: number): void {
    this.walkTargetX = x;
    this.walkTargetY = y;
    this.state = CharacterState.WALKING_TO_AREA;
  }

  /**
   * Join a discussion circle - stop and face the center
   */
  joinDiscussion(centerX: number, centerY: number): void {
    this.savedVx = this.vx;
    this.savedVy = this.vy;
    this.vx = 0;
    this.vy = 0;
    this.discussionCenterX = centerX;
    this.discussionCenterY = centerY;
    this.state = CharacterState.DISCUSSING;

    // Face toward the center
    const dx = centerX - this.x;
    const dy = centerY - this.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      this.row = dx > 0 ? Direction.RIGHT : Direction.LEFT;
    } else {
      this.row = dy > 0 ? Direction.DOWN : Direction.UP;
    }
  }

  /**
   * End discussion and return to wandering
   */
  endDiscussion(): void {
    if (this.state !== CharacterState.DISCUSSING) return;
    this.state = CharacterState.WANDERING;
    // Give a random velocity to start wandering
    const angle = Math.random() * Math.PI * 2;
    this.vx = Math.cos(angle) * CHARACTER_CONFIG.SPEED;
    this.vy = Math.sin(angle) * CHARACTER_CONFIG.SPEED;
  }

  /**
   * Check if this character can interact with others (not already busy)
   */
  canInteract(): boolean {
    return this.state === CharacterState.WANDERING || this.state === CharacterState.SITTING;
  }

  /**
   * Check if this character can start a conversation (not already conversing or in special state)
   */
  canConverse(): boolean {
    return (this.state === CharacterState.WANDERING || this.state === CharacterState.CONVERSING)
      && this.conversingWith === null;
  }

  /**
   * Start a lightweight conversation with another character
   * Both characters keep moving, just show speech bubbles
   */
  startConversing(partner: SimulationCharacter, durationMs: number): void {
    if (!this.canConverse() || !partner.canConverse()) return;

    // Set up this character
    this.state = CharacterState.CONVERSING;
    this.conversingWith = partner;
    this.conversingEndTime = Date.now() + durationMs;
    this.conversingBubbleText = `talking to ${partner.data.name}`;

    // Set up partner
    partner.state = CharacterState.CONVERSING;
    partner.conversingWith = this;
    partner.conversingEndTime = Date.now() + durationMs;
    partner.conversingBubbleText = `talking to ${this.data.name}`;
  }

  /**
   * End the current conversation
   */
  endConversing(): void {
    if (this.conversingWith) {
      // Clear partner's reference first
      const partner = this.conversingWith;
      if (partner.conversingWith === this) {
        partner.conversingWith = null;
        partner.conversingBubbleText = '';
        if (partner.state === CharacterState.CONVERSING) {
          partner.state = CharacterState.WANDERING;
        }
      }
    }

    // Clear this character's conversing state
    this.conversingWith = null;
    this.conversingBubbleText = '';
    if (this.state === CharacterState.CONVERSING) {
      this.state = CharacterState.WANDERING;
    }
  }

  /**
   * Set position for audience formation
   */
  setAudiencePosition(x: number, y: number, isPresenter: boolean): void {
    // Save current velocity for later restoration
    this.savedVx = this.vx;
    this.savedVy = this.vy;

    // Set target position
    this.audienceTargetX = x;
    this.audienceTargetY = y;
    this.isPresenter = isPresenter;
    this.walkingToAudiencePosition = true;

    // Set state
    this.state = isPresenter ? CharacterState.PRESENTING : CharacterState.AUDIENCE;
  }

  /**
   * Draw the character on the canvas
   */
  draw(ctx: CanvasRenderingContext2D, showInteractionRadius: boolean = true): void {
    const currentW = CHARACTER_CONFIG.WIDTH;
    const currentH = CHARACTER_CONFIG.HEIGHT;

    // Don't draw anything if sprite isn't loaded
    if (!this.imageLoaded || !this.image || !this.image.complete || this.image.naturalWidth === 0) {
      return;
    }

    ctx.save();

    // Draw hitbox visualization (for debugging)
    // ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
    // ctx.lineWidth = 1;
    // ctx.setLineDash([5, 5]); // Dotted line pattern
    // ctx.beginPath();
    // ctx.arc(this.x, this.y, CHARACTER_CONFIG.HITBOX_RADIUS, 0, Math.PI * 2);
    // ctx.stroke();
    // ctx.setLineDash([]); // Reset line dash

    // Draw interaction radius (red dotted circle) - size based on aura
    if (showInteractionRadius) {
      ctx.strokeStyle = 'rgba(163, 45, 45, 0.5)';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]); // Dotted line pattern
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.interactionRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]); // Reset line dash
    }

    // Draw shadow
    drawShadow(ctx, this.x, this.y, currentW);

    // Draw sprite based on state
    try {
      if (this.state === CharacterState.SITTING && this.sitImageLoaded && this.sitImage) {
        // Draw sitting sprite - use specific frame (row 2, col 1 in 0-indexed)
        // Sit sprite is 3 columns x 4 rows
        const sitFrameW = this.sitImage.width / 3;
        const sitFrameH = this.sitImage.height / 4;
        const sitCol = 1; // Column 2 (0-indexed = 1)
        const sitRow = 2; // Row 3 (0-indexed = 2)

        ctx.drawImage(
          this.sitImage,
          sitCol * sitFrameW, sitRow * sitFrameH, sitFrameW, sitFrameH,
          this.x - currentW / 2, this.y - currentH / 2, currentW, currentH
        );
      } else if (this.state === CharacterState.INTERACTING) {
        // If still walking to position, use walk animation
        if (this.walkingToInteraction) {
          drawSprite(
            ctx,
            this.image,
            this.frameIndex,
            this.row,
            this.x,
            this.y,
            currentW,
            currentH
          );
        } else if (this.interactionRole === 'dominant' && this.idleImageLoaded && this.idleImage) {
          // Dominant (higher aura): idle sprite, row 2 col 1 (0-indexed: row 1, col 0)
          // Idle sprite is 2 columns x 4 rows
          const idleFrameW = this.idleImage.width / 2;
          const idleFrameH = this.idleImage.height / 4;
          const idleCol = 0; // Column 1 (0-indexed = 0)
          const idleRow = 1; // Row 2 (0-indexed = 1) - facing left

          ctx.drawImage(
            this.idleImage,
            idleCol * idleFrameW, idleRow * idleFrameH, idleFrameW, idleFrameH,
            this.x - currentW / 2, this.y - currentH / 2, currentW, currentH
          );
        } else if (this.interactionRole === 'submissive' && this.sitImageLoaded && this.sitImage) {
          // Submissive (lower aura): sit sprite, row 4 col 1 (0-indexed: row 3, col 0)
          // Sit sprite is 3 columns x 4 rows
          const sitFrameW = this.sitImage.width / 3;
          const sitFrameH = this.sitImage.height / 4;
          const sitCol = 0; // Column 1 (0-indexed = 0)
          const sitRow = 3; // Row 4 (0-indexed = 3) - facing right

          ctx.drawImage(
            this.sitImage,
            sitCol * sitFrameW, sitRow * sitFrameH, sitFrameW, sitFrameH,
            this.x - currentW / 2, this.y - currentH / 2, currentW, currentH
          );
        } else if (this.idleImageLoaded && this.idleImage) {
          // Fallback: use idle sprite with current direction
          const idleFrameW = this.idleImage.width / 2;
          const idleFrameH = this.idleImage.height / 4;
          ctx.drawImage(
            this.idleImage,
            0, this.row * idleFrameH, idleFrameW, idleFrameH,
            this.x - currentW / 2, this.y - currentH / 2, currentW, currentH
          );
        }
      } else if (this.state === CharacterState.PRESENTING) {
        // Presenter: if walking, use walk animation; otherwise use idle facing down
        if (this.walkingToAudiencePosition) {
          drawSprite(
            ctx,
            this.image,
            this.frameIndex,
            this.row,
            this.x,
            this.y,
            currentW,
            currentH
          );
        } else if (this.idleImageLoaded && this.idleImage) {
          // Idle sprite: row 0 (facing down), col 0
          const idleFrameW = this.idleImage.width / 2;
          const idleFrameH = this.idleImage.height / 4;
          const idleCol = 0;
          const idleRow = 0; // Row 1 (0-indexed = 0) - facing up (back to user)

          ctx.drawImage(
            this.idleImage,
            idleCol * idleFrameW, idleRow * idleFrameH, idleFrameW, idleFrameH,
            this.x - currentW / 2, this.y - currentH / 2, currentW, currentH
          );
        }
      } else if (this.state === CharacterState.AUDIENCE) {
        // Audience: if walking, use walk animation; otherwise sit facing up (toward presenter)
        if (this.walkingToAudiencePosition) {
          drawSprite(
            ctx,
            this.image,
            this.frameIndex,
            this.row,
            this.x,
            this.y,
            currentW,
            currentH
          );
        } else if (this.sitImageLoaded && this.sitImage) {
          // Sit sprite: row 3 col 1 (facing down, faces visible to user)
          const sitFrameW = this.sitImage.width / 3;
          const sitFrameH = this.sitImage.height / 4;
          const sitCol = 1;
          const sitRow = 2; // Row 3 (0-indexed = 2) - facing down

          ctx.drawImage(
            this.sitImage,
            sitCol * sitFrameW, sitRow * sitFrameH, sitFrameW, sitFrameH,
            this.x - currentW / 2, this.y - currentH / 2, currentW, currentH
          );
        }
      } else if (this.state === CharacterState.DISCUSSING) {
        // Discussing: use idle sprite facing the discussion center
        if (this.idleImageLoaded && this.idleImage) {
          const idleFrameW = this.idleImage.width / 2;
          const idleFrameH = this.idleImage.height / 4;
          // Use current row (direction) set when joining discussion
          ctx.drawImage(
            this.idleImage,
            0, this.row * idleFrameH, idleFrameW, idleFrameH,
            this.x - currentW / 2, this.y - currentH / 2, currentW, currentH
          );
        }
      } else {
        // Draw walk sprite
        drawSprite(
          ctx,
          this.image,
          this.frameIndex,
          this.row,
          this.x,
          this.y,
          currentW,
          currentH
        );
      }
    } catch (error) {
      // Silently fail if sprite drawing fails
      console.error('Error drawing sprite:', error);
    }

    // Draw speech bubble if has speech text and not hidden (independent of movement state)
    if (this.speechText && !this.speechBubbleHidden) {
      drawSpeechBubble(ctx, this.x, this.y - currentH / 2, this.speechText, 12);
    }

    ctx.restore();
  }

  /**
   * Cleanup method to clear timeouts
   */
  cleanup(): void {
    if (this.pendingSpeechTimeout) {
      clearTimeout(this.pendingSpeechTimeout);
      this.pendingSpeechTimeout = null;
    }
  }
}
