import { browserPlatform } from './browser';
import type { TVPlatform } from './platform';
import { titanPlatform } from './titan';

export const platform: TVPlatform =
  import.meta.env.VITE_PLATFORM === 'titan' ? titanPlatform : browserPlatform;

