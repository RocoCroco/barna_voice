export type RemoteKey = 'up' | 'down' | 'left' | 'right' | 'ok' | 'back' | 'voice';

export interface TVPlatform {
  name: 'browser' | 'titan';
  isTV: boolean;
  exit(): void;
}

