/**
 * Canvas component for rendering the character world
 */

'use client';

import { useRef, useEffect, forwardRef, useState } from 'react';
import type { Camera } from '@/src/hooks/useCamera';
import type { SimulationCharacter } from '@/src/lib/character';
import { WORLD_CONFIG, CHARACTER_CONFIG, ABSTRACT_LAYER_CONFIG, TrapCircle, CharacterState, ModeFeatures } from '@/src/lib/world';
import { InteractionGraph } from '@/src/lib/interactionGraph';
import { GraphSnapshot } from '@/src/lib/interactionGraphHistory';
import { drawGrid } from '@/src/lib/canvas-utils';

interface WorldCanvasProps {
  characters: SimulationCharacter[];
  camera: Camera;
  onWheel: (e: WheelEvent) => void;
  onMouseDown: (e: MouseEvent) => void;
  onMouseMove: (e: MouseEvent) => void;
  onMouseUp: () => void;
  isDragging: boolean;
  trapCircles: TrapCircle[];
  onAddTrapCircle: (circle: TrapCircle) => void;
  onRemoveTrapCircle: (id: string) => void;
  onEndInteraction: (character: SimulationCharacter) => void;
  showInteractionRadius: boolean;
  showTrapCircles: boolean;
  modeConfig: ModeFeatures;
  speechBubble?: { text: string; x: number; y: number };
  discussionBubbles?: Array<{ characterId: number; text: string }>;
  interactionGraph?: InteractionGraph;
  // Playback mode props
  isPlaybackMode?: boolean;
  playbackSnapshot?: GraphSnapshot | null;
}

