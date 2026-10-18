// Aroma drawings: thin outline in the family colour plus a soft fill of the fruit body (64×64 grid).
// Original drawings; decorative only — the label next to an icon always carries the meaning.
import type { FamilyId } from '~/types/taste'

export interface AromaDrawing {
  /** soft-filled shapes (fill = family colour at low opacity) */
  fill: string[]
  /** outline strokes */
  stroke: string[]
}

const c = (x: number, y: number, r: number) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`
const e = (x: number, y: number, rx: number, ry: number) => `M${x - rx} ${y}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0z`
const both = (paths: string[], extra: string[] = []): AromaDrawing => ({ fill: paths, stroke: [...paths, ...extra] })

const LEMON = 'M8 32c2-9 11-15 24-15s22 6 24 15c-2 9-11 15-24 15S10 41 8 32z'
const APPLE = 'M32 22c-4-4-12-4-16 1-5 7-3 19 3 25 4 5 8 6 13 4 5 2 9 1 13-4 6-6 8-18 3-25-4-5-12-5-16-1z'
const PEAR = 'M32 14c-4 0-6 4-6 9 0 4-8 8-8 17 0 8 6 13 14 13s14-5 14-13c0-9-8-13-8-17 0-5-2-9-6-9z'
const PEACH = 'M32 18c-10 0-17 8-17 17 0 10 8 17 17 17s17-7 17-17c0-9-7-17-17-17z'
const STRAWBERRY = 'M32 54c-10-6-17-15-17-24 0-6 5-9 17-9s17 3 17 9c0 9-7 18-17 24z'
const POD = 'M14 46c4-14 14-26 30-32 2 16-8 28-26 34z'
const LEAF = 'M12 50C14 28 28 14 52 12c-2 24-16 38-40 38z'
const JAR = 'M20 22h24v5c4 3 5 7 5 12v10a4 4 0 0 1-4 4H19a4 4 0 0 1-4-4V39c0-5 1-9 5-12v-5z'

export const DRAWINGS: Record<string, AromaDrawing> = {
  // citrus
  lemon: both([LEMON], ['M3 32h5M56 32h5', 'M18 27c4-4 10-5 16-4']),
  lime: { fill: [c(30, 37, 15), 'M38 21c3-7 10-10 17-9-1 7-7 12-17 9z'], stroke: [c(30, 37, 15), 'M38 21c3-7 10-10 17-9-1 7-7 12-17 9z', 'M38 21l9-6', 'M22 32c2-3 5-4 8-4'] },
  slice: { fill: [c(32, 32, 20)], stroke: [c(32, 32, 20), c(32, 32, 15), 'M32 17v30M19 24.5l26 15M19 39.5l26-15'] },
  zest: { fill: ['M12 22c10-7 28-7 36 2l-4 5c-7-7-20-7-28-2z'], stroke: ['M12 22c10-7 28-7 36 2l-4 5c-7-7-20-7-28-2z', 'M44 29c5 7 1 16-9 17-9 1-15-5-12-11 2-5 9-5 11-1'] },
  // orchard
  apple: both([APPLE], ['M32 22c0-5 1-9 5-13', 'M37 15c4-4 9-4 13-1-3 4-8 5-13 1z', 'M21 30c1-3 3-5 6-5']),
  green_apple: { fill: [APPLE, 'M36 14c5-6 13-7 18-3-4 6-12 8-18 3z'], stroke: [APPLE, 'M32 22c0-5 1-9 4-12', 'M36 14c5-6 13-7 18-3-4 6-12 8-18 3z', 'M40 12l8-1'] },
  pear: both([PEAR], ['M32 14c0-4 1-7 5-10', 'M37 22c2 3 3 6 2 10']),
  peach: { fill: [PEACH, 'M34 18c3-7 10-10 16-8-2 7-9 10-16 8z'], stroke: [PEACH, 'M32 18c-4 8-4 26 0 34', 'M34 18c3-7 10-10 16-8-2 7-9 10-16 8z'] },
  fruits: {
    fill: ['M22 28c-3-3-9-3-12 1-4 5-2 14 2 18 3 4 6 4 10 3 3 1 6 1 9-3 4-4 6-13 2-18-3-4-8-4-11-1z', 'M44 16c-3 0-5 3-5 7 0 3-6 6-6 13 0 6 5 10 11 10s11-4 11-10c0-7-6-10-6-13 0-4-2-7-5-7z'],
    stroke: ['M22 28c-3-3-9-3-12 1-4 5-2 14 2 18 3 4 6 4 10 3 3 1 6 1 9-3 4-4 6-13 2-18-3-4-8-4-11-1z', 'M22 28c0-4 1-7 4-10', 'M44 16c-3 0-5 3-5 7 0 3-6 6-6 13 0 6 5 10 11 10s11-4 11-10c0-7-6-10-6-13 0-4-2-7-5-7z', 'M44 16c0-3 1-6 4-8'],
  },
  grapes: {
    fill: [c(24, 24, 6), c(36, 24, 6), c(30, 34, 6), c(18, 34, 6), c(42, 34, 6), c(24, 44, 6), c(36, 44, 6), c(30, 53, 5)],
    stroke: [c(24, 24, 6), c(36, 24, 6), c(30, 34, 6), c(18, 34, 6), c(42, 34, 6), c(24, 44, 6), c(36, 44, 6), c(30, 53, 5), 'M30 18c0-5 2-9 7-12', 'M33 11c4-3 10-3 13 0-4 3-9 3-13 0z'],
  },
  gooseberry: both([e(32, 36, 15, 17)], ['M32 19c-6 6-8 26 0 34M32 19c6 6 8 26 0 34M20 26c4 6 4 18 0 22M44 26c-4 6-4 18 0 22', 'M32 19v-9M28 10h8']),
  buckthorn: {
    fill: [e(20, 22, 4, 5), e(30, 26, 4, 5), e(22, 34, 4, 5), e(34, 38, 4, 5), e(26, 46, 4, 5), e(38, 50, 4, 5)],
    stroke: [e(20, 22, 4, 5), e(30, 26, 4, 5), e(22, 34, 4, 5), e(34, 38, 4, 5), e(26, 46, 4, 5), e(38, 50, 4, 5), 'M12 10c12 10 22 26 30 46', 'M46 14c-6 2-10 6-12 12'],
  },
  // red berries
  cherry: { fill: [c(21, 44, 10), c(42, 42, 10), 'M38 10c5-4 13-3 16 1-5 4-12 4-16-1z'], stroke: [c(21, 44, 10), c(42, 42, 10), 'M21 34c3-10 9-18 17-24M42 32c-1-8-2-15-4-22', 'M38 10c5-4 13-3 16 1-5 4-12 4-16-1z', 'M16 40c1-2 3-3 5-3'] },
  strawberry: { fill: [STRAWBERRY], stroke: [STRAWBERRY, 'M17 21c4-3 8-4 15-4s11 1 15 4M24 21c2-4 5-6 8-6s6 2 8 6M32 15V9', 'M24 30v1M32 29v1M40 30v1M28 38v1M36 38v1M32 46v1'] },
  raspberry: {
    fill: ['M32 52c-11 0-16-9-16-18 0-8 7-13 16-13s16 5 16 13c0 9-5 18-16 18z'],
    stroke: [c(24, 30, 5), c(32, 28, 5), c(40, 30, 5), c(20, 39, 5), c(28, 38, 5), c(36, 38, 5), c(44, 39, 5), c(25, 47, 5), c(33, 47, 5), c(40, 46, 4), 'M24 21c3-4 5-6 8-6s5 2 8 6M32 15V9'],
  },
  pomegranate: both([c(32, 37, 17)], ['M26 21l2-8 4 5 4-5 2 8', 'M24 36c3-4 7-5 11-4']),
  // dark berries
  blueberry: {
    fill: [c(24, 37, 11), c(41, 39, 9), c(33, 22, 8)],
    stroke: [c(24, 37, 11), c(41, 39, 9), c(33, 22, 8), 'M20 27l2 3 2-3 2 3 2-3', 'M29 15l2 3 2-3 2 3', 'M18 34c1-2 3-3 5-3'],
  },
  currant: {
    fill: [c(22, 20, 4.5), c(30, 27, 5), c(25, 35, 4), c(34, 37, 5), c(36, 48, 5)],
    stroke: [c(22, 20, 4.5), c(30, 27, 5), c(25, 35, 4), c(34, 37, 5), c(36, 48, 5), 'M14 10c10 2 18 8 22 18s4 18 2 24', 'M14 10c-2 4 0 8 4 9'],
  },
  blackberry: {
    fill: [c(26, 29, 4.5), c(34, 28, 4.5), c(22, 37, 4.5), c(30, 37, 4.5), c(38, 36, 4.5), c(26, 45, 4.5), c(34, 45, 4.5), c(30, 52, 3.5)],
    stroke: [c(26, 29, 4.5), c(34, 28, 4.5), c(22, 37, 4.5), c(30, 37, 4.5), c(38, 36, 4.5), c(26, 45, 4.5), c(34, 45, 4.5), c(30, 52, 3.5), 'M24 22c2-4 5-7 8-7s6 3 8 7M32 15v-6M26 9c3 2 9 2 12 0'],
  },
  sloe: {
    fill: [e(27, 37, 8, 10), e(43, 41, 7, 9)],
    stroke: ['M8 18c14 0 30 4 48 14', 'M22 18l-3-6M38 23l2-7M48 27l5-4', e(27, 37, 8, 10), e(43, 41, 7, 9), 'M23 31c1-2 3-3 5-3'],
  },
  plum: both(['M32 14c9 0 15 8 15 18s-7 20-15 20-15-10-15-20 6-18 15-18z'], ['M32 14c-3 8-3 28 1 38', 'M32 14c1-4 4-6 8-7', 'M23 26c1-3 3-5 6-6']),
  // tropical
  pineapple: { fill: [e(32, 40, 12, 15)], stroke: [e(32, 40, 12, 15), 'M22 32l20 16M42 32L22 48M20 40l8 9M44 40l-8 9', 'M32 25l-6-14M32 25V9M32 25l6-14M32 25l-11-8M32 25l11-8'] },
  banana: both(['M10 24c4 18 20 28 40 22 4-1 4-5 0-5-16 3-28-4-34-19-2-4-7-3-6 2z'], ['M48 46l5 2', 'M14 26c5 10 14 16 26 16']),
  mango: { fill: ['M20 46c-8-10-4-28 10-32 12-3 20 6 18 18-2 14-18 24-28 14z', 'M34 14c2-6 8-8 14-6-2 6-8 8-14 6z'], stroke: ['M20 46c-8-10-4-28 10-32 12-3 20 6 18 18-2 14-18 24-28 14z', 'M34 14c2-6 8-8 14-6-2 6-8 8-14 6z', 'M24 24c2-3 5-4 8-4'] },
  melon: both([e(32, 34, 20, 16)], ['M32 18c-8 6-8 26 0 32M32 18c8 6 8 26 0 32M20 21c-4 7-4 19 0 26M44 21c4 7 4 19 0 26']),
  kiwi: { fill: [c(32, 32, 19)], stroke: [c(32, 32, 19), e(32, 32, 7, 6), 'M32 20v2M41 23l-1 1.5M44 32h-2M41 41l-1-1.5M32 44v-2M23 41l1-1.5M20 32h2M23 23l1 1.5'] },
  // dried
  prune: both(['M32 14c10 0 16 9 16 19s-7 19-16 19-16-9-16-19 6-19 16-19z'], ['M24 24c4 3 4 9 0 13M32 20c3 5 3 14-1 22M40 26c-3 4-3 10 1 14']),
  fig: both(['M32 12c4 6 16 16 16 26 0 9-7 15-16 15s-16-6-16-15c0-10 12-20 16-26z'], ['M32 12V6', 'M32 22c-4 8-5 18-2 28', c(38, 38, 1.2), c(36, 46, 1.2), c(26, 42, 1.2)]),
  dried_apricot: both(['M14 36c0-12 8-20 18-20s18 8 18 20c-6 6-12 9-18 9s-12-3-18-9z'], ['M22 24c3 3 5 8 4 14M32 20v20M42 24c-3 3-5 8-4 14']),
  jar: { fill: [JAR], stroke: [JAR, 'M18 14h28v8H18z', 'M15 40h34'] },
  // floral
  flower: { fill: ['M32 28c-4-7-4-14 0-18 4 4 4 11 0 18zM36 32c7-4 14-4 18 0-4 4-11 4-18 0zM32 36c4 7 4 14 0 18-4-4-4-11 0-18zM28 32c-7 4-14 4-18 0 4-4 11-4 18 0z'], stroke: ['M32 28c-4-7-4-14 0-18 4 4 4 11 0 18zM36 32c7-4 14-4 18 0-4 4-11 4-18 0zM32 36c4 7 4 14 0 18-4-4-4-11 0-18zM28 32c-7 4-14 4-18 0 4-4 11-4 18 0z', c(32, 32, 4)] },
  rose: { fill: [e(32, 26, 13, 12)], stroke: [e(32, 26, 13, 12), 'M32 19c4 0 6 3 6 6s-3 6-6 6-6-2-6-5', 'M27 17c2 4 6 5 10 3', 'M32 38v18M32 47c4-3 8-3 11 0-3 3-7 3-11 0z'] },
  lavender: { fill: [e(32, 14, 3, 4), e(28, 22, 3, 4), e(36, 22, 3, 4), e(28, 30, 3, 4), e(36, 30, 3, 4), e(32, 38, 3, 4)], stroke: [e(32, 14, 3, 4), e(28, 22, 3, 4), e(36, 22, 3, 4), e(28, 30, 3, 4), e(36, 30, 3, 4), e(32, 38, 3, 4), 'M32 42v14M32 50c-5-1-8-4-9-8M32 50c5-1 8-4 9-8'] },
  // herbal
  herb: { fill: ['M32 20c-5-1-8-4-9-9 5 0 8 3 9 9zM32 20c5-1 8-4 9-9-5 0-8 3-9 9zM32 31c-6-1-10-5-11-11 6 0 10 5 11 11zM32 31c6-1 10-5 11-11-6 0-10 5-11 11zM32 42c-6-1-10-5-11-11 6 0 10 5 11 11zM32 42c6-1 10-5 11-11-6 0-10 5-11 11z'], stroke: ['M32 56V10', 'M32 20c-5-1-8-4-9-9 5 0 8 3 9 9zM32 20c5-1 8-4 9-9-5 0-8 3-9 9zM32 31c-6-1-10-5-11-11 6 0 10 5 11 11zM32 31c6-1 10-5 11-11-6 0-10 5-11 11zM32 42c-6-1-10-5-11-11 6 0 10 5 11 11zM32 42c6-1 10-5 11-11-6 0-10 5-11 11z'] },
  leaf: both([LEAF], ['M12 50L40 22', 'M22 40h8M28 34v-8M34 28h8']),
  pine: { fill: [], stroke: ['M32 56V8', 'M32 14l-8-4M32 14l8-4M32 22l-10-5M32 22l10-5M32 30l-12-6M32 30l12-6M32 38l-12-6M32 38l12-6M32 46l-10-5M32 46l10-5'] },
  chili: { fill: ['M20 22c-6 10-4 24 6 30 3 2 6 0 5-3-4-8-3-17 2-25 2-4-1-6-4-6-4 0-7 1-9 4z'], stroke: ['M20 22c-6 10-4 24 6 30 3 2 6 0 5-3-4-8-3-17 2-25 2-4-1-6-4-6-4 0-7 1-9 4z', 'M28 18c2-5 6-8 11-9'] },
  // spice
  anise: { fill: ['M32 10l4 12 11-7-6 12 12 3-12 4 6 12-11-7-4 12-4-12-11 7 6-12-12-4 12-3-6-12 11 7z'], stroke: ['M32 10l4 12 11-7-6 12 12 3-12 4 6 12-11-7-4 12-4-12-11 7 6-12-12-4 12-3-6-12 11 7z', c(32, 30, 3)] },
  pepper: { fill: [c(22, 26, 8), c(42, 26, 8), c(32, 43, 8)], stroke: [c(22, 26, 8), c(42, 26, 8), c(32, 43, 8), 'M17 22c3-2 6-2 9 0M37 22c3-2 6-2 9 0M27 39c3-2 6-2 9 0'] },
  cinnamon: { fill: ['M14 44L42 16l6 6-28 28z', 'M20 50L48 22l4 4-28 28z'], stroke: ['M14 44L42 16l6 6-28 28z', 'M20 50L48 22l4 4-28 28z', 'M42 16c2-2 6 2 6 6M48 22c2-2 5 1 4 4'] },
  // nuts
  nut: both([c(32, 33, 18)], ['M32 15v36', 'M24 22c3 4 3 8 0 12s-3 8 0 12M40 22c-3 4-3 8 0 12s3 8 0 12']),
  almond: both(['M32 10c10 8 14 18 14 26 0 10-6 18-14 18s-14-8-14-18c0-8 4-18 14-26z'], ['M28 24c2 4 2 10 0 16M36 24c-2 4-2 10 0 16']),
  // wood, tobacco, coffee
  oak: {
    fill: ['M32 52c-4 0-6-3-6-6-4 1-7-2-6-6-4-1-5-5-2-8-3-2-2-7 2-7-1-4 3-7 6-5 0-4 4-6 6-4 2-2 6 0 6 4 3-2 7 1 6 5 4 0 5 5 2 7 3 3 2 7-2 8 1 4-2 7-6 6 0 3-2 6-6 6z'],
    stroke: ['M32 52c-4 0-6-3-6-6-4 1-7-2-6-6-4-1-5-5-2-8-3-2-2-7 2-7-1-4 3-7 6-5 0-4 4-6 6-4 2-2 6 0 6 4 3-2 7 1 6 5 4 0 5 5 2 7 3 3 2 7-2 8 1 4-2 7-6 6 0 3-2 6-6 6z', 'M32 58V22', 'M32 34l-6-4M32 40l6-4'],
  },
  tobacco: both(['M32 8c10 10 14 22 14 30s-6 16-14 18c-8-2-14-10-14-18S22 18 32 8z'], ['M32 12v46', 'M32 24l-7-5M32 24l7-5M32 34l-9-6M32 34l9-6M32 44l-9-6M32 44l9-6']),
  coffee: both([e(32, 32, 14, 18)], ['M32 14c-6 8 6 28 0 36']),
  drop: both(['M32 10c8 12 14 20 14 28a14 14 0 0 1-28 0c0-8 6-16 14-28z'], ['M26 38c0 4 3 7 6 8']),
  // sweet
  honey: { fill: ['M22 14h20l10 18-10 18H22L12 32z'], stroke: ['M22 14h20l10 18-10 18H22L12 32z', 'M32 23l8 4.5v9L32 41l-8-4.5v-9z', 'M44 46c0 4 2 7 4 8 2-1 4-4 4-8'] },
  vanilla: { fill: ['M38 12c4 0 8 3 8 7-4 2-9 0-10-4 0-2 1-3 2-3z'], stroke: ['M12 54C20 40 30 26 42 14', 'M18 54C26 40 36 26 46 18', 'M38 12c4 0 8 3 8 7-4 2-9 0-10-4 0-2 1-3 2-3z', 'M12 54c2 2 4 2 6 0'] },
  chocolate: { fill: ['M16 14h32v36H16z'], stroke: ['M16 14h32v36H16z', 'M16 26h32M16 38h32M27 14v36M37 14v36'] },
  cocoa: both([e(32, 32, 13, 22)], ['M32 10v44M23 18c3 3 15 3 18 0M21 32c4 3 18 3 22 0M23 46c3-3 15-3 18 0']),
  candy: { fill: [e(32, 32, 11, 9)], stroke: [e(32, 32, 11, 9), 'M21 32l-9-7v14zM43 32l9-7v14z', 'M28 26c-2 4-2 8 0 12M36 26c-2 4-2 8 0 12'] },
  pastry: both(['M10 40c2-12 12-20 22-20s20 8 22 20c-6 4-14 6-22 6s-16-2-22-6z'], ['M22 24c2 6 3 12 2 20M32 20v26M42 24c-2 6-3 12-2 20']),
  // mineral
  stone: both(['M14 40l8-18 18-6 10 15-6 18-20 3z'], ['M22 22l9 13 19-4M31 35l-5 17M31 35l13 14']),
  salt: { fill: ['M20 24l12-8 12 8v16l-12 8-12-8z'], stroke: ['M20 24l12-8 12 8v16l-12 8-12-8z', 'M20 24l12 8 12-8M32 32v16'] },
  smoke: { fill: [], stroke: ['M20 54c-5-6 5-10 0-16s5-10 0-16', 'M32 54c-5-6 5-10 0-16s5-10 0-16 5-10 0-14', 'M44 54c-5-6 5-10 0-16s5-10 0-16'] },
  mushroom: { fill: ['M12 32c0-11 9-18 20-18s20 7 20 18z'], stroke: ['M12 32c0-11 9-18 20-18s20 7 20 18z', 'M26 32v14c0 4 3 6 6 6s6-2 6-6V32', 'M22 22a2 2 0 1 0 0 .1M38 20a2 2 0 1 0 0 .1M31 24a2 2 0 1 0 0 .1'] },
}

/** Note id → drawing. Notes without their own drawing use their family's. */
export const NOTE_DRAWING: Record<string, string> = {
  lemon: 'lemon', bergamot: 'lemon', lime: 'lime', grapefruit: 'slice', orange: 'slice', mandarin: 'slice', pomelo: 'slice', citrus: 'slice', zest: 'zest',
  green_apple: 'green_apple', apple: 'apple', pear: 'pear', quince: 'pear', gooseberry: 'gooseberry', sea_buckthorn: 'buckthorn',
  peach: 'peach', nectarine: 'peach', apricot: 'peach', alycha: 'plum', white_plum: 'plum', grape: 'grapes', fruit: 'fruits',
  cherry: 'cherry', sweet_cherry: 'cherry', strawberry: 'strawberry', wild_strawberry: 'strawberry', raspberry: 'raspberry',
  cranberry: 'currant', lingonberry: 'currant', red_currant: 'currant', barberry: 'currant', cornel: 'sloe', rosehip: 'sloe',
  pomegranate: 'pomegranate', red_berries: 'raspberry', garden_berries: 'raspberry', forest_berries: 'blueberry', berries: 'raspberry',
  black_currant: 'currant', currant: 'currant', blackberry: 'blackberry', mulberry: 'blackberry', blueberry: 'blueberry', bilberry: 'blueberry',
  elderberry: 'currant', sloe: 'sloe', aronia: 'currant', plum: 'plum', dark_berries: 'blueberry',
  pineapple: 'pineapple', mango: 'mango', papaya: 'mango', guava: 'mango', passion_fruit: 'mango', lychee: 'mango', banana: 'banana', kiwi: 'kiwi', melon: 'melon', tropical: 'pineapple',
  prune: 'prune', dried_fruit: 'prune', date: 'prune', dried_apricot: 'dried_apricot', raisin: 'grapes', fig: 'fig', dried_cherry: 'cherry', candied: 'jar', jam: 'jar',
  white_flowers: 'flower', flowers: 'flower', acacia: 'flower', jasmine: 'flower', chamomile: 'flower', honeysuckle: 'flower', linden: 'flower',
  rose: 'rose', peony: 'rose', violet: 'lavender', iris: 'lavender', lavender: 'lavender',
  herbs: 'herb', thyme: 'herb', fennel: 'herb', wormwood: 'herb', cut_grass: 'herb', lemongrass: 'herb', rosemary: 'pine', pine: 'pine',
  mint: 'leaf', basil: 'leaf', sage: 'leaf', eucalyptus: 'leaf', bay_leaf: 'leaf', currant_leaf: 'leaf', rhubarb: 'leaf', green_pepper: 'chili',
  black_pepper: 'pepper', pepper: 'pepper', cardamom: 'pepper', anise: 'anise', clove: 'anise', spices: 'anise', saffron: 'anise', ginger: 'anise',
  cinnamon: 'cinnamon', licorice: 'cinnamon', nutmeg: 'nut',
  walnut: 'nut', hazelnut: 'nut', pistachio: 'almond', almond: 'almond', nuts: 'nut',
  oak: 'oak', woody: 'oak', cedar: 'oak', resin: 'drop', tobacco: 'tobacco', leather: 'tobacco', coffee: 'coffee',
  honey: 'honey', vanilla: 'vanilla', caramel: 'candy', toffee: 'candy', candy: 'candy', chocolate: 'chocolate', cocoa: 'cocoa', pastry: 'pastry',
  mineral: 'stone', chalk: 'stone', flint: 'stone', graphite: 'stone', salt: 'salt', smoke: 'smoke', petrol: 'drop', earth: 'mushroom',
}

export const FAMILY_DRAWING: Record<FamilyId, string> = {
  citrus: 'slice', orchard: 'apple', red_berry: 'cherry', dark_berry: 'blueberry', tropical: 'pineapple', dried: 'prune',
  floral: 'flower', herbal: 'herb', spice: 'anise', nut: 'nut', wood: 'oak', sweet: 'honey', mineral: 'stone',
}

export function aromaDrawing(note: string | undefined, family: FamilyId): AromaDrawing {
  return DRAWINGS[(note && NOTE_DRAWING[note]) || FAMILY_DRAWING[family]] ?? DRAWINGS.leaf!
}
