// Divya Vaani — inference abstraction.
//
// The UI never talks to llama.rn directly — only to `aiService` below. That
// keeps the door open to swap in a different local runtime, an HTTP
// inference server, or (later, explicitly) a cloud backend without touching
// any screen or component.
//
// The `require("llama.rn")` is wrapped in try/catch because this is a native
// module: if the dev client hasn't been rebuilt after installing it (or this
// ever runs somewhere the native module isn't linked), importing it throws
// at load time. We degrade to a clear "native_module_unavailable" error
// instead of crashing the app.

import { AIError, AIProvider, ChatMessage, GenerationOptions, ModelId } from "@/types/ai";
import { modelService } from "./modelService";

export const SYSTEM_PROMPT = `You are a respectful spiritual assistant knowledgeable about Hindu philosophy, bhakti traditions, meditation, yoga, scriptures, festivals, mantras, temples, and Indian spiritual traditions.
Answer in the language used by the user.
If the user asks in Hindi, answer in Hindi.
If the user asks in English, answer in English.
If the user mixes Hindi and English, respond naturally in the same style.
Be respectful toward all religious traditions.
Do not claim to be God, a guru, priest, or divine authority.
Do not fabricate scripture quotations.
When discussing scripture, distinguish between direct quotations, commonly accepted interpretations, and your own explanation.
For medical, legal, financial, or other high-stakes questions, clearly recommend consulting an appropriate qualified professional.
Keep answers concise unless the user asks for detail.
You only answer questions about religion, spirituality, Hindu philosophy, bhakti, meditation, yoga, scriptures, festivals, mantras, temples, and Indian spiritual traditions.
If the user asks about anything outside this scope — coding, general trivia, current events, math homework, entertainment, or any other unrelated topic — politely decline and redirect them back to spiritual topics instead of answering it. Do not attempt to answer the off-topic question first.
Example decline, adapt to the user's language: "मैं केवल आध्यात्मिक और धार्मिक विषयों में सहायता कर सकता हूँ। / I can only help with spiritual and religious topics — feel free to ask me about dharma, meditation, mantras, or scripture."`;

const GENERATION_TIMEOUT_MS = 120_000;
const STOP_TOKENS = ["</s>", "<|eot_id|>", "<|end_of_text|>"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let LlamaModule: any | null = null;
try {
  // Optional native dependency — absent until `llama.rn` is installed and
  // the dev client is rebuilt with it linked in.
  LlamaModule = require("llama.rn");
} catch {
  LlamaModule = null;
}

function toNativePath(uri: string): string {
  return uri.startsWith("file://") ? uri.slice("file://".length) : uri;
}

// `require("llama.rn")` can succeed (the JS/TS module resolves fine) even
// when the *native* module was never compiled into the running client —
// e.g. the dev client is stale from before llama.rn was added and prebuilt.
// That surfaces deep inside initLlama as something like
// "Cannot read property 'install' of null" (a JSI-install call hitting a
// null native module handle), which is not a model/download problem at all.
function looksLikeMissingNativeBinary(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /install|nativemodule|turbomodule/i.test(message) && /null|undefined/i.test(message);
}

class LlamaRNProvider implements AIProvider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private context: any = null;
  private currentModelId: ModelId | null = null;
  private cancelled = false;

  async initialize(modelId: ModelId, contextLength = 2048): Promise<void> {
    if (!LlamaModule) {
      throw new AIError(
        "native_module_unavailable",
        "The on-device AI engine isn't built into this app yet. Rebuild the dev client after installing llama.rn.",
      );
    }

    if (this.context && this.currentModelId === modelId) return;
    if (this.context) await this.dispose();

    const status = await modelService.getStatus(modelId);
    if (status.status !== "ready") {
      throw new AIError("model_missing", "The AI model isn't downloaded yet.");
    }

    try {
      this.context = await LlamaModule.initLlama({
        model: toNativePath(modelService.getModelPath(modelId)),
        n_ctx: contextLength,
        n_gpu_layers: 0,
      });
      this.currentModelId = modelId;
    } catch (err) {
      this.context = null;
      this.currentModelId = null;
      // Swallowed for the UI (a raw native error isn't user-friendly), but
      // logged so it's visible in Metro/Xcode/Logcat during debugging.
      console.error("[aiService] initLlama failed:", err);

      if (looksLikeMissingNativeBinary(err)) {
        throw new AIError(
          "native_module_unavailable",
          "The on-device AI engine isn't compiled into this build yet. Rebuild the dev client (npx expo prebuild --clean, then npx expo run:ios / run:android, or a new EAS dev-client build) — see AI_CHATBOT_SETUP.md.",
        );
      }

      throw new AIError(
        "model_loading",
        "देव वाणी could not load the AI model. It may be corrupted — try re-downloading it.",
      );
    }
  }

  async isAvailable(): Promise<boolean> {
    return !!LlamaModule && !!this.context;
  }

  async generate(
    messages: ChatMessage[],
    options: GenerationOptions,
    onToken?: (token: string) => void,
  ): Promise<string> {
    if (!this.context) {
      throw new AIError("model_missing", "The AI model isn't loaded yet.");
    }

    this.cancelled = false;
    const chatMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const completionPromise = this.context.completion(
      {
        messages: chatMessages,
        n_predict: options.maxTokens,
        temperature: options.temperature,
        stop: STOP_TOKENS,
      },
      (data: { token: string }) => {
        if (this.cancelled) return;
        onToken?.(data.token);
      },
    );

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new AIError("generation_timeout", "The response took too long. Please try again.")),
        GENERATION_TIMEOUT_MS,
      );
    });

    try {
      const result = await Promise.race([completionPromise, timeoutPromise]);
      if (this.cancelled) {
        throw new AIError("cancelled", "Generation stopped.");
      }
      return (result?.text ?? "").trim();
    } catch (err) {
      if (err instanceof AIError) throw err;
      if (this.cancelled) {
        throw new AIError("cancelled", "Generation stopped.");
      }
      throw new AIError("inference_failed", "The AI could not generate a response. Please try again.");
    }
  }

  async stop(): Promise<void> {
    this.cancelled = true;
    try {
      await this.context?.stopCompletion?.();
    } catch {
      // best-effort — generation loop already checks `cancelled`
    }
  }

  async dispose(): Promise<void> {
    try {
      await this.context?.release?.();
    } catch {
      // ignore — context is being discarded regardless
    }
    this.context = null;
    this.currentModelId = null;
  }
}

const provider = new LlamaRNProvider();

export const aiService = {
  SYSTEM_PROMPT,
  isNativeModuleAvailable(): boolean {
    return !!LlamaModule;
  },
  initialize(modelId: ModelId, contextLength?: number): Promise<void> {
    return provider.initialize(modelId, contextLength);
  },
  isAvailable(): Promise<boolean> {
    return provider.isAvailable();
  },
  generate(
    messages: ChatMessage[],
    options: GenerationOptions,
    onToken?: (token: string) => void,
  ): Promise<string> {
    return provider.generate(messages, options, onToken);
  },
  stop(): Promise<void> {
    return provider.stop();
  },
  dispose(): Promise<void> {
    return provider.dispose();
  },
};
