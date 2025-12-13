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
import { getRandomPosition, getRandomVelocity, TrapCircle, CHARACTER_CONFIG, CharacterState } from '@/src/lib/world';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';

export function CharacterWorld() {
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

  // Game loop - update all characters and check for interactions
  useGameLoop(
    useCallback(
      (deltaTime) => {
        // Update all characters
        simulationCharacters.forEach((char) => char.update(deltaTime, simulationCharacters, trapCircles));

        // Check for potential interactions between characters
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

        // Check for characters joining existing interactions
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
      },
      [simulationCharacters, trapCircles, addTrapCircle]
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
            showInteractionRadius={showInteractionRadius}
            showTrapCircles={showTrapCircles}
          />
        </div>
      </SidebarInset>
      <WorldControls onAsk={handleAsk} characters={characterData} onClearTrapCircles={clearAllTrapCircles} trapCircleCount={trapCircles.length} showInteractionRadius={showInteractionRadius} onToggleInteractionRadius={() => setShowInteractionRadius(!showInteractionRadius)} showTrapCircles={showTrapCircles} onToggleTrapCircles={() => setShowTrapCircles(!showTrapCircles)} />
    </SidebarProvider>
  );
}
