/**
 * Canvas component for rendering the character world
 */

'use client';

import { useRef, useEffect, forwardRef, useState } from 'react';
import type { Camera } from '@/src/hooks/useCamera';
import type { SimulationCharacter } from '@/src/lib/character';
import { WORLD_CONFIG, CHARACTER_CONFIG, TrapCircle, CharacterState } from '@/src/lib/world';
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
}

export const WorldCanvas = forwardRef<HTMLCanvasElement, WorldCanvasProps>(
  function WorldCanvas(
    { characters, camera, onWheel, onMouseDown, onMouseMove, onMouseUp, isDragging, trapCircles, onAddTrapCircle, onRemoveTrapCircle, onEndInteraction, showInteractionRadius, showTrapCircles },
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
        // Ctrl + Left click = start drawing trap circle
        if (e.ctrlKey && e.button === 0) {
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
                // Right click - toggle sit
                character.toggleSit();
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

        // Draw all characters
        for (const character of sortedCharacters) {
          character.draw(ctx, showInteractionRadiusRef.current);
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
