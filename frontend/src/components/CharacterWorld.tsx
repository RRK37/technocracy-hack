/**
 * Main character world simulation component
 */

'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { WorldCanvas } from './WorldCanvas';
import { WorldControls, SidebarToggleButton } from './WorldControls';
import { useCharacterData } from '@/src/hooks/useCharacterData';
import { useCamera } from '@/src/hooks/useCamera';
import { useGameLoop } from '@/src/hooks/useGameLoop';
import { SimulationCharacter } from '@/src/lib/character';
import { getRandomPosition, getRandomVelocity, TrapCircle, CHARACTER_CONFIG, CONVERSING_CONFIG, GRAVITY_CONFIG, CharacterState, WorldMode, MODE_CONFIG, WORLD_CONFIG, PitchStage } from '@/src/lib/world';
import { InteractionGraph } from '@/src/lib/interactionGraph';
import { InteractionGraphHistory, HISTORY_CONFIG, GraphSnapshot } from '@/src/lib/interactionGraphHistory';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';

// Context data from Pitch mode setup
export interface PitchContext {
  company: string;
  agentIds: number[];
  userId: number;
}

interface CharacterWorldProps {
  initialMode?: WorldMode;
  onBack?: () => void;
  pitchContext?: PitchContext;
}

export function CharacterWorld({ initialMode = WorldMode.INTERACTIVE, onBack, pitchContext }: CharacterWorldProps) {
  // Load character data
  const { characters: characterData, isLoading, isError } = useCharacterData();

  // Canvas dimensions (will be updated on mount)
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  // Camera controls
  const {
    camera,
    isDragging,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  } = useCamera(canvasSize.width, canvasSize.height);

  // Trap circles state
  const [trapCircles, setTrapCircles] = useState<TrapCircle[]>([]);

  // Toggle for showing interaction radius circles
  const [showInteractionRadius, setShowInteractionRadius] = useState(true);

  // Toggle for showing trap circles
  const [showTrapCircles, setShowTrapCircles] = useState(true);

  // Toggle for gravity attraction effect
  const [gravityEnabled, setGravityEnabled] = useState(true);

  // World mode state (initialized from prop)
  const [worldMode, setWorldMode] = useState<WorldMode>(initialMode);
  const modeConfig = MODE_CONFIG[worldMode];

  // Discussion system state (for DISCUSS mode)
  const discussionGroup = useRef<SimulationCharacter[]>([]);
  const discussionEndTime = useRef<number>(0);
  const lastDiscussionTime = useRef<number>(0);

  // Pitch mode stage (for PITCH mode)
  const [pitchStage, setPitchStage] = useState<PitchStage>(PitchStage.IDLE);

  // Script display state (for PITCH mode)
  const [scriptPlan, setScriptPlan] = useState<string | null>(null);
  const [script, setScript] = useState<string | null>(null);
  const [displayedChunks, setDisplayedChunks] = useState<string[]>([]);
  const [currentSpeechChunk, setCurrentSpeechChunk] = useState<string | null>(null);
  const [isLoadingScript, setIsLoadingScript] = useState(false);
  const scriptChunksRef = useRef<string[]>([]);
  const chunkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const presenterRef = useRef<SimulationCharacter | null>(null);
  const positionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Discussion speech bubbles state (for DISCUSSING stage) - stores characterId to look up position dynamically
  const [discussionBubbles, setDiscussionBubbles] = useState<Array<{ characterId: number; text: string }>>([]);
  const discussionConversationRef = useRef<Array<{ agentId: number; message: string }>>([]);
  const discussionMessageIndexRef = useRef(0);
  const discussionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Interaction graph for abstract layer visualization (tracks conversation history)
  const interactionGraphRef = useRef(new InteractionGraph());

  // History for time-travel playback
  const historyRef = useRef(new InteractionGraphHistory());
  const lastSnapshotTimeRef = useRef(0);

  // Playback mode state
  const [isPlaybackMode, setIsPlaybackMode] = useState(false);
  const [playbackSnapshot, setPlaybackSnapshot] = useState<GraphSnapshot | null>(null);
  const [playbackIndex, setPlaybackIndex] = useState(0);

  // Add a new trap circle
  const addTrapCircle = useCallback((circle: TrapCircle) => {
    setTrapCircles((prev) => [...prev, circle]);
  }, []);

  // Remove a trap circle by ID
  const removeTrapCircle = useCallback((id: string) => {
    setTrapCircles((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // Clear all trap circles
  const clearAllTrapCircles = useCallback(() => {
    setTrapCircles([]);
  }, []);

  // Initialize simulation characters
  const simulationCharacters = useMemo(() => {
    if (!characterData.length) return [];

    return characterData.map((char) => {
      const { x, y } = getRandomPosition();
      const { vx, vy } = getRandomVelocity();
      return new SimulationCharacter(char, x, y, vx, vy);
    });
  }, [characterData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      simulationCharacters.forEach((char) => char.cleanup());
    };
  }, [simulationCharacters]);

  // Update canvas size on mount/resize
  useEffect(() => {
    const updateSize = () => {
      setCanvasSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Track which trap circles are from interactions (for auto-removal)
  const interactionTrapCircleIds = useRef<Map<string, string>>(new Map()); // characterId -> trapCircleId

  // Reset all characters when switching to Observe mode
  useEffect(() => {
    if (worldMode === WorldMode.OBSERVE && simulationCharacters.length > 0) {
      // Reset all characters to wandering
      simulationCharacters.forEach((char) => char.resetToWandering());
      // Clear all trap circles
      setTrapCircles([]);
      interactionTrapCircleIds.current.clear();
    }
  }, [worldMode, simulationCharacters]);

  // Arrange characters in audience formation when switching to PRESENTING mode
  useEffect(() => {
    if (worldMode === WorldMode.PRESENTING && modeConfig.audienceFormation && simulationCharacters.length > 0) {
      // First reset all characters
      simulationCharacters.forEach((char) => char.resetToWandering());
      setTrapCircles([]);
      interactionTrapCircleIds.current.clear();

      // Find Jordan as presenter (or first character if Jordan not found)
      const presenter = simulationCharacters.find((char) =>
        char.data.name.toLowerCase() === 'jordan'
      ) || simulationCharacters[0];

      // Calculate formation positions centered in world
      const centerX = WORLD_CONFIG.WIDTH / 2;
      const centerY = WORLD_CONFIG.HEIGHT / 2;

      // Set presenter position (front center - at bottom facing away from user)
      presenter.setAudiencePosition(centerX, centerY + 200, true);

      // Arrange audience in rows above presenter (facing down toward user)
      const audience = simulationCharacters.filter((c) => c !== presenter);
      const cols = Math.min(8, Math.ceil(Math.sqrt(audience.length * 1.5))); // Wider than tall
      const spacingX = 80;
      const spacingY = 70;
      const startY = centerY - 100; // Start above presenter

      audience.forEach((char, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        // Center each row
        const rowCharCount = Math.min(cols, audience.length - row * cols);
        const rowStartX = centerX - ((rowCharCount - 1) * spacingX) / 2;
        const x = rowStartX + col * spacingX;
        const y = startY - row * spacingY; // Rows go upward (negative Y)
        char.setAudiencePosition(x, y, false);
      });
    }
  }, [worldMode, modeConfig.audienceFormation, simulationCharacters]);

  // DISCUSS mode: Waiting room - audience in top-left, Jordan on right
  useEffect(() => {
    if (worldMode === WorldMode.DISCUSS && simulationCharacters.length > 0) {
      // Reset all characters first
      simulationCharacters.forEach((char) => char.resetToWandering());
      setTrapCircles([]);
      interactionTrapCircleIds.current.clear();

      // Find Jordan as presenter (or first character if Jordan not found)
      const presenter = simulationCharacters.find((char) =>
        char.data.name.toLowerCase() === 'jordan'
      ) || simulationCharacters[0];

      // Calculate dimensions for top-left area (15% of world = ~38% width/height)
      const areaWidth = WORLD_CONFIG.WIDTH * 0.38;
      const areaHeight = WORLD_CONFIG.HEIGHT * 0.38;
      const centerX = areaWidth / 2;
      const centerY = areaHeight / 2;
      const radius = Math.min(areaWidth, areaHeight) / 2 - 50; // Circular trap area

      // Create trap circle in top-left corner
      const trapCircle: TrapCircle = {
        id: `discuss-trap-${Date.now()}`,
        x: centerX + 50, // Offset from edge
        y: centerY + 50,
        radius: radius,
      };
      setTrapCircles([trapCircle]);

      // Position Jordan on the right side, standing and facing left
      const jordanX = WORLD_CONFIG.WIDTH * 0.8;
      const jordanY = WORLD_CONFIG.HEIGHT / 2;
      presenter.setAudiencePosition(jordanX, jordanY, true);

      // Walk audience characters to the trap circle area
      const audience = simulationCharacters.filter((c) => c !== presenter);
      audience.forEach((char) => {
        // Random target position within the trap circle
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * (radius - 30);
        const targetX = trapCircle.x + Math.cos(angle) * dist;
        const targetY = trapCircle.y + Math.sin(angle) * dist;
        // Set walk target (will walk there then start wandering)
        char.setWalkTarget(targetX, targetY);
      });
    }
  }, [worldMode, simulationCharacters]);

  // SCRATCH mode: Reset to wandering (basic sandbox for new experiments)
  useEffect(() => {
    if (worldMode === WorldMode.SCRATCH && simulationCharacters.length > 0) {
      // Reset all characters to wandering
      simulationCharacters.forEach((char) => char.resetToWandering());
      // Clear all trap circles
      setTrapCircles([]);
      interactionTrapCircleIds.current.clear();
    }
  }, [worldMode, simulationCharacters]);

  // ABSTRACT_LAYERS mode: Reset to wandering (copy of SCRATCH for new feature development)
  useEffect(() => {
    if (worldMode === WorldMode.ABSTRACT_LAYERS && simulationCharacters.length > 0) {
      // Reset all characters to wandering
      simulationCharacters.forEach((char) => char.resetToWandering());
      // Clear all trap circles
      setTrapCircles([]);
      interactionTrapCircleIds.current.clear();
    }
  }, [worldMode, simulationCharacters]);

  // Snapshot timer for time history (only in Abstract Layers mode, not during playback)
  useEffect(() => {
    if (worldMode !== WorldMode.ABSTRACT_LAYERS || isPlaybackMode) return;

    const intervalId = setInterval(() => {
      const now = Date.now();
      if (now - lastSnapshotTimeRef.current >= HISTORY_CONFIG.SNAPSHOT_INTERVAL_MS) {
        lastSnapshotTimeRef.current = now;

        // Take snapshot of graph edges and character positions
        const edges = interactionGraphRef.current.getAllEdges();
        const positions = simulationCharacters.map(c => ({
          id: c.id,
          x: c.x,
          y: c.y,
        }));

        historyRef.current.takeSnapshot(edges, positions);
      }
    }, 100); // Check frequently, but snapshot at configured interval

    return () => clearInterval(intervalId);
  }, [worldMode, isPlaybackMode, simulationCharacters]);

  // PITCH mode: Reset to IDLE stage when entering
  useEffect(() => {
    if (worldMode === WorldMode.PITCH) {
      setPitchStage(PitchStage.IDLE);
      // Reset characters to wandering
      simulationCharacters.forEach((char) => char.resetToWandering());
      setTrapCircles([]);
      interactionTrapCircleIds.current.clear();
      // Reset discussion state
      discussionGroup.current = [];
      discussionEndTime.current = 0;
      lastDiscussionTime.current = 0;
      // Reset script state
      setScriptPlan(null);
      setScript(null);
      setDisplayedChunks([]);
    }
  }, [worldMode]);

  // PITCH mode: Poll for when characters are in position and fetch script
  useEffect(() => {
    if (worldMode !== WorldMode.PITCH || pitchStage !== PitchStage.PRESENTING) {
      // Clear interval when not in PRESENTING
      if (positionCheckIntervalRef.current) {
        clearInterval(positionCheckIntervalRef.current);
        positionCheckIntervalRef.current = null;
      }
      return;
    }
    if (script) return; // Already have script
    if (!scriptPlan) return; // Wait for plan first

    // Start polling for position
    positionCheckIntervalRef.current = setInterval(() => {
      const allInPosition = simulationCharacters.every(
        (char) => !char.walkingToAudiencePosition
      );

      if (allInPosition && simulationCharacters.length > 0 && !isLoadingScript) {
        // Stop polling
        if (positionCheckIntervalRef.current) {
          clearInterval(positionCheckIntervalRef.current);
          positionCheckIntervalRef.current = null;
        }

        // Fetch the full script
        setIsLoadingScript(true);
        fetch('http://localhost:8000/api/script', { method: 'POST' })
          .then((res) => res.json())
          .then((fullScript: string) => {
            setScript(fullScript);
            setIsLoadingScript(false);

            // Break into chunks (sentences)
            const chunks = fullScript.split(/(?<=[.!?])\s+/).filter((s: string) => s.trim());
            scriptChunksRef.current = chunks;

            // Display chunks one by one with speech bubble
            let index = 0;
            if (chunks.length > 0) {
              setCurrentSpeechChunk(chunks[0]);
              setDisplayedChunks([chunks[0]]);
              index = 1;
            }
            chunkIntervalRef.current = setInterval(() => {
              if (index < chunks.length) {
                setCurrentSpeechChunk(chunks[index]);
                setDisplayedChunks((prev) => [...prev, chunks[index]]);
                index++;
              } else {
                setCurrentSpeechChunk(null); // Done speaking
                if (chunkIntervalRef.current) {
                  clearInterval(chunkIntervalRef.current);
                }
              }
            }, 3000); // 3 seconds per chunk
          })
          .catch((err) => {
            console.error('Failed to fetch script, using dummy:', err);
            // Dummy fallback for testing
            const dummyScript = "Good morning everyone, thank you for having me today. I'm excited to share my vision for revolutionizing the industry. The problem we're solving affects millions of people daily. Our solution is elegant and scalable. We've already seen incredible traction with early users. We're seeking investment to accelerate growth. I'd love to answer any questions you have.";
            setScript(dummyScript);
            setIsLoadingScript(false);

            const chunks = dummyScript.split(/(?<=[.!?])\s+/).filter((s: string) => s.trim());
            scriptChunksRef.current = chunks;

            let index = 0;
            if (chunks.length > 0) {
              setCurrentSpeechChunk(chunks[0]);
              setDisplayedChunks([chunks[0]]);
              index = 1;
            }
            chunkIntervalRef.current = setInterval(() => {
              if (index < chunks.length) {
                setCurrentSpeechChunk(chunks[index]);
                setDisplayedChunks((prev) => [...prev, chunks[index]]);
                index++;
              } else {
                setCurrentSpeechChunk(null);
                if (chunkIntervalRef.current) {
                  clearInterval(chunkIntervalRef.current);
                }
              }
            }, 3000);
          });
      }
    }, 500); // Check every 500ms

    return () => {
      if (positionCheckIntervalRef.current) {
        clearInterval(positionCheckIntervalRef.current);
      }
    };
  }, [worldMode, pitchStage, script, scriptPlan, simulationCharacters.length]);

  // Handle pitch stage transitions
  const advancePitchStage = useCallback(() => {
    if (worldMode !== WorldMode.PITCH) return;

    // End any active discussions
    discussionGroup.current.forEach((char) => char.endDiscussion());
    discussionGroup.current = [];

    if (pitchStage === PitchStage.IDLE) {
      // Start Pitching -> PRESENTING stage
      setPitchStage(PitchStage.PRESENTING);

      // Clear previous script state
      setScriptPlan(null);
      setScript(null);
      setDisplayedChunks([]);
      if (chunkIntervalRef.current) {
        clearInterval(chunkIntervalRef.current);
      }

      // Fetch script plan immediately
      setIsLoadingScript(true);
      fetch('http://localhost:8000/api/script_plan', { method: 'POST' })
        .then((res) => res.json())
        .then((plan) => {
          setScriptPlan(plan);
          setIsLoadingScript(false);
        })
        .catch((err) => {
          console.error('Failed to fetch script plan, using dummy:', err);
          // Dummy fallback for testing
          setScriptPlan('1. Introduce yourself and your background. 2. Present the problem you are solving. 3. Explain your unique solution. 4. Show market opportunity and traction. 5. Ask for investment.');
          setIsLoadingScript(false);
        });

      // Set up audience formation (same as PRESENTING mode)
      simulationCharacters.forEach((char) => char.resetToWandering());
      setTrapCircles([]);

      const presenter = simulationCharacters.find((char) =>
        char.data.name.toLowerCase() === 'jordan'
      ) || simulationCharacters[0];
      presenterRef.current = presenter; // Save for speech bubble

      const centerX = WORLD_CONFIG.WIDTH / 2;
      const centerY = WORLD_CONFIG.HEIGHT / 2;
      presenter.setAudiencePosition(centerX, centerY + 200, true);

      const audience = simulationCharacters.filter((c) => c !== presenter);
      const cols = Math.min(8, Math.ceil(Math.sqrt(audience.length * 1.5)));
      const spacingX = 80;
      const spacingY = 70;
      const startY = centerY - 100;

      audience.forEach((char, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const rowCharCount = Math.min(cols, audience.length - row * cols);
        const rowStartX = centerX - ((rowCharCount - 1) * spacingX) / 2;
        const x = rowStartX + col * spacingX;
        const y = startY - row * spacingY;
        char.setAudiencePosition(x, y, false);
      });

    } else if (pitchStage === PitchStage.PRESENTING) {
      // Next -> DISCUSSING stage
      setPitchStage(PitchStage.DISCUSSING);

      // Clear presenter speech bubble
      setCurrentSpeechChunk(null);
      if (chunkIntervalRef.current) {
        clearInterval(chunkIntervalRef.current);
        chunkIntervalRef.current = null;
      }

      // Set up discuss formation (same as DISCUSS mode)
      simulationCharacters.forEach((char) => char.resetToWandering());
      setTrapCircles([]);

      const presenter = simulationCharacters.find((char) =>
        char.data.name.toLowerCase() === 'jordan'
      ) || simulationCharacters[0];

      const areaWidth = WORLD_CONFIG.WIDTH * 0.38;
      const areaHeight = WORLD_CONFIG.HEIGHT * 0.38;
      const centerX = areaWidth / 2;
      const centerY = areaHeight / 2;
      const radius = Math.min(areaWidth, areaHeight) / 2 - 50;

      const trapCircle: TrapCircle = {
        id: `pitch-trap-${Date.now()}`,
        x: centerX + 50,
        y: centerY + 50,
        radius: radius,
      };
      setTrapCircles([trapCircle]);

      const jordanX = WORLD_CONFIG.WIDTH * 0.8;
      const jordanY = WORLD_CONFIG.HEIGHT / 2;
      presenter.setAudiencePosition(jordanX, jordanY, true);

      const audience = simulationCharacters.filter((c) => c !== presenter);
      audience.forEach((char) => {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * (radius - 30);
        const targetX = trapCircle.x + Math.cos(angle) * dist;
        const targetY = trapCircle.y + Math.sin(angle) * dist;
        char.setWalkTarget(targetX, targetY);
      });

      // Reset discussion timers
      lastDiscussionTime.current = Date.now();

      // Clear previous discussion bubbles
      setDiscussionBubbles([]);
      discussionMessageIndexRef.current = 0;
      if (discussionIntervalRef.current) {
        clearInterval(discussionIntervalRef.current);
      }

      // Fetch agent conversation
      fetch('http://localhost:8000/api/agent_conversation', { method: 'POST' })
        .then((res) => res.json())
        .then((conversation: Array<{ agent_id: number; message: string }>) => {
          // Parse conversation into array of {agentId, message}
          const parsed = conversation.map((item) => ({
            agentId: item.agent_id,
            message: item.message || '',
          }));
          discussionConversationRef.current = parsed;

          // Animate discussion bubbles
          if (parsed.length > 0) {
            const showNextMessage = () => {
              const idx = discussionMessageIndexRef.current;
              if (idx >= parsed.length) {
                discussionMessageIndexRef.current = 0; // Loop or stop
                setDiscussionBubbles([]);
                return;
              }

              const msg = parsed[idx];
              const char = simulationCharacters.find((c) => c.data.id === msg.agentId) || audience[idx % audience.length];

              if (char) {
                setDiscussionBubbles([{
                  characterId: char.data.id,
                  text: msg.message,
                }]);
              }

              discussionMessageIndexRef.current = idx + 1;
            };

            showNextMessage();
            discussionIntervalRef.current = setInterval(showNextMessage, 4000);
          }
        })
        .catch((err) => {
          console.error('Failed to fetch agent conversation, using dummy:', err);
          // Dummy fallback
          const dummyConversation = [
            { agentId: 1, message: "That pitch was really compelling!" },
            { agentId: 2, message: "I agree, the market opportunity is huge." },
            { agentId: 3, message: "But what about the competition?" },
            { agentId: 1, message: "Good point, we should ask about that." },
          ];
          discussionConversationRef.current = dummyConversation;

          const showNextMessage = () => {
            const idx = discussionMessageIndexRef.current;
            if (idx >= dummyConversation.length) {
              discussionMessageIndexRef.current = 0;
              setDiscussionBubbles([]);
              return;
            }

            const msg = dummyConversation[idx];
            const char = simulationCharacters.find((c) => c.data.id === msg.agentId) || audience[idx % audience.length];

            if (char) {
              setDiscussionBubbles([{
                characterId: char.data.id,
                text: msg.message,
              }]);
            }

            discussionMessageIndexRef.current = idx + 1;
          };

          showNextMessage();
          discussionIntervalRef.current = setInterval(showNextMessage, 4000);
        });

    } else if (pitchStage === PitchStage.DISCUSSING) {
      // Next -> back to PRESENTING stage
      setPitchStage(PitchStage.PRESENTING);

      // Clear discussion bubbles
      setDiscussionBubbles([]);
      if (discussionIntervalRef.current) {
        clearInterval(discussionIntervalRef.current);
        discussionIntervalRef.current = null;
      }

      simulationCharacters.forEach((char) => char.resetToWandering());
      setTrapCircles([]);

      const presenter = simulationCharacters.find((char) =>
        char.data.name.toLowerCase() === 'jordan'
      ) || simulationCharacters[0];

      const centerX = WORLD_CONFIG.WIDTH / 2;
      const centerY = WORLD_CONFIG.HEIGHT / 2;
      presenter.setAudiencePosition(centerX, centerY + 200, true);

      const audience = simulationCharacters.filter((c) => c !== presenter);
      const cols = Math.min(8, Math.ceil(Math.sqrt(audience.length * 1.5)));
      const spacingX = 80;
      const spacingY = 70;
      const startY = centerY - 100;

      audience.forEach((char, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const rowCharCount = Math.min(cols, audience.length - row * cols);
        const rowStartX = centerX - ((rowCharCount - 1) * spacingX) / 2;
        const x = rowStartX + col * spacingX;
        const y = startY - row * spacingY;
        char.setAudiencePosition(x, y, false);
      });
    }
  }, [worldMode, pitchStage, simulationCharacters]);

  // Game loop - update all characters and check for interactions
  useGameLoop(
    useCallback(
      (deltaTime) => {
        // Update all characters
        simulationCharacters.forEach((char) => char.update(deltaTime, simulationCharacters, trapCircles));

        // Check for potential interactions between characters (only in interactive mode)
        if (modeConfig.interactions) {
          for (let i = 0; i < simulationCharacters.length; i++) {
            const char1 = simulationCharacters[i];
            if (!char1.canInteract()) continue;

            for (let j = i + 1; j < simulationCharacters.length; j++) {
              const char2 = simulationCharacters[j];
              if (!char2.canInteract()) continue;

              // Check if interaction radii overlap
              const dx = char2.x - char1.x;
              const dy = char2.y - char1.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              const combinedRadius = char1.interactionRadius + char2.interactionRadius;

              if (distance < combinedRadius) {
                // Roll for interaction
                if (Math.random() < CHARACTER_CONFIG.INTERACTION_CHANCE) {
                  const circleInfo = char1.startInteraction(char2);
                  if (circleInfo) {
                    // Create auto trap circle
                    const trapId = `interaction-${Date.now()}`;
                    const newCircle: TrapCircle = {
                      id: trapId,
                      x: circleInfo.x,
                      y: circleInfo.y,
                      radius: circleInfo.radius,
                    };
                    addTrapCircle(newCircle);
                    // Track this circle for the characters
                    interactionTrapCircleIds.current.set(char1.id, trapId);
                    interactionTrapCircleIds.current.set(char2.id, trapId);
                  }
                }
              }
            }
          }
        } // end if modeConfig.interactions

        // Check for characters joining existing interactions (only in interactive mode)
        if (modeConfig.interactions) {
          for (const char of simulationCharacters) {
            if (char.state !== CharacterState.WANDERING) continue;

            // Check if near any interaction trap circle
            for (const circle of trapCircles) {
              if (!circle.id.startsWith('interaction-')) continue;

              const dx = char.x - circle.x;
              const dy = char.y - circle.y;
              const dist = Math.sqrt(dx * dx + dy * dy);

              // If within interaction range of the circle
              if (dist < circle.radius + char.interactionRadius) {
                // Find an interacting character in this circle
                const interactingMember = simulationCharacters.find(
                  c => c.state === CharacterState.INTERACTING &&
                    interactionTrapCircleIds.current.get(c.id) === circle.id
                );

                if (interactingMember && Math.random() < CHARACTER_CONFIG.INTERACTION_CHANCE * 0.5) {
                  // Try to join the interaction
                  if (char.joinInteraction(interactingMember)) {
                    // Track this character with the same circle
                    interactionTrapCircleIds.current.set(char.id, circle.id);
                  }
                }
              }
            }
          }
        } // end if modeConfig.interactions

        // Auto-discussion system for DISCUSS mode and PITCH mode DISCUSSING stage
        if (worldMode === WorldMode.DISCUSS || (worldMode === WorldMode.PITCH && pitchStage === PitchStage.DISCUSSING)) {
          const now = Date.now();

          // Check if current discussion has ended
          if (discussionGroup.current.length > 0 && now >= discussionEndTime.current) {
            // End current discussion
            discussionGroup.current.forEach((char) => char.endDiscussion());
            discussionGroup.current = [];
            lastDiscussionTime.current = now;
          }

          // If no active discussion, maybe start one
          if (discussionGroup.current.length === 0) {
            const timeSinceLastDiscussion = now - lastDiscussionTime.current;
            const cooldownPassed = timeSinceLastDiscussion > 2000; // 2 second cooldown

            // Get wandering characters (excluding Jordan who is presenting)
            const availableChars = simulationCharacters.filter(
              (c) => c.state === CharacterState.WANDERING
            );

            // Random chance to start discussion (higher chance if cooldown just passed)
            const chance = cooldownPassed ? 0.02 : 0; // 2% per frame after cooldown

            if (availableChars.length >= 2 && Math.random() < chance) {
              // Pick 2-4 random characters
              const groupSize = Math.min(2 + Math.floor(Math.random() * 3), availableChars.length);
              const shuffled = [...availableChars].sort(() => Math.random() - 0.5);
              const group = shuffled.slice(0, groupSize);

              // Calculate center point of the group
              const centerX = group.reduce((sum, c) => sum + c.x, 0) / group.length;
              const centerY = group.reduce((sum, c) => sum + c.y, 0) / group.length;

              // Start discussion
              group.forEach((char) => char.joinDiscussion(centerX, centerY));
              discussionGroup.current = group;
              discussionEndTime.current = now + 10000; // 10 seconds
            }
          }
        }

        // Conversing system for ABSTRACT_LAYERS mode (lightweight talking while moving)
        if (modeConfig.conversing) {
          const now = Date.now();

          // Track ongoing conversations for the interaction graph
          for (const char of simulationCharacters) {
            if (char.state === CharacterState.CONVERSING && char.conversingWith) {
              // Record interaction time (deltaTime is in frames, ~16.67ms per frame at 60fps)
              interactionGraphRef.current.recordInteraction(
                char.id,
                char.conversingWith.id,
                deltaTime * 16.67
              );
            }
          }

          // Check for ended conversations
          for (const char of simulationCharacters) {
            if (char.state === CharacterState.CONVERSING && char.conversingWith && now >= char.conversingEndTime) {
              char.endConversing();
            }
          }

          // Random chance to start new conversations
          if (Math.random() < CONVERSING_CONFIG.CHANCE_PER_FRAME) {
            // Get characters that can converse (not already conversing with someone)
            const availableChars = simulationCharacters.filter((c) => c.canConverse());

            if (availableChars.length >= 2) {
              // Pick two random characters
              const shuffled = [...availableChars].sort(() => Math.random() - 0.5);
              const char1 = shuffled[0];
              const char2 = shuffled[1];

              // Random duration between min and max
              const duration = CONVERSING_CONFIG.MIN_DURATION_MS +
                Math.random() * (CONVERSING_CONFIG.MAX_DURATION_MS - CONVERSING_CONFIG.MIN_DURATION_MS);

              char1.startConversing(char2, duration);
            }
          }

          // Decay edges for pairs not currently conversing
          // Build set of active conversation edge keys
          const activeConversations = new Set<string>();
          for (const char of simulationCharacters) {
            if (char.state === CharacterState.CONVERSING && char.conversingWith) {
              const key = InteractionGraph.getEdgeKey(char.id, char.conversingWith.id);
              activeConversations.add(key);
            }
          }

          // Linear decay: 20ms weight per second (a 10s conversation fades in ~500ms... adjust as needed)
          const DECAY_PER_SECOND = 1000; // Fixed amount subtracted per second
          interactionGraphRef.current.decayAllEdges(
            DECAY_PER_SECOND,
            deltaTime * 16.67,
            activeConversations
          );

          // Gravity attraction: agents with connections pull toward each other
          if (GRAVITY_CONFIG.ENABLED && gravityEnabled) {
            for (const char of simulationCharacters) {
              // Get all edges for this character
              const edges = interactionGraphRef.current.getEdgesForCharacter(char.id);

              for (const edge of edges) {
                // Find the partner character
                const partner = simulationCharacters.find(c => c.id === edge.partnerId);
                if (!partner) continue;

                // Calculate direction to partner
                const dx = partner.x - char.x;
                const dy = partner.y - char.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // Skip if too close (prevent overlap)
                if (distance < GRAVITY_CONFIG.MIN_DISTANCE) continue;

                // Normalize direction
                const nx = dx / distance;
                const ny = dy / distance;

                // Calculate force based on edge weight
                // Force = strength * weight, capped at max
                const force = Math.min(
                  GRAVITY_CONFIG.STRENGTH * edge.weight,
                  GRAVITY_CONFIG.MAX_FORCE
                );

                // Apply force to velocity
                char.vx += nx * force * deltaTime;
                char.vy += ny * force * deltaTime;
              }
            }
          }
        }
      },
      [simulationCharacters, trapCircles, addTrapCircle, modeConfig.interactions, modeConfig.conversing, gravityEnabled, worldMode, pitchStage]
    ),
    simulationCharacters.length > 0
  );

  // End interaction and remove associated trap circle
  const endCharacterInteraction = useCallback((character: SimulationCharacter) => {
    const trapId = interactionTrapCircleIds.current.get(character.id);
    if (trapId) {
      // Remove trap circle
      removeTrapCircle(trapId);
      // Clean up tracking for all group members
      for (const member of character.interactionGroup) {
        interactionTrapCircleIds.current.delete(member.id);
      }
    }
    character.endInteraction();
  }, [removeTrapCircle]);

  // Handle ask question
  const handleAsk = useCallback(
    (question: string) => {
      simulationCharacters.forEach((char) => char.ask(question));
    },
    [simulationCharacters]
  );

  // Loading state (only for character data, not sprites)
  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-screen h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-xl">Loading character data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="flex items-center justify-center w-screen h-screen bg-gray-900 text-white">
        <div className="text-center">
          <p className="text-xl text-red-500 mb-4">Failed to load character data</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 rounded-md transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      defaultOpen={true}
      style={{
        '--sidebar-width': '24rem',
        '--sidebar-width-mobile': '20rem',
      } as React.CSSProperties}
    >
      <SidebarInset className="overflow-hidden bg-gray-900 p-0 m-0">
        <div className="relative w-full h-full">
          <SidebarToggleButton />
          <WorldCanvas
            characters={simulationCharacters}
            camera={camera}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            isDragging={isDragging}
            trapCircles={trapCircles}
            onAddTrapCircle={addTrapCircle}
            onRemoveTrapCircle={removeTrapCircle}
            onEndInteraction={endCharacterInteraction}
            showInteractionRadius={modeConfig.interactionRadius && showInteractionRadius}
            showTrapCircles={modeConfig.trapCircles && showTrapCircles}
            modeConfig={modeConfig}
            speechBubble={currentSpeechChunk && presenterRef.current ? {
              text: currentSpeechChunk,
              x: presenterRef.current.x,
              y: presenterRef.current.y,
            } : undefined}
            discussionBubbles={discussionBubbles}
            interactionGraph={interactionGraphRef.current}
            isPlaybackMode={isPlaybackMode}
            playbackSnapshot={playbackSnapshot}
          />
        </div>
      </SidebarInset>
      <WorldControls
        onAsk={handleAsk}
        characters={characterData}
        onClearTrapCircles={clearAllTrapCircles}
        trapCircleCount={trapCircles.length}
        showInteractionRadius={showInteractionRadius}
        onToggleInteractionRadius={() => setShowInteractionRadius(!showInteractionRadius)}
        showTrapCircles={showTrapCircles}
        onToggleTrapCircles={() => setShowTrapCircles(!showTrapCircles)}
        worldMode={worldMode}
        onSetWorldMode={setWorldMode}
        modeConfig={modeConfig}
        pitchStage={pitchStage}
        onAdvancePitchStage={advancePitchStage}
        onBack={onBack}
        scriptPlan={scriptPlan}
        displayedChunks={displayedChunks}
        isLoadingScript={isLoadingScript}
        gravityEnabled={gravityEnabled}
        onToggleGravity={() => setGravityEnabled(!gravityEnabled)}
        isPlaybackMode={isPlaybackMode}
        playbackIndex={playbackIndex}
        snapshotCount={historyRef.current.getSnapshotCount()}
        onTogglePlayback={() => {
          if (isPlaybackMode) {
            // Switching to live mode
            setIsPlaybackMode(false);
            setPlaybackSnapshot(null);
          } else {
            // Switching to playback mode - start at latest snapshot
            const count = historyRef.current.getSnapshotCount();
            if (count > 0) {
              setIsPlaybackMode(true);
              setPlaybackIndex(count - 1);
              setPlaybackSnapshot(historyRef.current.getSnapshotAtIndex(count - 1));
            }
          }
        }}
        onSetPlaybackIndex={(index) => {
          setPlaybackIndex(index);
          setPlaybackSnapshot(historyRef.current.getSnapshotAtIndex(index));
        }}
      />
    </SidebarProvider>
  );
}
