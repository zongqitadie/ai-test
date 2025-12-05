import { Point } from '../types';

export const distance = (p1: Point, p2: Point): number => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

export const lerp = (start: number, end: number, t: number): number => {
  return start * (1 - t) + end * t;
};

// Map normalized coordinates (0-1) to screen coordinates
// Mirror X for selfie view
export const toScreen = (x: number, y: number, width: number, height: number): Point => {
  return {
    x: (1 - x) * width,
    y: y * height
  };
};

export const midPoint = (p1: Point, p2: Point): Point => {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2
  };
};