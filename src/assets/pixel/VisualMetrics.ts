import type { Direction, GridPoint } from '../../core/types';

/**
 * Contrato visual único da 0.0.4. A grade continua sendo a verdade da lógica;
 * sprites podem ultrapassar a célula somente dentro destes limites declarados.
 */
export const VISUAL_METRICS = {
  isoTile: { width: 64, height: 32 },
  zoomLevels: [0.5, 1, 2] as const,
  defaultZoomIndex: 1,
  character: {
    frame: { width: 96, height: 144 },
    feetAnchor: { x: 48, y: 136 },
    logicalFootprint: { width: 1, depth: 1 },
    expectedHeightBlocks: { min: 1.5, max: 2 },
    uiOffset: 132,
  },
  world: {
    frame: { width: 192, height: 192 },
    serviceCounterFrame: { width: 256, height: 192 },
    floorY: 178,
    maxOverhangCells: 0.35,
  },
  depth: {
    floor: -10_000,
    wall: 8,
    chairBack: 20,
    furnitureBase: 30,
    seatedCharacter: 34,
    chairFront: 38,
    counterItem: 44,
    standingCharacter: 50,
    status: 98,
  },
} as const;

export function roundPixel(value: number): number {
  return Math.round(value);
}

/** Converte um passo da grade na direção visual isométrica. */
export function gridDeltaToFacing(dx: number, dy: number, fallback: Direction = 'se'): Direction {
  if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) return dx > 0 ? 'se' : 'nw';
  if (dy !== 0) return dy > 0 ? 'sw' : 'ne';
  return fallback;
}

export function facingBetween(from: GridPoint, to: GridPoint, fallback: Direction = 'se'): Direction {
  return gridDeltaToFacing(to.x - from.x, to.y - from.y, fallback);
}

export function depthAtBase(point: GridPoint, layer = 0): number {
  return Math.round((point.x + point.y) * 100 + point.x + layer);
}

/**
 * Ponto de contato usado para ordenar um móvel como um volume apoiado no piso.
 * Usar o último bloco do retângulo fazia móveis largos herdarem centenas de
 * pontos extras de profundidade e cobrirem personagens que estavam à frente.
 */
export function footprintDepthPoint(origin: GridPoint, footprint: { width: number; depth: number }): GridPoint {
  return {
    x: origin.x + (footprint.width - 1) / 2,
    y: origin.y + (footprint.depth - 1) / 2,
  };
}

export function footprintCells(origin: GridPoint, footprint: { width: number; depth: number }): GridPoint[] {
  const cells: GridPoint[] = [];
  for (let y = 0; y < footprint.depth; y += 1) {
    for (let x = 0; x < footprint.width; x += 1) cells.push({ x: origin.x + x, y: origin.y + y });
  }
  return cells;
}

export function footprintContains(origin: GridPoint, footprint: { width: number; depth: number }, point: GridPoint): boolean {
  return point.x >= origin.x && point.x < origin.x + footprint.width
    && point.y >= origin.y && point.y < origin.y + footprint.depth;
}
