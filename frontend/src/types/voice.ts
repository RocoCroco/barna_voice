import type { RecommendationMode } from './content';

export interface VoiceSessionContext {
  sessionId: string;
  profileId: string;
  mode: RecommendationMode;
}

export type VoiceStatus =
  | 'disconnected'
  | 'ready'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'paused';

export interface VoiceProvider {
  connect(context: VoiceSessionContext): Promise<void>;
  disconnect(): Promise<void>;
  startListening(): Promise<void>;
  stopListening(): Promise<void>;
  isConnected(): boolean;
  isListening(): boolean;
}
