/**
 * app/(tabs)/ai.tsx — Divya Vaani (दिव्य वाणी)
 *
 * Offline spiritual AI chatbot screen. Hidden tab (accessed via the
 * sidebar), mirroring how shop/kundli/settings are wired in _layout.tsx.
 *
 * The screen only ever talks to `aiService` / `modelService` /
 * `chatStorageService` — never to llama.rn directly — so the inference
 * backend can be swapped later without touching this file.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  BottomSheetModal,
  BottomSheetModalProvider,
} from "@gorhom/bottom-sheet";
import * as Clipboard from "expo-clipboard";
import { GradientBackground } from "@/components/GradientBackground";
import { AIChatMessage } from "@/components/ai/AIChatMessage";
import { AIChatInput } from "@/components/ai/AIChatInput";
import { AIEmptyState } from "@/components/ai/AIEmptyState";
import { AIModelSetup } from "@/components/ai/AIModelSetup";
import { AISettingsSheet } from "@/components/ai/AISettingsSheet";
import { useTheme, ThemeColors } from "@/theme";
import { aiService } from "@/services/aiService";
import { modelService, MODEL_REGISTRY } from "@/services/modelService";
import { chatStorageService } from "@/services/chatStorageService";
import {
  AIError,
  ChatMessage,
  Conversation,
  DEFAULT_GENERATION_OPTIONS,
  GenerationOptions,
  ModelDownloadState,
  ModelId,
} from "@/types/ai";

const STREAMING_ID = "__streaming__";

function TypingDots({ colors }: { colors: ThemeColors }) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [anims] = useState(() => [
    new Animated.Value(0.3),
    new Animated.Value(0.3),
    new Animated.Value(0.3),
  ]);

  useEffect(() => {
    const loops = anims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(anim, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.3,
            duration: 350,
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [anims]);

  return (
    <View style={styles.typingRow}>
      <View style={styles.typingBubble}>
        <Text style={styles.typingLabel}>दिव्य वाणी सोच रहा है</Text>
        <View style={styles.dotsRow}>
          {anims.map((anim, i) => (
            <Animated.View key={i} style={[styles.dot, { opacity: anim }]} />
          ))}
        </View>
      </View>
    </View>
  );
}

export default function AIScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const settingsSheetRef = useRef<BottomSheetModal>(null);

  const [nativeAvailable] = useState(() => aiService.isNativeModuleAvailable());
  const [downloadStates, setDownloadStates] = useState<
    Record<ModelId, ModelDownloadState>
  >(() => {
    const initial = {} as Record<ModelId, ModelDownloadState>;
    (Object.keys(MODEL_REGISTRY) as ModelId[]).forEach((id) => {
      initial[id] = { status: "not_downloaded", progress: 0 };
    });
    return initial;
  });
  const [view, setView] = useState<"loading" | "setup" | "chat">("loading");
  const [selectedModelId, setSelectedModelId] =
    useState<ModelId>("llama-3.2-1b");
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [inputText, setInputText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [modelBusy, setModelBusy] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamStartedAt, setStreamStartedAt] = useState(0);
  const [options, setOptions] = useState<GenerationOptions>(
    DEFAULT_GENERATION_OPTIONS,
  );

  const readyModelIds = useMemo(
    () =>
      (Object.keys(downloadStates) as ModelId[]).filter(
        (id) => downloadStates[id].status === "ready",
      ),
    [downloadStates],
  );

  const refreshDownloadStates = useCallback(async () => {
    const entries = await Promise.all(
      (Object.keys(MODEL_REGISTRY) as ModelId[]).map(
        async (id) => [id, await modelService.getStatus(id)] as const,
      ),
    );
    const next = Object.fromEntries(entries) as Record<
      ModelId,
      ModelDownloadState
    >;
    setDownloadStates(next);
    return next;
  }, []);

  // ── Initial load: figure out which model to use and restore last chat ──
  useEffect(() => {
    (async () => {
      const states = await refreshDownloadStates();
      const readyIds = (Object.keys(states) as ModelId[]).filter(
        (id) => states[id].status === "ready",
      );
      const recommended = await modelService.recommend();
      const conversations = await chatStorageService.listConversations();
      const latest = conversations[0] ?? null;

      let modelId: ModelId;
      if (latest && readyIds.includes(latest.modelId)) {
        modelId = latest.modelId;
      } else if (readyIds.includes(recommended)) {
        modelId = recommended;
      } else if (readyIds.length > 0) {
        modelId = readyIds[0];
      } else {
        modelId = recommended;
      }
      setSelectedModelId(modelId);
      setConversation(latest ?? chatStorageService.createConversation(modelId));
      setView(readyIds.length > 0 ? "chat" : "setup");
    })();
  }, [refreshDownloadStates]);

  // Fall back to setup if the active model becomes unavailable, without a
  // corrective effect: the rendered view is derived straight from state.
  const effectiveView: "loading" | "setup" | "chat" =
    view === "loading"
      ? "loading"
      : readyModelIds.length === 0
        ? "setup"
        : view;

  // ── Stop generation if the app is backgrounded ──
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" && isGenerating) {
        aiService.stop();
      }
    });
    return () => sub.remove();
  }, [isGenerating]);

  useEffect(() => {
    if (effectiveView === "chat") {
      requestAnimationFrame(() =>
        listRef.current?.scrollToEnd({ animated: true }),
      );
    }
  }, [conversation, streamingText, effectiveView]);

  const displayMessages: ChatMessage[] = useMemo(() => {
    const base = conversation?.messages ?? [];
    if (!isGenerating) return base;
    return [
      ...base,
      {
        id: STREAMING_ID,
        role: "assistant",
        content: streamingText,
        createdAt: streamStartedAt,
      },
    ];
  }, [conversation, isGenerating, streamingText, streamStartedAt]);

  // ── Model download lifecycle ──
  const handleDownload = useCallback((modelId: ModelId) => {
    setDownloadStates((prev) => ({
      ...prev,
      [modelId]: { status: "downloading", progress: 0 },
    }));
    modelService
      .download(modelId, (progress) => {
        setDownloadStates((prev) => ({
          ...prev,
          [modelId]: { status: "downloading", progress },
        }));
      })
      .then(() => {
        setDownloadStates((prev) => ({
          ...prev,
          [modelId]: { status: "ready", progress: 1 },
        }));
      })
      .catch((err) => {
        setDownloadStates((prev) => ({
          ...prev,
          [modelId]: {
            status: "error",
            progress: 0,
            error:
              err instanceof Error
                ? err.message
                : "Download failed. Check your connection.",
          },
        }));
      });
  }, []);

  const handleCancelDownload = useCallback((modelId: ModelId) => {
    modelService.cancelDownload(modelId);
    setDownloadStates((prev) => ({
      ...prev,
      [modelId]: { status: "not_downloaded", progress: 0 },
    }));
  }, []);

  const handleDeleteModel = useCallback(
    async (modelId: ModelId) => {
      if (modelId === selectedModelId) await aiService.dispose();
      await modelService.deleteModel(modelId);
      setDownloadStates((prev) => ({
        ...prev,
        [modelId]: { status: "not_downloaded", progress: 0 },
      }));
    },
    [selectedModelId],
  );

  const handleUseModel = useCallback((modelId: ModelId) => {
    setSelectedModelId(modelId);
    setView("chat");
  }, []);

  const handleModelChange = useCallback(
    async (modelId: ModelId) => {
      if (modelId === selectedModelId) return;
      if (isGenerating) await aiService.stop();
      await aiService.dispose();
      setSelectedModelId(modelId);
    },
    [selectedModelId, isGenerating],
  );

  // ── Generation ──
  const runGeneration = useCallback(
    async (base: Conversation) => {
      if (!nativeAvailable) {
        Alert.alert(
          "AI engine not available",
          "This build doesn't have the on-device AI engine compiled in. See AI_CHATBOT_SETUP.md to rebuild the dev client.",
        );
        return;
      }
      setIsGenerating(true);
      setStreamingText("");
      setStreamStartedAt(Date.now());
      try {
        setModelBusy(true);
        await aiService.initialize(selectedModelId, options.contextLength);
        setModelBusy(false);

        const responseText = await aiService.generate(
          base.messages,
          options,
          (token) => setStreamingText((prev) => prev + token),
        );

        const assistantMessage = chatStorageService.createMessage(
          "assistant",
          responseText ||
            "माफ़ करें, कोई उत्तर नहीं मिल सका। / Sorry, I couldn't generate a response.",
        );
        const finalConversation = chatStorageService.appendMessage(
          base,
          assistantMessage,
        );
        setConversation(finalConversation);
        await chatStorageService.saveConversation(finalConversation);
      } catch (err) {
        const cancelled = err instanceof AIError && err.code === "cancelled";
        if (!cancelled) {
          const message =
            err instanceof AIError
              ? err.message
              : "The AI could not generate a response. Please try again.";
          Alert.alert("Divya Vaani", message);
        }
      } finally {
        setIsGenerating(false);
        setStreamingText("");
        setModelBusy(false);
      }
    },
    [nativeAvailable, selectedModelId, options],
  );

  const handleSend = useCallback(
    (textOverride?: string) => {
      const text = (textOverride ?? inputText).trim();
      if (!text || isGenerating || !conversation) return;
      setInputText("");
      const userMessage = chatStorageService.createMessage("user", text);
      const withUser = chatStorageService.appendMessage(
        conversation,
        userMessage,
      );
      setConversation(withUser);
      chatStorageService.saveConversation(withUser).catch(() => {});
      runGeneration(withUser);
    },
    [inputText, isGenerating, conversation, runGeneration],
  );

  const handleRetry = useCallback(() => {
    if (!conversation || isGenerating) return;
    const lastUserIdx = conversation.messages
      .map((m, i) => [m, i] as const)
      .reverse()
      .find(([m]) => m.role === "user")?.[1];
    if (lastUserIdx === undefined) return;
    const trimmed: Conversation = {
      ...conversation,
      messages: conversation.messages.slice(0, lastUserIdx + 1),
    };
    setConversation(trimmed);
    chatStorageService.saveConversation(trimmed).catch(() => {});
    runGeneration(trimmed);
  }, [conversation, isGenerating, runGeneration]);

  const handleStop = useCallback(() => {
    aiService.stop();
  }, []);

  const handleNewChat = useCallback(() => {
    if (isGenerating) aiService.stop();
    const fresh = chatStorageService.createConversation(selectedModelId);
    setConversation(fresh);
    chatStorageService.saveConversation(fresh).catch(() => {});
  }, [isGenerating, selectedModelId]);

  const handleClearChat = useCallback(() => {
    if (!conversation) return;
    Alert.alert(
      "Clear chat?",
      "This removes every message in this conversation.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            const cleared: Conversation = {
              ...conversation,
              messages: [],
              title: "New Chat",
              updatedAt: Date.now(),
            };
            setConversation(cleared);
            chatStorageService.saveConversation(cleared).catch(() => {});
            settingsSheetRef.current?.dismiss();
          },
        },
      ],
    );
  }, [conversation]);

  const handleManageModels = useCallback(() => {
    settingsSheetRef.current?.dismiss();
    setView("setup");
  }, []);

  const handleCopy = useCallback((text: string) => {
    Clipboard.setStringAsync(text).catch(() => {});
  }, []);

  const status = useMemo(() => {
    if (!nativeAvailable) return { text: "Setup needed", color: colors.error };
    if (modelBusy)
      return { text: "मॉडल लोड हो रहा है…", color: colors.warning };
    if (isGenerating) return { text: "सोच रहा है…", color: colors.gold };
    if (readyModelIds.length === 0)
      return { text: "Model needed", color: colors.textMuted };
    return { text: "Offline AI", color: colors.success };
  }, [nativeAvailable, modelBusy, isGenerating, readyModelIds, colors]);

  if (view === "loading") {
    return (
      <GradientBackground style={styles.flex}>
        <View style={styles.centerLoading}>
          <ActivityIndicator color={colors.gold} />
        </View>
      </GradientBackground>
    );
  }

  return (
    <BottomSheetModalProvider>
      <GradientBackground style={styles.flex}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>दिव्य वाणी</Text>
            <View style={styles.statusRow}>
              <View
                style={[styles.statusDot, { backgroundColor: status.color }]}
              />
              <Text style={styles.statusText}>{status.text}</Text>
            </View>
          </View>
          <Pressable style={styles.iconBtn} onPress={handleNewChat} hitSlop={8}>
            <Ionicons
              name="add-circle-outline"
              size={22}
              color={colors.textPrimary}
            />
          </Pressable>
          <Pressable
            style={styles.iconBtn}
            onPress={() => settingsSheetRef.current?.present()}
            hitSlop={8}
          >
            <Ionicons
              name="options-outline"
              size={20}
              color={colors.textPrimary}
            />
          </Pressable>
        </View>

        {!nativeAvailable ? (
          <View style={styles.blockedWrap}>
            <Ionicons name="construct-outline" size={32} color={colors.gold} />
            <Text style={styles.blockedTitle}>
              AI engine not built into this app yet
            </Text>
            <Text style={styles.blockedBody}>
              Divya Vaani needs a custom dev client with the on-device AI engine
              linked in. Install the AI dependencies, run a fresh prebuild, and
              rebuild the dev client — see AI_CHATBOT_SETUP.md for exact
              commands.
            </Text>
          </View>
        ) : effectiveView === "setup" ? (
          <AIModelSetup
            downloadStates={downloadStates}
            onDownload={handleDownload}
            onCancelDownload={handleCancelDownload}
            onDelete={handleDeleteModel}
            onUseModel={handleUseModel}
          />
        ) : (
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
          >
            {displayMessages.length === 0 ? (
              <AIEmptyState onSuggestionPress={(text) => handleSend(text)} />
            ) : (
              <FlatList
                ref={listRef}
                data={displayMessages}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) =>
                  item.id === STREAMING_ID && item.content === "" ? (
                    <TypingDots colors={colors} />
                  ) : (
                    <AIChatMessage message={item} onCopy={handleCopy} />
                  )
                }
                contentContainerStyle={styles.listContent}
                removeClippedSubviews
                initialNumToRender={16}
                maxToRenderPerBatch={16}
              />
            )}

            {!isGenerating &&
              conversation &&
              conversation.messages.length > 0 && (
                <Pressable style={styles.retryBtn} onPress={handleRetry}>
                  <Ionicons name="refresh" size={13} color={colors.textMuted} />
                  <Text style={styles.retryText}>Retry last response</Text>
                </Pressable>
              )}

            <AIChatInput
              value={inputText}
              onChangeText={setInputText}
              onSend={() => handleSend()}
              onStop={handleStop}
              isGenerating={isGenerating}
              disabled={readyModelIds.length === 0}
            />
          </KeyboardAvoidingView>
        )}

        <AISettingsSheet
          ref={settingsSheetRef}
          currentModelId={selectedModelId}
          readyModelIds={readyModelIds}
          options={options}
          onModelChange={handleModelChange}
          onOptionsChange={setOptions}
          onManageModels={handleManageModels}
          onClearChat={handleClearChat}
        />
      </GradientBackground>
    </BottomSheetModalProvider>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    centerLoading: { flex: 1, alignItems: "center", justifyContent: "center" },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    headerTitle: { fontSize: 17, fontWeight: "700", color: colors.gold },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 2,
    },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 11, color: colors.textMuted },
    iconBtn: { padding: 6, marginLeft: 4 },
    listContent: { paddingVertical: 12 },
    retryBtn: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "center",
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    retryText: { fontSize: 11.5, color: colors.textMuted },
    blockedWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 28,
      gap: 10,
    },
    blockedTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.textPrimary,
      textAlign: "center",
    },
    blockedBody: {
      fontSize: 12.5,
      color: colors.textMuted,
      textAlign: "center",
      lineHeight: 19,
    },
    typingRow: {
      paddingHorizontal: 12,
      marginVertical: 4,
      alignItems: "flex-start",
    },
    typingBubble: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.cardBg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 16,
      borderBottomLeftRadius: 4,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    typingLabel: { fontSize: 12, color: colors.textMuted },
    dotsRow: { flexDirection: "row", gap: 3 },
    dot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: colors.gold,
    },
  });
}
