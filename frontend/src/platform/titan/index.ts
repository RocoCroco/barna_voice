import type { TVPlatform } from '../platform';

export const titanPlatform: TVPlatform = {
  name: 'titan',
  isTV: true,
  exit: () => {
    // Titan OS SDK integration will live only in this adapter.
  },
};

