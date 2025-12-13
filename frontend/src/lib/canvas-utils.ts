/**
 * Canvas drawing utilities for the character simulation
 */

import { SPEECH_CONFIG } from './world';

/**
 * Draw a rounded rectangle
 */
export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Draw a speech bubble with text
 */
export function drawSpeechBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  fontSize: number = 12
): void {
  const { PADDING, BORDER_RADIUS, POINTER_SIZE } = SPEECH_CONFIG;

  // Measure text
  ctx.font = `${fontSize}px Arial`;
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const textHeight = fontSize;

  // Calculate bubble dimensions
  const bubbleWidth = textWidth + PADDING * 2;
  const bubbleHeight = textHeight + PADDING * 2;

  // Position bubble above character
  const bubbleX = x - bubbleWidth / 2;
  const bubbleY = y - bubbleHeight - POINTER_SIZE - 10;

  // Draw bubble background
  ctx.fillStyle = 'white';
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 2;

  drawRoundedRect(ctx, bubbleX, bubbleY, bubbleWidth, bubbleHeight, BORDER_RADIUS);
  ctx.fill();
  ctx.stroke();

  // Draw pointer (triangle)
  ctx.beginPath();
  ctx.moveTo(x, y - 10);
  ctx.lineTo(x - POINTER_SIZE, bubbleY + bubbleHeight);
  ctx.lineTo(x + POINTER_SIZE, bubbleY + bubbleHeight);
  ctx.closePath();
  ctx.fillStyle = 'white';
  ctx.fill();
  ctx.strokeStyle = 'black';
  ctx.stroke();

  // Draw text
  ctx.fillStyle = 'black';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, bubbleY + bubbleHeight / 2);
}

/**
 * Draw a character sprite from a sprite sheet
 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  frameIndex: number,
  row: number,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  const frameW = image.width / 9; // 9 frames per row
  const frameH = image.height / 4; // 4 rows (directions)

  const sx = frameIndex * frameW;
  const sy = row * frameH;

  ctx.drawImage(
    image,
    sx, sy, frameW, frameH,
    x - width / 2, y - height / 2, width, height
  );
}

/**
 * Draw a shadow beneath a character
 */
export function drawShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y + 28, width * 0.4, width * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Draw world grid for visual reference
 */
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  worldWidth: number,
  worldHeight: number,
  gridSize: number = 100
): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;

  // Vertical lines
  for (let x = 0; x <= worldWidth; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, worldHeight);
    ctx.stroke();
  }

  // Horizontal lines
  for (let y = 0; y <= worldHeight; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(worldWidth, y);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draw world boundary
 */
export function drawWorldBoundary(
  ctx: CanvasRenderingContext2D,
  worldWidth: number,
  worldHeight: number
): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, worldWidth, worldHeight);
  ctx.restore();
}
