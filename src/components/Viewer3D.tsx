import React, { useEffect, useRef, useState } from 'react';
import {
  RotateCcw,
  Play,
  Pause,
  Maximize2,
  Minimize2,
  Camera,
  Layers,
  Box,
  Compass,
  Hand,
  Lock,
} from 'lucide-react';
import { MeshBody } from '../converter/types';

interface Props {
  bodies: MeshBody[];
  floor: number;
  dims: [number, number, number];
  fileName?: string;
  onDropFile?: (file: File) => void;
  onPickFile?: () => void;
}

type RenderMode = 'solid' | 'wireframe' | 'points';

export const Viewer3D: React.FC<Props> = ({
  bodies,
  floor,
  dims,
  fileName,
  onDropFile,
  onPickFile,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [autoRotate, setAutoRotate] = useState(true);
  const [renderMode, setRenderMode] = useState<RenderMode>('solid');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [touchInteractive, setTouchInteractive] = useState(true);

  // Camera angles & zoom
  const stateRef = useRef({
    yaw: 0.785, // ~45 deg
    pitch: 0.523, // ~30 deg
    zoom: 1.0,
    panX: 0,
    panY: 0,
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    dragMode: 'orbit' as 'orbit' | 'pan',
    lastTime: performance.now(),
    // Touch tracking for pinch-to-zoom
    activePointers: new Map<number, { x: number; y: number }>(),
    initialPinchDistance: 0,
    initialZoom: 1.0,
  });

  const hasModel = bodies.length > 0;

  // Calculate centered normalized meshes
  const normalizedMeshesRef = useRef<
    {
      name: string;
      verts: Float32Array;
      idx: Uint32Array;
      color: string;
    }[]
  >([]);

  useEffect(() => {
    if (!bodies.length) {
      normalizedMeshesRef.current = [];
      return;
    }

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (const b of bodies) {
      for (let i = 0; i < b.pos.length; i += 3) {
        const x = b.pos[i];
        const y = b.pos[i + 1];
        const z = b.pos[i + 2];
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (z < minZ) minZ = z;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        if (z > maxZ) maxZ = z;
      }
    }

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;
    const maxDim = Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 1;
    const scaleFactor = 2.0 / maxDim;

    const palette = ['#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#f472b6', '#a78bfa'];

    normalizedMeshesRef.current = bodies.map((b, bIdx) => {
      const numVerts = b.pos.length / 3;
      const normVerts = new Float32Array(b.pos.length);
      for (let i = 0; i < numVerts; i++) {
        normVerts[i * 3] = (b.pos[i * 3] - cx) * scaleFactor;
        normVerts[i * 3 + 1] = (b.pos[i * 3 + 1] - cy) * scaleFactor;
        normVerts[i * 3 + 2] = (b.pos[i * 3 + 2] - cz) * scaleFactor;
      }

      return {
        name: b.name,
        verts: normVerts,
        idx: b.idx,
        color: palette[bIdx % palette.length],
      };
    });

    stateRef.current.zoom = 1.0;
    stateRef.current.panX = 0;
    stateRef.current.panY = 0;
  }, [bodies]);

  // Main rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = (time: number) => {
      const dt = Math.min(0.05, (time - stateRef.current.lastTime) / 1000);
      stateRef.current.lastTime = time;

      if (autoRotate && !stateRef.current.isDragging && hasModel) {
        stateRef.current.yaw += dt * 0.4;
      }

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#090d16');
      bgGrad.addColorStop(1, '#05070c');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Camera transforms
      const baseScale = Math.min(width, height) * 0.38 * stateRef.current.zoom;
      const yaw = stateRef.current.yaw;
      const pitch = stateRef.current.pitch;
      const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
      const cosP = Math.cos(pitch), sinP = Math.sin(pitch);
      const centerX = width / 2 + stateRef.current.panX;
      const centerY = height / 2 + stateRef.current.panY + baseScale * 0.12;

      // Project 3D point to 2D
      const project = (x: number, y: number, z: number): [number, number, number] => {
        const rx = x * cosY - y * sinY;
        const ry = x * sinY + y * cosY;
        const rz = z * cosP + ry * sinP;
        const depth = ry * cosP - z * sinP;

        const screenX = centerX + rx * baseScale;
        const screenY = centerY - rz * baseScale;
        return [screenX, screenY, depth];
      };

      // 1. Draw floor grid
      const floorZ = -1.0;
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const gridExtent = 1.6;
      const gridSteps = 10;
      for (let i = -gridSteps; i <= gridSteps; i++) {
        const coord = (i / gridSteps) * gridExtent;
        const a1 = project(coord, -gridExtent, floorZ);
        const a2 = project(coord, gridExtent, floorZ);
        ctx.moveTo(a1[0], a1[1]);
        ctx.lineTo(a2[0], a2[1]);

        const b1 = project(-gridExtent, coord, floorZ);
        const b2 = project(gridExtent, coord, floorZ);
        ctx.moveTo(b1[0], b1[1]);
        ctx.lineTo(b2[0], b2[1]);
      }
      ctx.stroke();

      const lightDir = [0.577, 0.577, 0.577];

      // 2. Render Meshes
      if (hasModel && normalizedMeshesRef.current.length > 0) {
        for (const m of normalizedMeshesRef.current) {
          const numTris = m.idx.length / 3;

          if (renderMode === 'points') {
            ctx.fillStyle = m.color;
            const step = Math.max(1, Math.floor(m.verts.length / (3 * 2500)));
            for (let i = 0; i < m.verts.length; i += 3 * step) {
              const p = project(m.verts[i], m.verts[i + 1], m.verts[i + 2]);
              ctx.fillRect(p[0] - 1, p[1] - 1, 2.2, 2.2);
            }
          } else if (renderMode === 'wireframe') {
            ctx.strokeStyle = m.color;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            const maxWireTris = Math.min(numTris, 5000);
            const step = Math.max(1, Math.floor(numTris / maxWireTris));

            for (let t = 0; t < numTris; t += step) {
              const i0 = m.idx[t * 3];
              const i1 = m.idx[t * 3 + 1];
              const i2 = m.idx[t * 3 + 2];

              const p0 = project(m.verts[i0 * 3], m.verts[i0 * 3 + 1], m.verts[i0 * 3 + 2]);
              const p1 = project(m.verts[i1 * 3], m.verts[i1 * 3 + 1], m.verts[i1 * 3 + 2]);
              const p2 = project(m.verts[i2 * 3], m.verts[i2 * 3 + 1], m.verts[i2 * 3 + 2]);

              ctx.moveTo(p0[0], p0[1]);
              ctx.lineTo(p1[0], p1[1]);
              ctx.lineTo(p2[0], p2[1]);
              ctx.closePath();
            }
            ctx.stroke();
          } else {
            interface ProjectedTriangle {
              p0: [number, number, number];
              p1: [number, number, number];
              p2: [number, number, number];
              normal: [number, number, number];
              avgDepth: number;
              intensity: number;
            }

            const visibleTriangles: ProjectedTriangle[] = [];
            const budgetTris = 3000;
            const step = Math.max(1, Math.floor(numTris / budgetTris));

            for (let t = 0; t < numTris; t += step) {
              const i0 = m.idx[t * 3];
              const i1 = m.idx[t * 3 + 1];
              const i2 = m.idx[t * 3 + 2];

              const v0: [number, number, number] = [
                m.verts[i0 * 3],
                m.verts[i0 * 3 + 1],
                m.verts[i0 * 3 + 2],
              ];
              const v1: [number, number, number] = [
                m.verts[i1 * 3],
                m.verts[i1 * 3 + 1],
                m.verts[i1 * 3 + 2],
              ];
              const v2: [number, number, number] = [
                m.verts[i2 * 3],
                m.verts[i2 * 3 + 1],
                m.verts[i2 * 3 + 2],
              ];

              const u = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
              const v = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]];
              const nx = u[1] * v[2] - u[2] * v[1];
              const ny = u[2] * v[0] - u[0] * v[2];
              const nz = u[0] * v[1] - u[1] * v[0];
              const nLen = Math.hypot(nx, ny, nz) || 1;
              const norm: [number, number, number] = [nx / nLen, ny / nLen, nz / nLen];

              const dot = norm[0] * lightDir[0] + norm[1] * lightDir[1] + norm[2] * lightDir[2];
              const intensity = Math.max(0.2, 0.45 + 0.55 * dot);

              const p0 = project(v0[0], v0[1], v0[2]);
              const p1 = project(v1[0], v1[1], v1[2]);
              const p2 = project(v2[0], v2[1], v2[2]);
              const avgDepth = (p0[2] + p1[2] + p2[2]) / 3;

              visibleTriangles.push({
                p0,
                p1,
                p2,
                normal: norm,
                avgDepth,
                intensity,
              });
            }

            visibleTriangles.sort((a, b) => b.avgDepth - a.avgDepth);

            for (let i = 0; i < visibleTriangles.length; i++) {
              const tri = visibleTriangles[i];
              const lum = Math.floor(tri.intensity * 100);

              ctx.fillStyle = `hsl(205 60% ${Math.min(80, Math.max(20, lum))}%)`;
              ctx.strokeStyle = `hsl(205 75% ${Math.min(95, Math.max(35, lum + 15))}%)`;
              ctx.lineWidth = 0.6;

              ctx.beginPath();
              ctx.moveTo(tri.p0[0], tri.p0[1]);
              ctx.lineTo(tri.p1[0], tri.p1[1]);
              ctx.lineTo(tri.p2[0], tri.p2[1]);
              ctx.closePath();
              ctx.fill();
              ctx.stroke();
            }
          }
        }
      }

      // 3. Draw 3D Orientation Gizmo (bottom-left)
      const gizmoX = 36;
      const gizmoY = height - 36;
      const gizmoLen = 20;

      const gProject = (gx: number, gy: number, gz: number) => {
        const rx = gx * cosY - gy * sinY;
        const ry = gx * sinY + gy * cosY;
        const rz = gz * cosP + ry * sinP;
        return [gizmoX + rx * gizmoLen, gizmoY - rz * gizmoLen];
      };

      const axes: { name: string; end: [number, number, number]; color: string }[] = [
        { name: 'X', end: [1, 0, 0], color: '#ef4444' },
        { name: 'Y', end: [0, 1, 0], color: '#10b981' },
        { name: 'Z', end: [0, 0, 1], color: '#3b82f6' },
      ];

      for (const a of axes) {
        const pt = gProject(...a.end);
        ctx.strokeStyle = a.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(gizmoX, gizmoY);
        ctx.lineTo(pt[0], pt[1]);
        ctx.stroke();

        ctx.fillStyle = a.color;
        ctx.font = '9px monospace';
        ctx.fillText(a.name, pt[0] + 2, pt[1] + 2);
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [hasModel, autoRotate, renderMode]);

  // Pointer event handlers with multi-touch pinch zoom support
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!touchInteractive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    stateRef.current.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (stateRef.current.activePointers.size === 1) {
      const isPan = e.button === 1 || e.shiftKey;
      stateRef.current.isDragging = true;
      stateRef.current.dragMode = isPan ? 'pan' : 'orbit';
      stateRef.current.dragStart = { x: e.clientX, y: e.clientY };
    } else if (stateRef.current.activePointers.size === 2) {
      // Start 2-finger pinch
      const pts = Array.from(stateRef.current.activePointers.values());
      stateRef.current.initialPinchDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      stateRef.current.initialZoom = stateRef.current.zoom;
      stateRef.current.isDragging = false;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!touchInteractive) return;
    if (!stateRef.current.activePointers.has(e.pointerId)) return;
    stateRef.current.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (stateRef.current.activePointers.size === 2) {
      // Handle pinch-to-zoom on mobile touch screens
      const pts = Array.from(stateRef.current.activePointers.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (stateRef.current.initialPinchDistance > 10) {
        const factor = dist / stateRef.current.initialPinchDistance;
        stateRef.current.zoom = Math.max(0.3, Math.min(3.5, stateRef.current.initialZoom * factor));
      }
      return;
    }

    if (!stateRef.current.isDragging) return;
    const dx = e.clientX - stateRef.current.dragStart.x;
    const dy = e.clientY - stateRef.current.dragStart.y;
    stateRef.current.dragStart = { x: e.clientX, y: e.clientY };

    if (stateRef.current.dragMode === 'pan') {
      stateRef.current.panX += dx;
      stateRef.current.panY += dy;
    } else {
      stateRef.current.yaw += dx * 0.008;
      stateRef.current.pitch = Math.max(-1.4, Math.min(1.4, stateRef.current.pitch + dy * 0.008));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        // ignore if not captured
      }
    }
    stateRef.current.activePointers.delete(e.pointerId);
    if (stateRef.current.activePointers.size === 0) {
      stateRef.current.isDragging = false;
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    stateRef.current.zoom = Math.max(0.3, Math.min(3.5, stateRef.current.zoom * factor));
  };

  const resetCamera = () => {
    stateRef.current.yaw = 0.785;
    stateRef.current.pitch = 0.523;
    stateRef.current.zoom = 1.0;
    stateRef.current.panX = 0;
    stateRef.current.panY = 0;
  };

  const setViewPreset = (view: 'iso' | 'top' | 'front' | 'side') => {
    if (view === 'iso') {
      stateRef.current.yaw = 0.785;
      stateRef.current.pitch = 0.523;
    } else if (view === 'top') {
      stateRef.current.yaw = 0;
      stateRef.current.pitch = 1.57;
    } else if (view === 'front') {
      stateRef.current.yaw = 0;
      stateRef.current.pitch = 0;
    } else if (view === 'side') {
      stateRef.current.yaw = 1.57;
      stateRef.current.pitch = 0;
    }
  };

  const handleSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${fileName ? fileName.replace(/\.[^/.]+$/, '') : 'modelo3d'}_preview.png`;
    a.click();
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-xl transition-all ${
        isFullscreen
          ? 'fixed inset-0 z-50 rounded-none h-screen w-screen'
          : 'h-[270px] sm:h-[350px] md:h-[400px] lg:h-[440px] w-full'
      } ${isDragOver ? 'ring-2 ring-cyan-400 border-cyan-400' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0] && onDropFile) {
          onDropFile(e.dataTransfer.files[0]);
        }
      }}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        className={`absolute inset-0 h-full w-full select-none ${
          touchInteractive ? 'cursor-grab active:cursor-grabbing touch-none' : 'pointer-events-none'
        }`}
      />

      {/* Empty State Overlay */}
      {!hasModel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center pointer-events-none">
          <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-3 shadow-lg shadow-cyan-500/5">
            <Box className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>
          <h3 className="text-sm sm:text-base font-semibold text-slate-100 mb-1">
            Solte um arquivo 3D aqui
          </h3>
          <p className="text-[11px] sm:text-xs text-slate-400 max-w-xs mb-4">
            Formatos suportados: <span className="text-cyan-300 font-mono">.WAD</span>,{' '}
            <span className="text-cyan-300 font-mono">.OBJ</span>,{' '}
            <span className="text-cyan-300 font-mono">.STL</span>,{' '}
            <span className="text-cyan-300 font-mono">.PLY</span> e{' '}
            <span className="text-cyan-300 font-mono">.OFF</span>
          </p>
          {onPickFile && (
            <button
              onClick={onPickFile}
              className="pointer-events-auto inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-500 active:scale-95 transition-all cursor-pointer min-h-[44px]"
            >
              Escolher Arquivo
            </button>
          )}
        </div>
      )}

      {/* Responsive Viewport Controls Header */}
      {hasModel && (
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1.5 pointer-events-none z-10">
          {/* Camera Angles: Text buttons on Desktop, compact selector on mobile */}
          <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-slate-700/60 bg-slate-900/85 p-1 backdrop-blur-md shadow-lg">
            <button
              onClick={() => setViewPreset('iso')}
              className="rounded-lg px-2 py-1 text-[10px] sm:text-[11px] font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition cursor-pointer min-h-[28px]"
            >
              ISO
            </button>
            <button
              onClick={() => setViewPreset('top')}
              className="rounded-lg px-2 py-1 text-[10px] sm:text-[11px] font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition cursor-pointer min-h-[28px]"
            >
              Topo
            </button>
            <button
              onClick={() => setViewPreset('front')}
              className="rounded-lg px-2 py-1 text-[10px] sm:text-[11px] font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition cursor-pointer min-h-[28px]"
            >
              Frente
            </button>
            <button
              onClick={() => setViewPreset('side')}
              className="hidden sm:inline-block rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition cursor-pointer min-h-[28px]"
            >
              Lado
            </button>
          </div>

          {/* Action icon buttons */}
          <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-slate-700/60 bg-slate-900/85 p-1 backdrop-blur-md shadow-lg">
            <button
              onClick={() => setAutoRotate(!autoRotate)}
              className={`rounded-lg p-1.5 transition cursor-pointer min-h-[28px] min-w-[28px] flex items-center justify-center ${
                autoRotate ? 'text-cyan-400 bg-cyan-950/70' : 'text-slate-400 hover:text-slate-200'
              }`}
              title={autoRotate ? 'Pausar rotação contínua' : 'Ativar rotação contínua'}
            >
              {autoRotate ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </button>

            <button
              onClick={() =>
                setRenderMode(
                  renderMode === 'solid' ? 'wireframe' : renderMode === 'wireframe' ? 'points' : 'solid'
                )
              }
              className="rounded-lg p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer min-h-[28px] min-w-[28px] flex items-center justify-center"
              title={`Modo: ${
                renderMode === 'solid' ? 'Sólido' : renderMode === 'wireframe' ? 'Wireframe' : 'Pontos'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
            </button>

            <button
              onClick={resetCamera}
              className="rounded-lg p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer min-h-[28px] min-w-[28px] flex items-center justify-center"
              title="Redefinir visualização"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>

            <button
              onClick={handleSnapshot}
              className="hidden sm:flex rounded-lg p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer min-h-[28px] min-w-[28px] items-center justify-center"
              title="Capturar foto PNG do modelo"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>

            <button
              onClick={toggleFullscreen}
              className="rounded-lg p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer min-h-[28px] min-w-[28px] flex items-center justify-center"
              title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            >
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      )}

      {/* Floating Instructions / Touch Mode Indicator */}
      {hasModel && (
        <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 pointer-events-none text-[10px] sm:text-[11px] text-slate-400 bg-slate-900/80 px-2.5 py-1 rounded-lg backdrop-blur-sm border border-slate-800/80">
          <Compass className="h-3 w-3 text-cyan-400 shrink-0" />
          <span className="hidden sm:inline">Arraste para girar • 2 dedos para zoom</span>
          <span className="sm:hidden">Girar / Zoom</span>
        </div>
      )}
    </div>
  );
};
