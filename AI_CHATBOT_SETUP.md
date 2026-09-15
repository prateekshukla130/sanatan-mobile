# Divya Vaani (दिव्य वाणी) — Offline AI Chatbot Setup

An on-device spiritual assistant built on Llama 3.2, running fully offline via
[`llama.rn`](https://github.com/mybigday/llama.rn) (a JSI binding of
llama.cpp). No login, no backend, no paid API. The UI never talks to the
model runtime directly — see `services/aiService.ts` for the abstraction —
so the backend can be swapped later without touching any screen.

## 1. What model is used

- **Llama 3.2 1B Instruct** (default, recommended for most phones)
- **Llama 3.2 3B Instruct** (better answers, needs more RAM)

Both are pulled as **GGUF, Q4_K_M-quantized** community builds from Hugging
Face (`unsloth/Llama-3.2-1B-Instruct-GGUF` and
`unsloth/Llama-3.2-3B-Instruct-GGUF`) — ungated, no HF token required. Exact
URLs live in [`services/modelService.ts`](services/modelService.ts) under
`MODEL_REGISTRY`.

## 2–3. Where models come from & how they're installed

Models are **not bundled in git**. The app never auto-downloads hundreds of
MB without you tapping a button. Open the sidebar → **Divya Vaani**, and
you'll land on a model-setup screen showing both models with size, RAM
requirement, and a Download button with live progress. Files land in
`FileSystem.documentDirectory/models/` and persist across app restarts.
Delete from the same screen to free space.

## 4. Does Expo Go work? No — a dev client is required

`llama.rn` is a native module; Expo Go cannot load it. This project already
depends on `react-native-maps`, which has the same requirement, so this
isn't a new constraint — `eas.json` already has a `development` build
profile with `developmentClient: true`.

If the native engine isn't linked into the build you're running, the AI
screen detects this (`aiService.isNativeModuleAvailable()`) and shows a
"AI engine not built into this app yet" message instead of crashing — but
you do need to complete the build below to actually chat.

## 5. Commands to run

```bash
# 1. Install JS dependencies (adds llama.rn, expo-build-properties,
#    expo-file-system, expo-clipboard — already added to package.json/app.json
#    by this change; this pulls them into node_modules for real)
npm install

# 2. Regenerate native Android/iOS projects with llama.rn linked in
npx expo prebuild --clean

# 3a. Run on a connected Android device/emulator
npx expo run:android

# 3b. Or run on iOS (macOS only)
npx expo run:ios

# Alternative: build a shareable dev client via EAS instead of a local build
eas build --profile development --platform android
eas build --profile development --platform ios
```

`npx expo start` alone is **not** enough once `llama.rn` is installed —
Metro will start, but the native module won't exist in whatever client
you scan the QR code into unless that client was built with step 2/3 above.

**Critically: do not scan the QR code into the Expo Go app.** Expo Go is a
fixed, pre-built binary from the App/Play Store — you cannot add native code
to it, ever, for any package. `require("llama.rn")` will still resolve
inside Expo Go (the JS loads fine), but there's no real native module behind
it, so calling `initLlama` fails deep inside with something like
`TypeError: Cannot read property 'install' of null`. Tells: `expo-notifications`
log warnings mentioning "removed from Expo Go" / "not fully supported in
Expo Go" in your Metro output mean you're in Expo Go right now. Once you run
step 3/EAS above, install the resulting build (it appears as its own app
icon, e.g. "Sanatan Dharma" — not "Expo Go"), run
`npx expo start --dev-client`, and open the app from that installed icon.

## 6. Android requirements

- Android with the New Architecture (already enabled project-wide via
  `newArchEnabled: true` in `app.json`)
- ~3 GB RAM free for the 1B model, ~6 GB for the 3B model, on top of what
  Android and the rest of the app need
- Enough free storage for the model file (~0.8 GB for 1B, ~2 GB for 3B)

## 7. iOS requirements

- A physical device or simulator capable of running a custom dev client
  (Xcode + CocoaPods on macOS to build)
