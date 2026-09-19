import type { TVPlatform } from '../platform';

export const browserPlatform: TVPlatform = {
  name: 'browser',
  isTV: false,
  exit: () => window.history.back(),
};