export const WorldCanvas = forwardRef<HTMLCanvasElement, WorldCanvasProps>(
  function WorldCanvas(
    { characters, camera, onWheel, onMouseDown, onMouseMove, onMouseUp, isDragging, trapCircles, onAddTrapCircle, onRemoveTrapCircle, onEndInteraction, showInteractionRadius, showTrapCircles, modeConfig, speechBubble, discussionBubbles = [], interactionGraph, isPlaybackMode = false, playbackSnapshot },
    ref
  ) {
    const internalRef = useRef<HTMLCanvasElement>(null);
    const canvasRef = (ref as React.RefObject<HTMLCanvasElement>) || internalRef;

    // Track if hovering over a character's interaction radius
    const [isHoveringCharacter, setIsHoveringCharacter] = useState(false);

    // Track drawing state for trap circles (using refs to avoid stale closures)
    const isDrawingTrapCircleRef = useRef(false);
    const trapCircleStartRef = useRef<{ x: number; y: number } | null>(null);
    const currentTrapCircleRadiusRef = useRef(0);

    // Force re-render when drawing state changes (for preview)
    const [, forceRender] = useState(0);

    // Use refs to access latest values without restarting render loop
    const charactersRef = useRef(characters);
    const cameraRef = useRef(camera);
    const trapCirclesRef = useRef(trapCircles);
    const showInteractionRadiusRef = useRef(showInteractionRadius);
    const showTrapCirclesRef = useRef(showTrapCircles);
    const modeConfigRef = useRef(modeConfig);

    useEffect(() => {
      charactersRef.current = characters;
    }, [characters]);

    useEffect(() => {
      trapCirclesRef.current = trapCircles;
    }, [trapCircles]);

    useEffect(() => {
      cameraRef.current = camera;
    }, [camera]);

    useEffect(() => {
      showInteractionRadiusRef.current = showInteractionRadius;
    }, [showInteractionRadius]);

    useEffect(() => {
      showTrapCirclesRef.current = showTrapCircles;
    }, [showTrapCircles]);

    useEffect(() => {
      modeConfigRef.current = modeConfig;
    }, [modeConfig]);

    const speechBubbleRef = useRef(speechBubble);
    useEffect(() => {
      speechBubbleRef.current = speechBubble;
    }, [speechBubble]);

    const discussionBubblesRef = useRef(discussionBubbles);
    useEffect(() => {
      discussionBubblesRef.current = discussionBubbles;
    }, [discussionBubbles]);

    const interactionGraphRef = useRef(interactionGraph);
    useEffect(() => {
      interactionGraphRef.current = interactionGraph;
    }, [interactionGraph]);

    const isPlaybackModeRef = useRef(isPlaybackMode);
    useEffect(() => {
      isPlaybackModeRef.current = isPlaybackMode;
    }, [isPlaybackMode]);

    const playbackSnapshotRef = useRef(playbackSnapshot);
    useEffect(() => {
      playbackSnapshotRef.current = playbackSnapshot;
    }, [playbackSnapshot]);

    // Convert screen coordinates to world coordinates
    const screenToWorld = (screenX: number, screenY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const currentCamera = cameraRef.current;
      const rect = canvas.getBoundingClientRect();
      const canvasX = screenX - rect.left;
      const canvasY = screenY - rect.top;
      // Reverse camera transformations
      const worldX = (canvasX - canvas.width / 2) / currentCamera.zoom + currentCamera.x;
      const worldY = (canvasY - canvas.height / 2) / currentCamera.zoom + currentCamera.y;
      return { x: worldX, y: worldY };
    };

    // Check if a point is within any character's clickable radius
    const isPointInCharacterRadius = (worldX: number, worldY: number): boolean => {
      for (const character of charactersRef.current) {
        const dx = worldX - character.x;
        const dy = worldY - character.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= CHARACTER_CONFIG.CLICKABLE_RADIUS) {
          return true;
        }
      }
      return false;
    };

    // Get the character at a given world point (returns the closest one if overlapping)
    const getCharacterAtPoint = (worldX: number, worldY: number) => {
      let closestCharacter = null;
      let closestDistance = Infinity;

      for (const character of charactersRef.current) {
        const dx = worldX - character.x;
        const dy = worldY - character.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        // Check if within clickable radius and closer than previous
        if (distance <= CHARACTER_CONFIG.CLICKABLE_RADIUS && distance < closestDistance) {
          closestDistance = distance;
          closestCharacter = character;
        }
      }
      return closestCharacter;
    };

    // Handle mouse move for hover detection
    const handleMouseMoveForHover = (e: MouseEvent) => {
      const { x, y } = screenToWorld(e.clientX, e.clientY);
      setIsHoveringCharacter(isPointInCharacterRadius(x, y));
    };

    // Track mouse position for click detection (to distinguish from drag)
    const mouseDownPos = useRef<{ x: number; y: number } | null>(null);

    const handleMouseDownForClick = (e: MouseEvent) => {
      mouseDownPos.current = { x: e.clientX, y: e.clientY };
    };

    // Setup canvas event listeners
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const combinedMouseMove = (e: MouseEvent) => {
        onMouseMove(e);
        handleMouseMoveForHover(e);

        // Handle trap circle drawing preview
        if (isDrawingTrapCircleRef.current && trapCircleStartRef.current) {
          const { x, y } = screenToWorld(e.clientX, e.clientY);
          const dx = x - trapCircleStartRef.current.x;
          const dy = y - trapCircleStartRef.current.y;
          currentTrapCircleRadiusRef.current = Math.sqrt(dx * dx + dy * dy);
          forceRender((n) => n + 1); // Trigger re-render for preview
        }
      };

      const combinedMouseDown = (e: MouseEvent) => {
        // Ctrl + Left click = start drawing trap circle (only if mode allows)
        if (e.ctrlKey && e.button === 0 && modeConfigRef.current.trapCircles) {
          e.preventDefault();
          const { x, y } = screenToWorld(e.clientX, e.clientY);
          trapCircleStartRef.current = { x, y };
          isDrawingTrapCircleRef.current = true;
          currentTrapCircleRadiusRef.current = 0;
          return; // Don't propagate to other handlers
        }

        // Ctrl + Right click = delete trap circle at point
        if (e.ctrlKey && e.button === 2) {
          e.preventDefault();
          const { x, y } = screenToWorld(e.clientX, e.clientY);
          // Find circle that contains this point
          for (const circle of trapCircles) {
            const dx = x - circle.x;
            const dy = y - circle.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= circle.radius) {
              // If this is an interaction circle, end the interaction too
              if (circle.id.startsWith('interaction-')) {
                // Find characters in INTERACTING state within this circle and end their interaction
                for (const character of charactersRef.current) {
                  if (character.state === CharacterState.INTERACTING) {
                    const charDx = character.x - circle.x;
                    const charDy = character.y - circle.y;
                    const charDist = Math.sqrt(charDx * charDx + charDy * charDy);
                    if (charDist <= circle.radius) {
                      onEndInteraction(character);
                      break; // onEndInteraction ends both characters
                    }
                  }
                }
              }
              onRemoveTrapCircle(circle.id);
              return;
            }
          }
          return;
        }

        onMouseDown(e);
        handleMouseDownForClick(e);
      };

      const combinedMouseUp = (e: MouseEvent) => {
        // Finish drawing trap circle
        if (isDrawingTrapCircleRef.current && trapCircleStartRef.current && currentTrapCircleRadiusRef.current > 20) {
          const newCircle: TrapCircle = {
            id: `trap-${Date.now()}`,
            x: trapCircleStartRef.current.x,
            y: trapCircleStartRef.current.y,
            radius: currentTrapCircleRadiusRef.current,
          };
          onAddTrapCircle(newCircle);
        }
        isDrawingTrapCircleRef.current = false;
        trapCircleStartRef.current = null;
        currentTrapCircleRadiusRef.current = 0;

        // Skip character interaction if we were drawing
        if (e.ctrlKey) {
          mouseDownPos.current = null;
          onMouseUp();
          return;
        }

        // Only trigger if this was a click, not a drag
        if (mouseDownPos.current) {
          const dx = e.clientX - mouseDownPos.current.x;
          const dy = e.clientY - mouseDownPos.current.y;
          const dragDistance = Math.sqrt(dx * dx + dy * dy);

          // If dragged more than 5 pixels, it's a drag not a click
          if (dragDistance <= 5) {
            const { x, y } = screenToWorld(e.clientX, e.clientY);
            const character = getCharacterAtPoint(x, y);
            if (character) {
              if (e.shiftKey && e.button === 0) {
                // Shift + Left click - end interaction if character is interacting
                if (character.state === CharacterState.INTERACTING) {
                  onEndInteraction(character);
                }
              } else if (e.button === 0) {
                // Left click - toggle speech bubble
                character.toggleSpeechBubble();
              } else if (e.button === 2) {
                // Right click - toggle sit (only if mode allows)
                if (modeConfigRef.current.sitting) {
                  character.toggleSit();
                }
              }
            }
          }
        }
        mouseDownPos.current = null;
        onMouseUp();
      };

      // Prevent context menu on right click
      const preventContextMenu = (e: MouseEvent) => {
        e.preventDefault();
      };

      canvas.addEventListener('wheel', onWheel, { passive: false });
      canvas.addEventListener('mousedown', combinedMouseDown);
      canvas.addEventListener('mousemove', combinedMouseMove);
      canvas.addEventListener('mouseup', combinedMouseUp);
      canvas.addEventListener('mouseleave', onMouseUp);
      canvas.addEventListener('contextmenu', preventContextMenu);

      return () => {
        canvas.removeEventListener('wheel', onWheel);
        canvas.removeEventListener('mousedown', combinedMouseDown);
        canvas.removeEventListener('mousemove', combinedMouseMove);
        canvas.removeEventListener('mouseup', combinedMouseUp);
        canvas.removeEventListener('mouseleave', onMouseUp);
        canvas.removeEventListener('contextmenu', preventContextMenu);
      };
    }, [canvasRef, onWheel, onMouseDown, onMouseMove, onMouseUp]);

    // Setup canvas and resize handling
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const resizeCanvas = () => {
        const { width, height } = canvas.getBoundingClientRect();
        canvas.width = width;
        canvas.height = height;
      };

      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);

      return () => {
        window.removeEventListener('resize', resizeCanvas);
      };
    }, [canvasRef]);

    // Continuous render loop
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let animationFrameId: number;

      const render = () => {
        const currentCamera = cameraRef.current;
        const currentCharacters = charactersRef.current;

        // Clear canvas completely
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#333333';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Set image smoothing for better sprite rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Save context state
        ctx.save();

        // Apply camera transformations
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(currentCamera.zoom, currentCamera.zoom);
        ctx.translate(-currentCamera.x, -currentCamera.y);

        // Draw world background
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(0, 0, WORLD_CONFIG.WIDTH, WORLD_CONFIG.HEIGHT);

        // Draw grid
        drawGrid(ctx, WORLD_CONFIG.WIDTH, WORLD_CONFIG.HEIGHT);

        // Sort characters by Y position (painter's algorithm)
        const sortedCharacters = [...currentCharacters].sort((a, b) => a.y - b.y);

        // Check if we should render abstract layer (zoomed out below threshold)
        const isAbstractView = modeConfigRef.current.abstractLayer &&
          currentCamera.zoom < ABSTRACT_LAYER_CONFIG.ZOOM_THRESHOLD;

        if (isAbstractView && (interactionGraphRef.current || playbackSnapshotRef.current)) {
          // === ABSTRACT LAYER RENDERING ===
          const isPlayback = isPlaybackModeRef.current && playbackSnapshotRef.current;
          const snapshot = playbackSnapshotRef.current;

          // Get edges - from snapshot in playback, otherwise from live graph
          const edges = isPlayback && snapshot
            ? snapshot.edges
            : (interactionGraphRef.current?.getAllEdges() || []);

          // Get positions - from snapshot in playback, otherwise from live characters
          const positionMap = new Map<string, { x: number; y: number }>();
          if (isPlayback && snapshot) {
            snapshot.positions.forEach(p => positionMap.set(p.id, { x: p.x, y: p.y }));
          } else {
            currentCharacters.forEach(c => positionMap.set(c.id, { x: c.x, y: c.y }));
          }

          // Fixed time threshold for maximum line thickness (60 seconds)
          // Each line's weight is absolute, not relative to other conversations
          const MAX_TIME_FOR_FULL_WEIGHT = 800; // 60 seconds in ms

          // Draw connection lines first (behind dots)
          for (const edge of edges) {
            const posA = positionMap.get(edge.charA);
            const posB = positionMap.get(edge.charB);
            if (!posA || !posB) continue;

            // Absolute normalized weight - depends only on this pair's conversation time
            // Caps at 1.0 (full thickness) after 60 seconds of cumulative conversation
            const normalizedWeight = Math.min(edge.weight / MAX_TIME_FOR_FULL_WEIGHT, 1.0);

            // Calculate line width based on weight
            const lineWidth = ABSTRACT_LAYER_CONFIG.MIN_LINE_WIDTH +
              normalizedWeight * (ABSTRACT_LAYER_CONFIG.MAX_LINE_WIDTH - ABSTRACT_LAYER_CONFIG.MIN_LINE_WIDTH);

            // Calculate opacity based on weight (min 0.2, max 0.9)
            const opacity = 0.2 + normalizedWeight * 0.7;

            ctx.strokeStyle = `rgba(100, 200, 255, ${opacity})`;
            ctx.lineWidth = lineWidth;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(posA.x, posA.y);
            ctx.lineTo(posB.x, posB.y);
            ctx.stroke();
          }

          // Draw character dots
          for (const [charId, pos] of positionMap) {
            const dotRadius = ABSTRACT_LAYER_CONFIG.DOT_RADIUS;

            // Get character data for name/initials
            const character = currentCharacters.find(c => c.id === charId);

            // Check if currently conversing (only in live mode)
            const isConversing = !isPlayback && character?.state === CharacterState.CONVERSING;

            // Draw dot glow if conversing
            if (isConversing) {
              ctx.fillStyle = 'rgba(100, 200, 255, 0.3)';
              ctx.beginPath();
              ctx.arc(pos.x, pos.y, dotRadius * 2, 0, Math.PI * 2);
              ctx.fill();
            }

            // Draw main dot - amber color in playback mode
            ctx.fillStyle = isPlayback ? '#f59e0b' : (isConversing ? '#66ccff' : ABSTRACT_LAYER_CONFIG.DOT_COLOR);
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, dotRadius, 0, Math.PI * 2);
            ctx.fill();

            // Draw dot border
            ctx.strokeStyle = isPlayback ? '#d97706' : (isConversing ? '#44aadd' : ABSTRACT_LAYER_CONFIG.DOT_BORDER_COLOR);
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw initials label if enabled
            if (ABSTRACT_LAYER_CONFIG.SHOW_LABELS && character) {
              const initials = character.data.name.split(' ').map(n => n[0]).join('').slice(0, 2);
              ctx.font = 'bold 10px Inter, system-ui, sans-serif';
              ctx.fillStyle = '#ffffff';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(initials, pos.x, pos.y);
            }
          }

          // Draw PLAYBACK indicator
          if (isPlayback) {
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset to screen coordinates
            ctx.font = 'bold 14px Inter, system-ui, sans-serif';
            ctx.fillStyle = '#f59e0b';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText('⏮ PLAYBACK', 10, 10);
            ctx.restore();
          }
        } else {
          // === NORMAL DETAILED RENDERING ===
          // Draw all characters
          for (const character of sortedCharacters) {
            character.draw(ctx, showInteractionRadiusRef.current);
          }
        }

        // Draw trap circles (if toggle is on)
        if (showTrapCirclesRef.current) {
          const currentTrapCircles = trapCirclesRef.current;
          for (const circle of currentTrapCircles) {
            // Draw outer glow
            ctx.strokeStyle = 'rgba(255, 50, 50, 1)';
            ctx.lineWidth = 4;
            ctx.setLineDash([15, 8]);
            ctx.beginPath();
            ctx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw faint fill
            ctx.fillStyle = 'rgba(255, 100, 100, 0.15)';
            ctx.fill();
          }
        }

        // Draw preview circle while drawing
        if (isDrawingTrapCircleRef.current && trapCircleStartRef.current && currentTrapCircleRadiusRef.current > 0) {
          ctx.strokeStyle = 'rgba(255, 200, 100, 0.8)';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.arc(trapCircleStartRef.current.x, trapCircleStartRef.current.y, currentTrapCircleRadiusRef.current, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = 'rgba(255, 200, 100, 0.15)';
          ctx.fill();
        }

        // Draw speech bubble above presenter
        const bubble = speechBubbleRef.current;
        if (bubble) {
          const bubbleX = bubble.x;
          const bubbleY = bubble.y - 120; // Higher above character head
          const padding = 20;
          const maxWidth = 400;
          const lineHeight = 28;

          ctx.font = 'bold 20px Inter, system-ui, sans-serif';

          // Word wrap text
          const words = bubble.text.split(' ');
          const lines: string[] = [];
          let currentLine = '';

          for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth - padding * 2) {
              if (currentLine) lines.push(currentLine);
              currentLine = word;
            } else {
              currentLine = testLine;
            }
          }
          if (currentLine) lines.push(currentLine);

          const textHeight = lines.length * lineHeight;
          const textWidth = Math.min(maxWidth, Math.max(...lines.map(l => ctx.measureText(l).width))) + padding * 2;

          // Draw bubble background
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
          ctx.lineWidth = 2;

          // Rounded rectangle
          const rx = bubbleX - textWidth / 2;
          const ry = bubbleY - textHeight - padding * 2;
          const rw = textWidth;
          const rh = textHeight + padding * 2;
          const radius = 8;

          ctx.beginPath();
          ctx.moveTo(rx + radius, ry);
          ctx.lineTo(rx + rw - radius, ry);
          ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + radius);
          ctx.lineTo(rx + rw, ry + rh - radius);
          ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - radius, ry + rh);
          ctx.lineTo(rx + radius, ry + rh);
          ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - radius);
          ctx.lineTo(rx, ry + radius);
          ctx.quadraticCurveTo(rx, ry, rx + radius, ry);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Draw pointer triangle
          ctx.beginPath();
          ctx.moveTo(bubbleX - 10, ry + rh);
          ctx.lineTo(bubbleX, ry + rh + 12);
          ctx.lineTo(bubbleX + 10, ry + rh);
          ctx.closePath();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
          ctx.fill();
          ctx.stroke();

          // Draw text
          ctx.fillStyle = '#1a1a1a';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          lines.forEach((line, i) => {
            ctx.fillText(line, bubbleX, ry + padding + i * lineHeight);
          });
          ctx.textAlign = 'left';
        }

        // Draw discussion bubbles (smaller, different color)
        const currentDiscussionBubbles = discussionBubblesRef.current;
        const allCharactersForBubbles = charactersRef.current;
        for (const discBubble of currentDiscussionBubbles) {
          // Look up character position dynamically
          const character = allCharactersForBubbles.find(c => c.data.id === discBubble.characterId);
          if (!character) continue;

          const bubbleX = character.x;
          const bubbleY = character.y - 100;
          const padding = 16;
          const maxWidth = 300;
          const lineHeight = 22;

          ctx.font = '16px Inter, system-ui, sans-serif';

          // Word wrap text
          const words = discBubble.text.split(' ');
          const lines: string[] = [];
          let currentLine = '';

          for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth - padding * 2) {
              if (currentLine) lines.push(currentLine);
              currentLine = word;
            } else {
              currentLine = testLine;
            }
          }
          if (currentLine) lines.push(currentLine);

          const textHeight = lines.length * lineHeight;
          const textWidth = Math.min(maxWidth, Math.max(...lines.map(l => ctx.measureText(l).width))) + padding * 2;

          // Draw bubble background (light blue for discussion)
          ctx.fillStyle = 'rgba(220, 240, 255, 0.95)';
          ctx.strokeStyle = 'rgba(100, 150, 200, 0.6)';
          ctx.lineWidth = 2;

          const rx = bubbleX - textWidth / 2;
          const ry = bubbleY - textHeight - padding * 2;
          const rw = textWidth;
          const rh = textHeight + padding * 2;
          const radius = 8;

          ctx.beginPath();
          ctx.moveTo(rx + radius, ry);
          ctx.lineTo(rx + rw - radius, ry);
          ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + radius);
          ctx.lineTo(rx + rw, ry + rh - radius);
          ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - radius, ry + rh);
          ctx.lineTo(rx + radius, ry + rh);
          ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - radius);
          ctx.lineTo(rx, ry + radius);
          ctx.quadraticCurveTo(rx, ry, rx + radius, ry);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Draw pointer triangle
          ctx.beginPath();
          ctx.moveTo(bubbleX - 8, ry + rh);
          ctx.lineTo(bubbleX, ry + rh + 10);
          ctx.lineTo(bubbleX + 8, ry + rh);
          ctx.closePath();
          ctx.fillStyle = 'rgba(220, 240, 255, 0.95)';
          ctx.fill();
          ctx.stroke();

          // Draw text
          ctx.fillStyle = '#1a3a5a';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          lines.forEach((line, i) => {
            ctx.fillText(line, bubbleX, ry + padding + i * lineHeight);
          });
          ctx.textAlign = 'left';
        }

        // Draw conversing bubbles (small bubbles showing "talking to [name]")
        // Hide when zoomed out in abstract view
        const hideConversingBubbles = modeConfigRef.current.abstractLayer &&
          currentCamera.zoom < ABSTRACT_LAYER_CONFIG.ZOOM_THRESHOLD;

        if (!hideConversingBubbles) {
          for (const character of currentCharacters) {
            if (character.state === CharacterState.CONVERSING && character.conversingBubbleText) {
              const bubbleX = character.x;
              const bubbleY = character.y - 70;
              const padding = 8;
              const text = character.conversingBubbleText;

              ctx.font = '12px Inter, system-ui, sans-serif';
              const textWidth = ctx.measureText(text).width + padding * 2;
              const textHeight = 16 + padding * 2;

              // Draw bubble background (light purple for conversing)
              ctx.fillStyle = 'rgba(200, 180, 255, 0.9)';
              ctx.strokeStyle = 'rgba(140, 100, 200, 0.7)';
              ctx.lineWidth = 1.5;

              const rx = bubbleX - textWidth / 2;
              const ry = bubbleY - textHeight;
              const rw = textWidth;
              const rh = textHeight;
              const radius = 6;

              ctx.beginPath();
              ctx.moveTo(rx + radius, ry);
              ctx.lineTo(rx + rw - radius, ry);
              ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + radius);
              ctx.lineTo(rx + rw, ry + rh - radius);
              ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - radius, ry + rh);
              ctx.lineTo(rx + radius, ry + rh);
              ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - radius);
              ctx.lineTo(rx, ry + radius);
              ctx.quadraticCurveTo(rx, ry, rx + radius, ry);
              ctx.closePath();
              ctx.fill();
              ctx.stroke();

              // Draw pointer triangle
              ctx.beginPath();
              ctx.moveTo(bubbleX - 5, ry + rh);
              ctx.lineTo(bubbleX, ry + rh + 6);
              ctx.lineTo(bubbleX + 5, ry + rh);
              ctx.closePath();
              ctx.fillStyle = 'rgba(200, 180, 255, 0.9)';
              ctx.fill();
              ctx.stroke();

              // Draw text
              ctx.fillStyle = '#3a2a5a';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(text, bubbleX, ry + rh / 2);
              ctx.textAlign = 'left';
            }
          }
        }

        // Restore context state
        ctx.restore();

        // Continue the loop
        animationFrameId = requestAnimationFrame(render);
      };

      // Start the render loop
      animationFrameId = requestAnimationFrame(render);

      return () => {
        cancelAnimationFrame(animationFrameId);
      };
    }, [canvasRef]);

    return (
      <canvas
        ref={canvasRef}
        className={`w-full h-full ${isDragging ? 'cursor-grabbing' : isHoveringCharacter ? 'cursor-pointer' : 'cursor-grab'}`}
      />
    );
  }
);
