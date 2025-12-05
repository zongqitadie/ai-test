export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  points: Point[];
  color: string;
  size: number;
  type: 'pen' | 'eraser';
}

export interface DrawingSettings {
  color: string;
  size: number;
  tool: 'pen' | 'eraser';
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export enum HandGesture {
  UNKNOWN = 'UNKNOWN',
  OPEN_PALM = 'OPEN_PALM', // Menu
  PINCH = 'PINCH',         // Draw
  V_SIGN = 'V_SIGN',       // Clear/Dissolve
  CLOSED_FIST = 'CLOSED_FIST',
  TWO_FINGER_POINT = 'TWO_FINGER_POINT',
}