/**
 * Hook for the main game loop using requestAnimationFrame
 */

import { useEffect, useRef } from 'react';

export type GameLoopCallback = (deltaTime: number) => void;

/**
 * Hook that runs a callback on every animation frame
 * @param callback Function to call on each frame (receives deltaTime in seconds)
 * @param isActive Whether the loop should be running
 */
export function useGameLoop(callback: GameLoopCallback, isActive: boolean = true) {
  const requestRef = useRef<number | undefined>(undefined);
  const previousTimeRef = useRef<number | undefined>(undefined);
  const callbackRef = useRef(callback);

  // Update callback ref when it changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!isActive) return;

    const animate = (time: number) => {
      if (previousTimeRef.current !== undefined) {
        const deltaTime = (time - previousTimeRef.current) / 1000; // Convert to seconds
        callbackRef.current(deltaTime);
      }
      previousTimeRef.current = time;
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isActive]);
}
