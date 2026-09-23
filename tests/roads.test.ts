import { describe, expect, it } from 'vitest';
import { EAST, NORTH, SOUTH, WEST } from '../src/sim/grid';
import { pieceForMask, roadMask, roadPiece, rotateMask } from '../src/sim/roads';
import { at, newSim, run } from './helpers';

describe('road shapes', () => {
  it('derives every shape and rotation from the neighbour mask', () => {
    expect(pieceForMask(0)).toEqual({ shape: 'isolated', rotation: 0 });

    expect(pieceForMask(NORTH)).toEqual({ shape: 'deadEnd', rotation: 0 });
    expect(pieceForMask(EAST)).toEqual({ shape: 'deadEnd', rotation: 1 });
    expect(pieceForMask(SOUTH)).toEqual({ shape: 'deadEnd', rotation: 2 });
    expect(pieceForMask(WEST)).toEqual({ shape: 'deadEnd', rotation: 3 });

    expect(pieceForMask(NORTH | SOUTH)).toEqual({ shape: 'straight', rotation: 0 });
    expect(pieceForMask(EAST | WEST)).toEqual({ shape: 'straight', rotation: 1 });

    expect(pieceForMask(NORTH | EAST)).toEqual({ shape: 'corner', rotation: 0 });
    expect(pieceForMask(EAST | SOUTH)).toEqual({ shape: 'corner', rotation: 1 });
    expect(pieceForMask(SOUTH | WEST)).toEqual({ shape: 'corner', rotation: 2 });
    expect(pieceForMask(WEST | NORTH)).toEqual({ shape: 'corner', rotation: 3 });

    expect(pieceForMask(NORTH | EAST | SOUTH)).toEqual({ shape: 'tee', rotation: 0 });
    expect(pieceForMask(EAST | SOUTH | WEST)).toEqual({ shape: 'tee', rotation: 1 });
    expect(pieceForMask(SOUTH | WEST | NORTH)).toEqual({ shape: 'tee', rotation: 2 });
    expect(pieceForMask(WEST | NORTH | EAST)).toEqual({ shape: 'tee', rotation: 3 });

    expect(pieceForMask(NORTH | EAST | SOUTH | WEST)).toEqual({ shape: 'cross', rotation: 0 });
  });

  it('round-trips every mask through its piece', () => {
    const base = { isolated: 0, deadEnd: 1, straight: 5, corner: 3, tee: 7, cross: 15 };
    for (let mask = 0; mask < 16; mask++) {
      const { shape, rotation } = pieceForMask(mask);
      expect(rotateMask(base[shape], rotation)).toBe(mask);
    }
  });

  it('connects placed roads automatically', () => {
    const sim = newSim();
    // A plus-shaped junction at (5, 5) with arms of length 2 and an L-bend.
    run(sim, { type: 'placeRoad', from: at(3, 5), to: at(7, 5) });
    run(sim, { type: 'placeRoad', from: at(5, 3), to: at(5, 7) });
    const s = sim.state;

    expect(roadPiece(s, 5, 5)).toEqual({ shape: 'cross', rotation: 0 });
    expect(roadPiece(s, 4, 5)).toEqual({ shape: 'straight', rotation: 1 });
    expect(roadPiece(s, 5, 4)).toEqual({ shape: 'straight', rotation: 0 });
    expect(roadPiece(s, 3, 5)).toEqual({ shape: 'deadEnd', rotation: 1 });
    expect(roadPiece(s, 5, 7)).toEqual({ shape: 'deadEnd', rotation: 0 });

    // Extending one arm sideways turns its end into a tee.
    run(sim, { type: 'placeRoad', from: at(7, 4), to: at(7, 6) });
    expect(roadPiece(s, 7, 5)).toEqual({ shape: 'tee', rotation: 2 });
    expect(roadPiece(s, 7, 4)).toEqual({ shape: 'deadEnd', rotation: 2 });
  });

  it('builds an L-shaped road from a diagonal drag and bends it with a corner', () => {
    const sim = newSim();
    run(sim, { type: 'placeRoad', from: at(2, 2), to: at(6, 4) });
    const s = sim.state;
    // Longer axis first: along y = 2 to x = 6, then down to y = 4.
    expect(roadPiece(s, 6, 2)).toEqual({ shape: 'corner', rotation: 2 });
    expect(roadMask(s, 6, 3)).toBe(NORTH | SOUTH);
  });

  it('ignores non-road neighbours such as zones and power lines', () => {
    const sim = newSim();
    run(sim, { type: 'placeRoad', from: at(5, 5), to: at(5, 5) });
    run(sim, { type: 'placeZone', zone: 'residential', from: at(6, 5), to: at(6, 5) });
    run(sim, { type: 'placePowerLine', from: at(5, 4), to: at(5, 4) });
    expect(roadPiece(sim.state, 5, 5)).toEqual({ shape: 'isolated', rotation: 0 });
  });
});
