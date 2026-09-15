// Divya Vaani — model registry, download, and on-disk lifecycle.
//
// Models are never bundled in the app/git. They're pulled on demand from
// Hugging Face (ungated, community GGUF quantizations of Llama 3.2) into
// the app's document directory, with resumable progress so a multi-hundred-MB
// download over mobile data doesn't silently die.
//
// Uses the legacy expo-file-system API (`expo-file-system/legacy`) rather than
// the SDK 54+ File/Directory API specifically for createDownloadResumable's
// well-defined pause/resume + progress-callback contract.

import * as FileSystem from "expo-file-system/legacy";
import * as Device from "expo-device";
import { ModelConfig, ModelDownloadState, ModelId } from "@/types/ai";

const MODELS_DIR = `${FileSystem.documentDirectory}models/`;

export const MODEL_REGISTRY: Record<ModelId, ModelConfig> = {
  "llama-3.2-1b": {
    id: "llama-3.2-1b",
    label: "Llama 3.2 1B",
    hindiLabel: "लामा 3.2 1B",
    description: "Recommended for most phones — fast, lighter memory use",
    filename: "llama-3.2-1b-instruct-q4_k_m.gguf",
    url: "https://huggingface.co/unsloth/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf",
    sizeMB: 770,
    minRAMGB: 3,
    recommended: true,
  },
  "llama-3.2-3b": {
    id: "llama-3.2-3b",
    label: "Llama 3.2 3B",
    hindiLabel: "लामा 3.2 3B",
    description: "Better responses, requires more memory",
    filename: "llama-3.2-3b-instruct-q4_k_m.gguf",
    url: "https://huggingface.co/unsloth/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf",
    sizeMB: 2020,
    minRAMGB: 6,
  },
};

async function ensureModelsDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(MODELS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(MODELS_DIR, { intermediates: true });
  }
}

function getModelPath(modelId: ModelId): string {
  return `${MODELS_DIR}${MODEL_REGISTRY[modelId].filename}`;
}

// GGUF files should land within a few % of the registry's advertised size.
// A much smaller file almost always means a truncated/corrupt download (e.g.
// an interrupted transfer, or a redirect chain that served an HTML error
// page instead of the model) rather than a real, loadable model.
function minExpectedBytes(modelId: ModelId): number {
  return MODEL_REGISTRY[modelId].sizeMB * 1024 * 1024 * 0.9;
}

async function getStatus(modelId: ModelId): Promise<ModelDownloadState> {
  try {
    const path = getModelPath(modelId);
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) {
      return { status: "not_downloaded", progress: 0 };
    }
    if (info.size < minExpectedBytes(modelId)) {
      // Self-heal: a previous download that silently truncated shouldn't
      // keep reporting "ready" forever.
      await FileSystem.deleteAsync(path, { idempotent: true });
      return { status: "not_downloaded", progress: 0 };
    }
    return { status: "ready", progress: 1 };
  } catch {
    return { status: "not_downloaded", progress: 0 };
  }
}

const activeDownloads = new Map<ModelId, FileSystem.DownloadResumable>();

async function download(
  modelId: ModelId,
  onProgress?: (progress: number) => void,
): Promise<void> {
  await ensureModelsDir();
  const config = MODEL_REGISTRY[modelId];
  const destination = getModelPath(modelId);
  const tempDestination = `${destination}.download`;

  const resumable = FileSystem.createDownloadResumable(
    config.url,
    tempDestination,
    {},
    (data) => {
      if (data.totalBytesExpectedToWrite > 0) {
        onProgress?.(data.totalBytesWritten / data.totalBytesExpectedToWrite);
      }
    },
  );
  activeDownloads.set(modelId, resumable);

  try {
    const result = await resumable.downloadAsync();
    if (!result || result.status !== 200) {
      throw new Error(`Download failed with status ${result?.status ?? "unknown"}`);
    }

    const info = await FileSystem.getInfoAsync(tempDestination);
    if (!info.exists || info.size < minExpectedBytes(modelId)) {
      throw new Error(
        `Download incomplete: got ${info.exists ? info.size : 0} bytes, expected at least ~${Math.round(
          config.sizeMB * 0.9,
        )} MB. This usually means the connection dropped or a redirect served an error page instead of the model — please retry on a stable connection.`,
      );
    }

    await FileSystem.moveAsync({ from: tempDestination, to: destination });
    onProgress?.(1);
  } catch (err) {
    await FileSystem.deleteAsync(tempDestination, { idempotent: true });
    throw err;
  } finally {
    activeDownloads.delete(modelId);
  }
}

async function cancelDownload(modelId: ModelId): Promise<void> {
  const resumable = activeDownloads.get(modelId);
  if (resumable) {
    await resumable.cancelAsync().catch(() => {});
    activeDownloads.delete(modelId);
  }
  const tempDestination = `${getModelPath(modelId)}.download`;
  await FileSystem.deleteAsync(tempDestination, { idempotent: true });
}

async function deleteModel(modelId: ModelId): Promise<void> {
  const path = getModelPath(modelId);
  await FileSystem.deleteAsync(path, { idempotent: true });
}

/** Best-effort recommendation based on device RAM. Falls back to 1B when unknown. */
async function recommend(): Promise<ModelId> {
  try {
    const totalMemory = Device.totalMemory; // bytes, may be null (notably on iOS)
    if (!totalMemory) return "llama-3.2-1b";
    const totalGB = totalMemory / 1024 ** 3;
    return totalGB >= MODEL_REGISTRY["llama-3.2-3b"].minRAMGB
      ? "llama-3.2-3b"
      : "llama-3.2-1b";
  } catch {
    return "llama-3.2-1b";
  }
}

export const modelService = {
  MODEL_REGISTRY,
  getModelPath,
  getStatus,
  download,
  cancelDownload,
  deleteModel,
  recommend,
};
