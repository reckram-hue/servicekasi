'use client';

import { useEffect, useRef, useState } from 'react';

const INK = '#0f172a'; // slate-900 — dark ink on the white pad, so it reads correctly if printed later

/**
 * Canvas signature pad. Renders two plain <input>s (signedByName,
 * signatureDataUrl) inside whatever <form> it's placed in, so it works with
 * a normal server action without needing its own submit handler. Leaving it
 * blank is fine — the signature is optional.
 */
export function SignaturePad() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataInputRef = useRef<HTMLInputElement>(null);
  const drawingRef = useRef(false);
  const hasDrawnRef = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    paintBackground(ctx, rect.width, rect.height);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  function paintBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    e.preventDefault();
    drawingRef.current = true;
    const { x, y } = point(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    e.preventDefault();
    const { x, y } = point(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    hasDrawnRef.current = true;
    setHasDrawn(true);
  }

  function stop() {
    drawingRef.current = false;
    if (dataInputRef.current) {
      dataInputRef.current.value = hasDrawnRef.current && canvasRef.current ? canvasRef.current.toDataURL('image/png') : '';
    }
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    paintBackground(ctx, rect.width, rect.height);
    hasDrawnRef.current = false;
    setHasDrawn(false);
    if (dataInputRef.current) dataInputRef.current.value = '';
  }

  return (
    <div className="mt-3 rounded-lg border border-slate-700 bg-slate-950 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm text-slate-300">Client signature (optional)</span>
        {hasDrawn && (
          <button type="button" onClick={clear} className="text-xs text-amber-400 hover:underline">
            Clear
          </button>
        )}
      </div>
      <input
        type="text"
        name="signedByName"
        placeholder="Client's name"
        maxLength={200}
        className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-400 focus:outline-none"
      />
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={stop}
        onPointerLeave={stop}
        className="h-32 w-full touch-none rounded-lg border border-dashed border-slate-600 bg-white"
      />
      <input ref={dataInputRef} type="hidden" name="signatureDataUrl" />
    </div>
  );
}