- Same RAM/storage guidance as Android
- If the iOS build fails on C++ standard / deployment target errors, check
  `llama.rn`'s own README for the minimum iOS deployment target it expects
  and set it via the `expo-build-properties` plugin block in `app.json`
  (not pre-filled here since it varies by `llama.rn` release and wasn't
  verified against an actual Xcode build in this environment)

## 8. 1B vs 3B

- **1B** is the default. `modelService.recommend()` picks it unless
  `expo-device`'s `Device.totalMemory` reports ≥ 6 GB, in which case 3B is
  suggested.
- 3B gives noticeably better answers but is ~2.5x the download size and
  slower per token on mid-range phones.
- Both can be installed side by side; switch anytime from the settings
  sheet (gear icon in the chat header) — no re-download needed if the other
  model is already on disk.

## 9. How to swap/add a model

Edit `MODEL_REGISTRY` in `services/modelService.ts` — add a new `ModelId`
to `types/ai.ts`, a matching registry entry (url, filename, size, min RAM),
and it shows up in both the setup screen and settings sheet automatically.
No other file needs to change.

## 10. Troubleshooting

**"AI engine not built into this app yet"** — you're running a client that
doesn't have `llama.rn` compiled in. Do step 2/3 above.

**`npm install` fails downloading `llama.rn`'s native artifacts, with a
`tar` error mentioning "Cannot connect to C:" on Windows** — this is a
known Windows issue: Git Bash's GNU `tar` sometimes wins your `PATH` over
Windows' own `tar.exe`, and GNU tar misparses a `C:\...` path as a remote
`host:path` spec. Fix by either:
- Running `npm install` from a plain PowerShell/cmd window instead of Git
  Bash, or
- Making sure `C:\Windows\System32` (which has the real `tar.exe`) comes
  before Git's `usr\bin` in `PATH`.

This is exactly what happened once while these dependencies were being added
— `npm install` for `expo-file-system`, `expo-build-properties`, and
`expo-clipboard` succeeded immediately (pure JS, no download step), but
`llama.rn`'s own postinstall download initially failed in a Git-Bash shell
with this error. Re-running `npm install` from a plain PowerShell window
completed it successfully (confirmed: `node_modules/llama.rn` is ~800 MB,
with real `.so` binaries under `android/src/main/jniLibs` and a populated
`ios/rnllama.xcframework`) — so if you hit this, it's a one-shell-away fix,
not a dead end.

**`EBUSY: resource busy or locked` during `npm install` on Windows** — this
project lives under OneDrive (`OneDrive\Desktop\frontend`), whose sync
client can transiently lock files mid-install, and it also happens if two
installs run concurrently or a Metro/dev-client process still has files
open. Close any running `expo start`/build process and re-run `npm install`;
it's a transient lock, not data loss.

**Metro logs `Error while reading cache, falling back to a full crawl`
after installing `llama.rn`** — harmless. Adding an ~800 MB native package
invalidates Metro's disk cache; it silently rebuilds on that one run and
caches normally after.

**Model download fails or stalls** — the setup screen shows the error and a
Retry button; partial downloads are written to a `.download` temp file and
cleaned up on failure, so retrying won't leave corrupt data behind.

**"model could not be loaded" / corrupted model** — delete and re-download
from the setup screen.

**Out of memory / app killed while generating** — try the 1B model, lower
"Max tokens" in Advanced settings, or close other apps. `n_gpu_layers` is
currently `0` (CPU-only) for broad device compatibility; GPU offload via
OpenCL can be explored later by adjusting `services/aiService.ts`.

## 11. What wasn't verified in this environment

This change was statically verified (`tsc --noEmit`, `expo lint`, structural
review of every state the AI screen can render in) and `npm install` /
`npx expo config` were confirmed to succeed with `llama.rn` genuinely
present in `node_modules` and its config plugin resolving cleanly. What
wasn't done in that environment: an actual `expo prebuild` + native build
(no Android/iOS build toolchain there) and downloading a multi-GB GGUF model
over that sandbox's connection. Please run through steps 4–5 above on your
machine and try a real conversation before considering this done.
