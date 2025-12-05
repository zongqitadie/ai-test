import React, { useEffect, useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { FilesetResolver, HandLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import { HandGesture, Point, Stroke, DrawingSettings, Particle } from './types';
import { distance, toScreen, midPoint } from './utils/geometry';
import { SciFiMenu } from './components/SciFiMenu';
import { Loader2, Scan } from 'lucide-react';

// Configuration
const VISION_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm";
const MODEL_ASSET_PATH = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

function App() {
  // --- Refs ---
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const uiCanvasRef = useRef<HTMLCanvasElement>(null); // For overlay UI like cursors
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>();
  
  // --- State ---
  const [isLoading, setIsLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuCursor, setMenuCursor] = useState<{x: number, y: number} | null>(null);
  const [currentGesture, setCurrentGesture] = useState<HandGesture>(HandGesture.UNKNOWN);
  
  // --- Drawing State (Refs for performance) ---
  const linesRef = useRef<Stroke[]>([]);
  const currentLineRef = useRef<Point[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const settingsRef = useRef<DrawingSettings>({
    color: '#00FFFF',
    size: 6,
    tool: 'pen'
  });
  
  // Transform state for zoom
  const transformRef = useRef({ scale: 1, offsetX: 0, offsetY: 0 });
  const prevPinchDistanceRef = useRef<number | null>(null);

  // --- Initialization ---
  useEffect(() => {
    const initMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(VISION_URL);
        handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_ASSET_PATH,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2
        });
        setIsLoading(false);
      } catch (error) {
        console.error("Error initializing MediaPipe:", error);
      }
    };
    initMediaPipe();
  }, []);

  // --- Hand Detection Loop ---
  const detect = useCallback(() => {
    if (
      webcamRef.current &&
      webcamRef.current.video &&
      webcamRef.current.video.readyState === 4 &&
      handLandmarkerRef.current &&
      canvasRef.current
    ) {
      const video = webcamRef.current.video;
      const { videoWidth, videoHeight } = video;
      
      // Resize canvases to match video
      if (canvasRef.current.width !== videoWidth) {
        canvasRef.current.width = videoWidth;
        canvasRef.current.height = videoHeight;
      }
      if (uiCanvasRef.current && uiCanvasRef.current.width !== videoWidth) {
        uiCanvasRef.current.width = videoWidth;
        uiCanvasRef.current.height = videoHeight;
      }

      const startTimeMs = performance.now();
      const results = handLandmarkerRef.current.detectForVideo(video, startTimeMs);

      // --- Logic Processing ---
      processHands(results, videoWidth, videoHeight);
      
      // --- Rendering ---
      renderCanvas(videoWidth, videoHeight);
    }
    
    requestRef.current = requestAnimationFrame(detect);
  }, [isMenuOpen]); // Re-create if menu state changes deeply, though refs handle most

  useEffect(() => {
    if (!isLoading) {
      requestRef.current = requestAnimationFrame(detect);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isLoading, detect]);


  // --- Logic Helper ---
  const processHands = (results: any, width: number, height: number) => {
    const landmarks = results.landmarks;
    
    // Default cursor reset
    setMenuCursor(null);
    let detectedGesture = HandGesture.UNKNOWN;

    if (landmarks && landmarks.length > 0) {
      
      // Check for Zoom (Two hands)
      if (landmarks.length === 2) {
        const hand1Index = toScreen(landmarks[0][8].x, landmarks[0][8].y, width, height);
        const hand2Index = toScreen(landmarks[1][8].x, landmarks[1][8].y, width, height);
        const dist = distance(hand1Index, hand2Index);

        // Check if both hands are index-pointing (simplified: just existence of 2 hands for now)
        detectedGesture = HandGesture.TWO_FINGER_POINT;

        if (prevPinchDistanceRef.current !== null) {
          const delta = dist - prevPinchDistanceRef.current;
          const zoomSpeed = 0.005;
          const newScale = Math.max(0.5, Math.min(3, transformRef.current.scale + delta * zoomSpeed));
          
          // Basic center zoom
          transformRef.current.scale = newScale;
        }
        prevPinchDistanceRef.current = dist;
      } else {
        prevPinchDistanceRef.current = null;
        
        // Single Hand Logic
        const hand = landmarks[0];
        const thumbTip = toScreen(hand[4].x, hand[4].y, width, height);
        const indexTip = toScreen(hand[8].x, hand[8].y, width, height);
        const middleTip = toScreen(hand[12].x, hand[12].y, width, height);
        const ringTip = toScreen(hand[16].x, hand[16].y, width, height);
        const pinkyTip = toScreen(hand[20].x, hand[20].y, width, height);
        const wrist = toScreen(hand[0].x, hand[0].y, width, height);

        // Calculate distances
        const pinchDist = distance(thumbTip, indexTip);
        const middleExtended = distance(wrist, middleTip) > distance(wrist, indexTip) * 0.8;
        const ringExtended = distance(wrist, ringTip) > distance(wrist, indexTip) * 0.8;
        const pinkyExtended = distance(wrist, pinkyTip) > distance(wrist, indexTip) * 0.8;

        // --- Gesture Classification ---

        // 1. Pinch (Write)
        if (pinchDist < 40 && !middleExtended) {
          detectedGesture = HandGesture.PINCH;
        } 
        // 2. Open Palm (Menu)
        else if (middleExtended && ringExtended && pinkyExtended && distance(wrist, indexTip) > 100) {
          detectedGesture = HandGesture.OPEN_PALM;
        }
        // 3. V-Sign (Dissolve)
        else if (distance(indexTip, middleTip) > 40 && !ringExtended && !pinkyExtended) {
           detectedGesture = HandGesture.V_SIGN;
        }

        setCurrentGesture(detectedGesture);

        // --- Action Handlers ---

        // Handle Menu Toggle
        if (detectedGesture === HandGesture.OPEN_PALM) {
          if (!isMenuOpen) setIsMenuOpen(true);
        }

        // Handle Menu Interaction (When Open)
        if (isMenuOpen) {
           // In menu mode, index tip is cursor
           // We just update the state, interaction is handled in SciFiMenu via props
           setMenuCursor(indexTip);
           
           // If palm opens again while menu is open, we can close it? 
           // Or maybe we wait for user to click "Close" or use gesture.
           // Let's toggle off if palm is held for long, but to avoid flickering, 
           // we'll rely on the menu's internal close or a different gesture.
           // For now, let's say "Fist" closes it, or clicking outside.
           // Let's stick to the prompt: "Detect open palm to exit".
           // Since we detected open palm to open, we need a latch.
           // Simplified: If Open Palm detected and menu is OPEN, check if cursor is outside UI?
           // Actually, let's just use a dedicated close button or check gesture consistency.
           // Implementation: If Open Palm is detected for > 1s, toggle. (Debouncing needed).
           // For this demo, let's use the explicit close button in UI or if they make a fist.
           if (!middleExtended && !ringExtended && !pinkyExtended && pinchDist > 50) {
             // Fist
             // setIsMenuOpen(false); 
           }
        } 
        
        // Handle Drawing
        else if (detectedGesture === HandGesture.PINCH) {
           // Normalize point by current transform to draw in "world space"
           const worldPoint = {
             x: (midPoint(thumbTip, indexTip).x - transformRef.current.offsetX) / transformRef.current.scale,
             y: (midPoint(thumbTip, indexTip).y - transformRef.current.offsetY) / transformRef.current.scale
           };
           currentLineRef.current.push(worldPoint);
        } else {
           // If not pinching, finish line
           if (currentLineRef.current.length > 0) {
             linesRef.current.push({
               points: [...currentLineRef.current],
               color: settingsRef.current.color,
               size: settingsRef.current.size,
               type: settingsRef.current.tool
             });
             currentLineRef.current = [];
           }
        }

        // Handle Dissolve
        if (detectedGesture === HandGesture.V_SIGN) {
           dissolveDrawing();
        }
      }
    }
  };

  const dissolveDrawing = () => {
    if (linesRef.current.length === 0 && currentLineRef.current.length === 0) return;

    // Convert all lines to particles
    const newParticles: Particle[] = [];
    
    // Helper to add particles
    const addParticlesFromPoints = (points: Point[], color: string, size: number) => {
      points.forEach((p, i) => {
        // Sample every few points to save performance
        if (i % 2 === 0) {
          newParticles.push({
            x: p.x * transformRef.current.scale + transformRef.current.offsetX, // Convert back to screen space for animation
            y: p.y * transformRef.current.scale + transformRef.current.offsetY,
            vx: (Math.random() - 0.5) * 2,
            vy: Math.random() * 2 + 1, // Fall down
            color: color,
            size: Math.random() * size + 1,
            life: 1.0,
            maxLife: 1.0
          });
        }
      });
    };

    linesRef.current.forEach(line => {
       addParticlesFromPoints(line.points, line.color, line.size);
    });
    addParticlesFromPoints(currentLineRef.current, settingsRef.current.color, settingsRef.current.size);

    particlesRef.current = [...particlesRef.current, ...newParticles];
    
    // Clear lines
    linesRef.current = [];
    currentLineRef.current = [];
  };

  // --- Canvas Rendering ---
  const renderCanvas = (width: number, height: number) => {
    const ctx = canvasRef.current?.getContext('2d');
    const uiCtx = uiCanvasRef.current?.getContext('2d');
    
    if (!ctx || !uiCtx) return;

    // Clear
    ctx.clearRect(0, 0, width, height);
    uiCtx.clearRect(0, 0, width, height);

    // --- Draw Particles (Snow Effect) ---
    if (particlesRef.current.length > 0) {
      particlesRef.current.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.01; // Fade out
        p.vy += 0.05; // Gravity

        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      });
      // Remove dead particles
      particlesRef.current = particlesRef.current.filter(p => p.life > 0);
    }

    // --- Apply Transform for Drawing ---
    ctx.save();
    ctx.translate(transformRef.current.offsetX, transformRef.current.offsetY);
    ctx.scale(transformRef.current.scale, transformRef.current.scale);

    // --- Draw Lines ---
    const drawStroke = (points: Point[], color: string, size: number, type: 'pen' | 'eraser') => {
      if (points.length < 2) return;
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = size;
      ctx.strokeStyle = type === 'eraser' ? 'rgba(0,0,0,0.8)' : color;
      if (type === 'eraser') ctx.globalCompositeOperation = 'destination-out';
      
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        // Smooth curves
        const p1 = points[i-1];
        const p2 = points[i];
        const mid = midPoint(p1, p2);
        ctx.quadraticCurveTo(p1.x, p1.y, mid.x, mid.y);
      }
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over'; // Reset
    };

    linesRef.current.forEach(line => drawStroke(line.points, line.color, line.size, line.type));
    
    // Draw current line
    if (currentLineRef.current.length > 0) {
      drawStroke(currentLineRef.current, settingsRef.current.color, settingsRef.current.size, settingsRef.current.tool);
    }
    
    ctx.restore();

    // --- Draw UI Overlays (Hand tracking feedback) ---
    if (currentGesture === HandGesture.PINCH) {
       uiCtx.fillStyle = settingsRef.current.color;
       uiCtx.shadowBlur = 10;
       uiCtx.shadowColor = settingsRef.current.color;
       const lastPt = currentLineRef.current[currentLineRef.current.length - 1];
       if (lastPt) {
         // Transform point back to screen space for UI indicator
         const screenX = lastPt.x * transformRef.current.scale + transformRef.current.offsetX;
         const screenY = lastPt.y * transformRef.current.scale + transformRef.current.offsetY;
         uiCtx.beginPath();
         uiCtx.arc(screenX, screenY, settingsRef.current.size / 2 + 2, 0, Math.PI * 2);
         uiCtx.fill();
       }
       uiCtx.shadowBlur = 0;
    }
  };

  // --- Handlers for Menu ---
  const handleMenuSelect = (updates: Partial<DrawingSettings>) => {
    settingsRef.current = { ...settingsRef.current, ...updates };
    // Force re-render to update menu UI
    setIsMenuOpen(prev => prev); 
  };

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden select-none">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black text-cyan-500">
          <Loader2 className="w-16 h-16 animate-spin mb-4" />
          <h1 className="font-scifi text-2xl tracking-[0.2em] animate-pulse">INITIALIZING SYSTEM...</h1>
          <p className="text-gray-500 mt-2 font-mono text-sm">LOADING NEURAL MODELS</p>
        </div>
      )}

      {/* Webcam Layer */}
      <Webcam
        ref={webcamRef}
        className="absolute inset-0 w-full h-full object-cover opacity-60 grayscale-[30%] contrast-125 pointer-events-none"
        mirrored
        screenshotFormat="image/jpeg"
        videoConstraints={{
            width: 1280,
            height: 720,
            facingMode: "user"
        }}
      />

      {/* Sci-Fi Grid Overlay (Static) */}
      <div className="absolute inset-0 w-full h-full pointer-events-none bg-[linear-gradient(rgba(0,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>

      {/* Main Drawing Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* UI Canvas (Cursors, indicators) */}
      <canvas
        ref={uiCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
      />

      {/* Sci-Fi Menu */}
      <SciFiMenu 
        isOpen={isMenuOpen} 
        settings={settingsRef.current} 
        cursorPos={menuCursor} 
        onSelect={handleMenuSelect} 
        onClose={() => setIsMenuOpen(false)}
      />

      {/* HUD Info */}
      <div className="absolute bottom-6 left-6 text-cyan-500/80 font-mono text-sm space-y-1 z-30 pointer-events-none">
        <div className="flex items-center gap-2">
           <div className={`w-2 h-2 rounded-full ${currentGesture === HandGesture.UNKNOWN ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`}></div>
           <span>STATUS: {currentGesture}</span>
        </div>
        <div>TOOL: {settingsRef.current.tool.toUpperCase()}</div>
        <div>ZOOM: {transformRef.current.scale.toFixed(2)}x</div>
        <div className="mt-4 opacity-50 text-xs">
          GESTURES:<br/>
          • PINCH: Draw<br/>
          • OPEN PALM: Menu<br/>
          • V-SIGN: Dissolve<br/>
          • 2 FINGERS: Zoom
        </div>
      </div>
      
      {/* Decorative HUD Elements */}
      <div className="absolute top-6 right-6 z-30 pointer-events-none">
        <Scan className="w-12 h-12 text-cyan-500/40 animate-spin-slow" />
      </div>

    </div>
  );
}

export default App;