/**
 * Hook for camera controls (zoom and pan)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { WORLD_CONFIG, CAMERA_CONFIG, clamp } from '@/src/lib/world';

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface CameraControls {
  camera: Camera;
  isDragging: boolean;
  handleWheel: (e: WheelEvent) => void;
  handleMouseDown: (e: MouseEvent) => void;
  handleMouseMove: (e: MouseEvent) => void;
  handleMouseUp: () => void;
}

/**
 * Hook to manage camera state and controls
 */
export function useCamera(canvasWidth: number, canvasHeight: number): CameraControls {
  // Calculate minimum zoom to ensure world always fills screen
  const minZoomX = canvasWidth / WORLD_CONFIG.WIDTH;
  const minZoomY = canvasHeight / WORLD_CONFIG.HEIGHT;
  const calculatedMinZoom = Math.max(minZoomX, minZoomY, CAMERA_CONFIG.MIN_ZOOM);

  const [camera, setCamera] = useState<Camera>({
    x: WORLD_CONFIG.WIDTH / 2,
    y: WORLD_CONFIG.HEIGHT / 2,
    zoom: calculatedMinZoom,
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, cameraX: 0, cameraY: 0 });
  const rafIdRef = useRef<number | null>(null);

  // Update camera zoom when canvas size changes
  useEffect(() => {
    const minZoomX = canvasWidth / WORLD_CONFIG.WIDTH;
    const minZoomY = canvasHeight / WORLD_CONFIG.HEIGHT;
    const newMinZoom = Math.max(minZoomX, minZoomY, CAMERA_CONFIG.MIN_ZOOM);

    setCamera((prev) => {
      // Only update if zoom needs to change
      if (Math.abs(prev.zoom - newMinZoom) < 0.001) return prev;

      // Inline clamping logic
      const visibleWidth = canvasWidth / newMinZoom;
      const visibleHeight = canvasHeight / newMinZoom;
      const minX = visibleWidth / 2;
      const maxX = WORLD_CONFIG.WIDTH - visibleWidth / 2;
      const minY = visibleHeight / 2;
      const maxY = WORLD_CONFIG.HEIGHT - visibleHeight / 2;

      return {
        x: clamp(prev.x, minX, maxX),
        y: clamp(prev.y, minY, maxY),
        zoom: newMinZoom,
      };
    });
  }, [canvasWidth, canvasHeight]);

  /**
   * Clamp camera position to prevent showing void
   */
  const clampCamera = useCallback(
    (x: number, y: number, zoom: number): { x: number; y: number } => {
      const visibleWidth = canvasWidth / zoom;
      const visibleHeight = canvasHeight / zoom;

      const minX = visibleWidth / 2;
      const maxX = WORLD_CONFIG.WIDTH - visibleWidth / 2;
      const minY = visibleHeight / 2;
      const maxY = WORLD_CONFIG.HEIGHT - visibleHeight / 2;

      return {
        x: clamp(x, minX, maxX),
        y: clamp(y, minY, maxY),
      };
    },
    [canvasWidth, canvasHeight]
  );

  /**
   * Handle mouse wheel for zooming
   */
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();

      setCamera((prev) => {
        const zoomFactor = 1 - e.deltaY * CAMERA_CONFIG.ZOOM_SENSITIVITY * prev.zoom;
        const newZoom = clamp(
          prev.zoom * zoomFactor,
          calculatedMinZoom,
          CAMERA_CONFIG.MAX_ZOOM
        );

        const clamped = clampCamera(prev.x, prev.y, newZoom);

        return {
          x: clamped.x,
          y: clamped.y,
          zoom: newZoom,
        };
      });
    },
    [calculatedMinZoom, clampCamera]
  );

  /**
   * Handle mouse down to start dragging
   */
  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        cameraX: camera.x,
        cameraY: camera.y,
      };
    },
    [camera.x, camera.y]
  );

  /**
   * Handle mouse move for panning
   */
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      // Cancel any pending animation frame
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }

      // Calculate delta (removed sensitivity reduction for more responsive panning)
      const dx = (dragStartRef.current.x - e.clientX) / camera.zoom;
      const dy = (dragStartRef.current.y - e.clientY) / camera.zoom;

      const newX = dragStartRef.current.cameraX + dx;
      const newY = dragStartRef.current.cameraY + dy;

      const clamped = clampCamera(newX, newY, camera.zoom);

      // Use requestAnimationFrame for smoother updates
      rafIdRef.current = requestAnimationFrame(() => {
        setCamera((prev) => ({
          ...prev,
          x: clamped.x,
          y: clamped.y,
        }));
        rafIdRef.current = null;
      });
    },
    [isDragging, camera.zoom, clampCamera]
  );

  /**
   * Handle mouse up to stop dragging
   */
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    // Cancel any pending animation frame
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  return {
    camera,
    isDragging,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
}
