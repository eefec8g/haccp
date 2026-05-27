'use client';

import { useCallback, useId, useRef, useState } from 'react';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '@/lib/constants/signature';
import { MG_GHOST_BUTTON_CLASSES } from '@/lib/constants/styles';
import { SUBMIT_CLASSES } from '@/components/features/ui/form-styles';

/**
 * Composant de capture de signature manuscrite (US-SIG-001).
 *
 * Canvas HTML5 500x200 + pointer events (mouse / touch / stylus). Sans
 * dependance externe : l'API native couvre tous les besoins (lissage via
 * `lineCap: 'round'` + `lineJoin: 'round'`, lineWidth 2 ; coordonnees
 * relatives au canvas via `getBoundingClientRect`).
 *
 * Pipeline :
 *   - `pointerdown`  -> demarre un nouveau stroke (marqueur `isEmpty=false`).
 *   - `pointermove`  -> etend le stroke courant (drawing actif uniquement
 *     entre pointerdown et pointerup, pas de drag accidentel).
 *   - `pointerup` / `pointerleave` -> termine le stroke.
 *
 * Export :
 *   - "Effacer" : `clearRect` + reset `isEmpty=true`.
 *   - "Signer"  : `canvas.toBlob('image/png')` -> appelle `onSign(blob)`.
 *     Le bouton est `disabled` tant qu'aucun trace n'a ete dessine.
 *
 * a11y :
 *   - `role="img"` sur le canvas + aria-label clair.
 *   - Instructions textuelles visibles sous le canvas.
 *   - Boutons natifs (focus visible + keyboard activable).
 *
 * Charte Maison Givre :
 *   - Bord canvas mg-noir/20, fond ivoire, ombre legere.
 *   - Trait mg-noir (#0D0D0D) lineWidth 2.
 *   - Boutons : Effacer = ghost (MG_GHOST_BUTTON_CLASSES), Signer = primary.
 */

const STROKE_LINE_WIDTH = 2;
const STROKE_COLOR = '#0D0D0D';

const CONTAINER_CLASSES =
  'flex flex-col gap-3 border border-mg-noir/15 bg-mg-ivoire p-4 shadow-sm';
/**
 * `aspect-[5/2]` aligne la zone visuelle (CSS) sur le ratio natif du
 * canvas (500x200 = 5:2). Sans ca, sur un viewport etroit l'image etait
 * etiree verticalement par le `width=500 height=200` natif, donnant
 * l'illusion d'une signature deformee. `getCanvasPoint` recalcule deja
 * les coordonnees via `getBoundingClientRect`, donc la precision du
 * trace reste fidele meme avec un ratio CSS distinct du natif.
 */
const CANVAS_CLASSES =
  'aspect-[5/2] w-full max-w-full touch-none cursor-crosshair border border-mg-noir/15 bg-white';
const INSTRUCTIONS_CLASSES =
  'text-[11px] font-light uppercase tracking-[0.2em] text-mg-noir/60';
const ACTIONS_ROW_CLASSES = 'flex flex-wrap items-center justify-end gap-3';

const INSTRUCTIONS_TEXT =
  'Dessinez votre signature dans la zone ci-dessus, puis validez.';
const CANVAS_LABEL = 'Zone de signature';

interface PointXY {
  readonly x: number;
  readonly y: number;
}

function getCanvasPoint(
  canvas: HTMLCanvasElement,
  event: { clientX: number; clientY: number }
): PointXY {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }
  return ctx;
}

/**
 * Applique les styles de trait au context une seule fois (au demarrage
 * d'un stroke). Audit perf Mp-1 : evite la re-affectation a chaque
 * `pointermove` (plusieurs centaines par seconde). Les proprietes
 * appliquees restent en vigueur jusqu'au prochain `startStroke`.
 */
function applyStrokeStyles(ctx: CanvasRenderingContext2D): void {
  ctx.lineWidth = STROKE_LINE_WIDTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = STROKE_COLOR;
}

function exportPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('toBlob returned null')),
      'image/png'
    );
  });
}

export interface SignaturePadProps {
  readonly onSign: (blob: Blob) => void;
  readonly disabled?: boolean;
  readonly testId?: string;
}

export function SignaturePad({ onSign, disabled, testId }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const instructionsId = useId();

  const startStroke = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (disabled) {
        return;
      }
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      const ctx = getCanvasContext(canvas);
      // Audit perf Mp-1 : applique les styles UNE fois au demarrage du
      // stroke, pas a chaque pointermove (hot path haute frequence).
      applyStrokeStyles(ctx);
      const point = getCanvasPoint(canvas, event);
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      isDrawingRef.current = true;
      canvas.setPointerCapture(event.pointerId);
      setIsEmpty(false);
    },
    [disabled]
  );

  const extendStroke = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current) {
        return;
      }
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      const ctx = getCanvasContext(canvas);
      const point = getCanvasPoint(canvas, event);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    },
    []
  );

  const endStroke = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current) {
        return;
      }
      isDrawingRef.current = false;
      const canvas = canvasRef.current;
      if (canvas && canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    },
    []
  );

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    isDrawingRef.current = false;
    setIsEmpty(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const blob = await exportPng(canvas);
    onSign(blob);
  }, [onSign]);

  const resolvedTestId = testId ?? 'signature-pad';
  const submitDisabled = disabled || isEmpty;

  return (
    <div className={CONTAINER_CLASSES} data-testid={resolvedTestId}>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        role="img"
        aria-label={CANVAS_LABEL}
        aria-describedby={instructionsId}
        className={CANVAS_CLASSES}
        data-testid={`${resolvedTestId}-canvas`}
        onPointerDown={startStroke}
        onPointerMove={extendStroke}
        onPointerUp={endStroke}
        onPointerLeave={endStroke}
        onPointerCancel={endStroke}
      />
      <p id={instructionsId} className={INSTRUCTIONS_CLASSES}>
        {INSTRUCTIONS_TEXT}
      </p>
      <div className={ACTIONS_ROW_CLASSES}>
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled || isEmpty}
          className={MG_GHOST_BUTTON_CLASSES}
          data-testid={`${resolvedTestId}-clear`}
        >
          Effacer
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitDisabled}
          aria-busy={disabled}
          className={SUBMIT_CLASSES}
          data-testid={`${resolvedTestId}-submit`}
        >
          Signer le registre
        </button>
      </div>
    </div>
  );
}
