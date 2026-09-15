// Divya Vaani — shared AI chatbot types

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  modelId: ModelId;
  createdAt: number;
  updatedAt: number;
}

export type ModelId = "llama-3.2-1b" | "llama-3.2-3b";

export interface ModelConfig {
  id: ModelId;
  label: string;
  hindiLabel: string;
  description: string;
  filename: string;
  url: string;
  sizeMB: number;
  minRAMGB: number;
  recommended?: boolean;
}

export type ModelDownloadStatus =
  | "not_downloaded"
  | "downloading"
  | "ready"
  | "error";

export interface ModelDownloadState {
  status: ModelDownloadStatus;
  progress: number; // 0..1
  error?: string;
}

export interface GenerationOptions {
  temperature: number; // 0.2 - 1.0
  maxTokens: number;
  contextLength: number;
}

export const DEFAULT_GENERATION_OPTIONS: GenerationOptions = {
  temperature: 0.7,
  maxTokens: 512,
  contextLength: 2048,
};

export type AIErrorCode =
  | "model_missing"
  | "model_loading"
  | "download_failed"
  | "insufficient_memory"
  | "inference_failed"
  | "generation_timeout"
  | "cancelled"
  | "native_module_unavailable"
  | "corrupted_model"
  | "unsupported_device"
  | "unknown";

export class AIError extends Error {
  code: AIErrorCode;

  constructor(code: AIErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "AIError";
  }
}

export interface AIProvider {
  initialize(modelId: ModelId): Promise<void>;
  isAvailable(): Promise<boolean>;
  generate(
    messages: ChatMessage[],
    options: GenerationOptions,
    onToken?: (token: string) => void,
  ): Promise<string>;
  stop(): Promise<void>;
  dispose(): Promise<void>;
}
