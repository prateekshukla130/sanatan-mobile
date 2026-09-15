// Divya Vaani — local-only conversation storage (no login, no remote DB).
// Follows the same AsyncStorage key-prefix convention as services/storageService.ts.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { ChatMessage, ChatRole, Conversation, ModelId } from "@/types/ai";

const KEYS = {
  INDEX: "@sanatan_ai_conversations",
  CONVERSATION_PREFIX: "@sanatan_ai_conversation_",
};

const MAX_CONVERSATIONS = 20;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function deriveTitle(messages: ChatMessage[]): string {
  const firstUserMessage = messages.find((m) => m.role === "user");
  if (!firstUserMessage) return "New Chat";
  const text = firstUserMessage.content.trim();
  return text.length > 40 ? `${text.slice(0, 40)}…` : text;
}

async function getIndex(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(KEYS.INDEX);
  return raw ? JSON.parse(raw) : [];
}

async function saveIndex(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.INDEX, JSON.stringify(ids));
}

async function getConversation(id: string): Promise<Conversation | null> {
  const raw = await AsyncStorage.getItem(KEYS.CONVERSATION_PREFIX + id);
  return raw ? JSON.parse(raw) : null;
}

async function listConversations(): Promise<Conversation[]> {
  const ids = await getIndex();
  const conversations = await Promise.all(ids.map((id) => getConversation(id)));
  return conversations.filter((c): c is Conversation => c !== null);
}

async function saveConversation(conversation: Conversation): Promise<void> {
  await AsyncStorage.setItem(
    KEYS.CONVERSATION_PREFIX + conversation.id,
    JSON.stringify(conversation),
  );

  let ids = (await getIndex()).filter((id) => id !== conversation.id);
  ids.unshift(conversation.id);

  if (ids.length > MAX_CONVERSATIONS) {
    const overflow = ids.slice(MAX_CONVERSATIONS);
    await Promise.all(
      overflow.map((id) => AsyncStorage.removeItem(KEYS.CONVERSATION_PREFIX + id)),
    );
    ids = ids.slice(0, MAX_CONVERSATIONS);
  }

  await saveIndex(ids);
}

async function deleteConversation(id: string): Promise<void> {
  await AsyncStorage.removeItem(KEYS.CONVERSATION_PREFIX + id);
  const ids = (await getIndex()).filter((existingId) => existingId !== id);
  await saveIndex(ids);
}

async function clearAll(): Promise<void> {
  const ids = await getIndex();
  await Promise.all(ids.map((id) => AsyncStorage.removeItem(KEYS.CONVERSATION_PREFIX + id)));
  await saveIndex([]);
}

function createConversation(modelId: ModelId): Conversation {
  const now = Date.now();
  return {
    id: generateId(),
    title: "New Chat",
    messages: [],
    modelId,
    createdAt: now,
    updatedAt: now,
  };
}

function createMessage(role: ChatRole, content: string): ChatMessage {
  return { id: generateId(), role, content, createdAt: Date.now() };
}

/** Returns an updated copy of the conversation with the message appended and title/timestamp refreshed. */
function appendMessage(conversation: Conversation, message: ChatMessage): Conversation {
  const messages = [...conversation.messages, message];
  return {
    ...conversation,
    messages,
    title: conversation.title === "New Chat" ? deriveTitle(messages) : conversation.title,
    updatedAt: Date.now(),
  };
}

export const chatStorageService = {
  listConversations,
  getConversation,
  saveConversation,
  deleteConversation,
  clearAll,
  createConversation,
  createMessage,
  appendMessage,
};
