import type { Rng } from '@shared/random';
import type { GeoBuilder } from '../../builder';
import type { Palette } from '../palette';
import type { Updater } from './fx';

export interface PropContext {
  b: GeoBuilder;
  c: Palette;
  rng: Rng;
  fx: Updater[];
}

export type PropBuild = (ctx: PropContext) => void;
