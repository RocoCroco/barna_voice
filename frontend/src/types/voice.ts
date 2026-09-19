export type VoiceStatus =
  | 'disconnected'
  | 'ready'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'paused';

export interface VoiceProvider {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  startListening(): Promise<void>;
  stopListening(): Promise<void>;
  isConnected(): boolean;
  isListening(): boolean;
}

