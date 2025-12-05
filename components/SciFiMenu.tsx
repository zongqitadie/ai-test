import React, { useEffect, useRef } from 'react';
import { DrawingSettings } from '../types';
import { Palette, Eraser, Pen, Activity } from 'lucide-react';

interface SciFiMenuProps {
  isOpen: boolean;
  settings: DrawingSettings;
  cursorPos: { x: number, y: number } | null;
  onSelect: (updates: Partial<DrawingSettings>) => void;
  onClose: () => void;
}

const COLORS = ['#00FFFF', '#FF0055', '#39FF14', '#FFFF00', '#FFFFFF'];
const SIZES = [2, 6, 12, 24];

export const SciFiMenu: React.FC<SciFiMenuProps> = ({ isOpen, settings, cursorPos, onSelect, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoveredElementRef = useRef<string | null>(null);

  // Hit testing for cursor interaction
  useEffect(() => {
    if (!isOpen || !cursorPos || !menuRef.current) return;

    const elements = document.querySelectorAll('[data-menu-item]');
    let foundHover = false;

    elements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (
        cursorPos.x >= rect.left &&
        cursorPos.x <= rect.right &&
        cursorPos.y >= rect.top &&
        cursorPos.y <= rect.bottom
      ) {
        foundHover = true;
        const value = el.getAttribute('data-value');
        const type = el.getAttribute('data-type');
        const id = `${type}-${value}`;

        if (hoveredElementRef.current !== id) {
          // New hover start
          hoveredElementRef.current = id;
          if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
          
          // Visual feedback
          el.classList.add('ring-4', 'ring-white', 'scale-110');
          
          // Dwell click timer (1 second to select)
          hoverTimerRef.current = setTimeout(() => {
            if (type === 'color') onSelect({ color: value as string, tool: 'pen' });
            if (type === 'size') onSelect({ size: Number(value) });
            if (type === 'tool') onSelect({ tool: value as any });
            
            // Pulse animation
            el.classList.add('bg-white');
            setTimeout(() => el.classList.remove('bg-white'), 200);
            
          }, 800);
        }
      } else {
        el.classList.remove('ring-4', 'ring-white', 'scale-110');
      }
    });

    if (!foundHover) {
      hoveredElementRef.current = null;
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    }

  }, [cursorPos, isOpen, onSelect]);

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-300">
      <div ref={menuRef} className="relative bg-black/80 border-2 border-cyan-500 p-8 rounded-2xl shadow-[0_0_50px_rgba(0,255,255,0.3)] w-[600px] max-w-full">
        {/* Decorative Sci-Fi corners */}
        <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-cyan-400"></div>
        <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-cyan-400"></div>
        <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-cyan-400"></div>
        <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-cyan-400"></div>

        <h2 className="text-cyan-400 font-scifi text-2xl mb-6 text-center tracking-widest uppercase">System Interface</h2>
        
        <div className="space-y-8">
          {/* Tools */}
          <div className="flex justify-center gap-6">
            <button
              data-menu-item data-type="tool" data-value="pen"
              className={`p-4 rounded-xl border border-cyan-500/50 transition-all duration-300 ${settings.tool === 'pen' ? 'bg-cyan-500/20 shadow-[0_0_20px_rgba(0,255,255,0.4)]' : 'bg-gray-900'}`}
            >
              <Pen className="w-8 h-8 text-cyan-300" />
            </button>
            <button
              data-menu-item data-type="tool" data-value="eraser"
              className={`p-4 rounded-xl border border-cyan-500/50 transition-all duration-300 ${settings.tool === 'eraser' ? 'bg-cyan-500/20 shadow-[0_0_20px_rgba(0,255,255,0.4)]' : 'bg-gray-900'}`}
            >
              <Eraser className="w-8 h-8 text-pink-400" />
            </button>
          </div>

          {/* Sizes */}
          <div className="space-y-2">
             <div className="text-cyan-600 font-scifi text-xs uppercase tracking-widest text-center">Beam Width</div>
             <div className="flex justify-center gap-6 items-center h-16">
              {SIZES.map(size => (
                <div
                  key={size}
                  data-menu-item data-type="size" data-value={size}
                  className={`rounded-full bg-gray-700 transition-all duration-300 ${settings.size === size ? 'ring-2 ring-cyan-400 shadow-[0_0_15px_rgba(0,255,255,0.5)]' : ''}`}
                  style={{ width: size * 2 + 10, height: size * 2 + 10 }}
                />
              ))}
             </div>
          </div>

          {/* Colors */}
          <div className="space-y-2">
            <div className="text-cyan-600 font-scifi text-xs uppercase tracking-widest text-center">Energy Frequency</div>
            <div className="flex justify-center gap-4">
              {COLORS.map(color => (
                <div
                  key={color}
                  data-menu-item data-type="color" data-value={color}
                  className={`w-12 h-12 rounded-full border-2 transition-all duration-300 ${settings.color === color && settings.tool === 'pen' ? 'border-white scale-110 shadow-[0_0_20px_currentColor]' : 'border-transparent'}`}
                  style={{ backgroundColor: color, color: color }}
                />
              ))}
            </div>
          </div>

          <div className="text-center pt-4">
             <p className="text-cyan-800 text-sm font-mono">HOVER TO SELECT • OPEN PALM TO CLOSE</p>
          </div>
        </div>

        {/* Cursor Indicator for Menu */}
        {cursorPos && (
          <div 
            className="fixed w-6 h-6 border-2 border-white rounded-full pointer-events-none z-50 transform -translate-x-1/2 -translate-y-1/2 mix-blend-difference shadow-[0_0_10px_white]"
            style={{ left: cursorPos.x, top: cursorPos.y }}
          >
             <div className="absolute inset-0 bg-white/30 rounded-full animate-ping"></div>
          </div>
        )}
      </div>
    </div>
  );
};