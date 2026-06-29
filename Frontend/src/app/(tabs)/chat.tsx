import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useHealth } from '@/context/HealthContext';
import { medicalChatStream } from '@/services/api';
import type { ChatMessage, PatientInput } from '@/types/api';
import { theme } from '@/constants/theme';

const SUGGESTED_QUESTIONS = [
  { icon: 'heart', text: 'How can I improve my blood pressure?' },
  { icon: 'nutrition', text: 'What foods help manage diabetes?' },
  { icon: 'pulse', text: 'Is my cholesterol level normal?' },
  { icon: 'water', text: 'How much water should I drink daily?' },
] as const;

export default function MedicalChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        "Hi! 👋 I'm your AI health assistant.\nHow can I help you today?",
    },
  ]);
  const [textInput, setTextInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const { data } = useHealth();

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isSending) return;

    const userMessage: ChatMessage = { role: 'user', content: text.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setTextInput('');
    setIsSending(true);
    scrollToBottom();

    // Add a placeholder assistant message
    const placeholderMessage: ChatMessage = { role: 'assistant', content: '' };
    let currentMessages = [...newMessages, placeholderMessage];
    setMessages(currentMessages);

    try {
      let patientInput: PatientInput | null = null;
      if (data?.userId) {
        patientInput = null;
      }

      const stream = medicalChatStream({
        user_message: userMessage.content,
        conversation_history: newMessages,
        patient_data: patientInput ?? undefined,
      });

      let accumulatedContent = '';

      for await (const token of stream) {
        accumulatedContent += token;
        // Update the placeholder message with accumulated content
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: 'assistant',
            content: accumulatedContent
          };
          return updated;
        });
        scrollToBottom();
      }
    } catch {
      // Replace placeholder with error message
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: "I'm sorry, I couldn't connect to the server. Please check your connection and try again.",
        };
        return updated;
      });
    } finally {
      setIsSending(false);
      scrollToBottom();
    }
  }, [isSending, messages, data, scrollToBottom]);

  const handleSend = useCallback(() => sendMessage(textInput), [sendMessage, textInput]);

  return (
    <LinearGradient
      colors={[theme.colors.backgroundStart, theme.colors.backgroundEnd]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={styles.aiAvatar}>
              <Ionicons name="medical" size={22} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Medical Chatbot</Text>
              <Text style={styles.headerSub}>Your AI health assistant</Text>
            </View>
            <View style={{ flex: 1 }} />
            <Pressable style={styles.iconBtn}>
              <Ionicons name="time-outline" size={20} color={theme.colors.textSecondary} />
            </Pressable>
          </View>

          {/* ── Messages ── */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.messageList}
            contentContainerStyle={styles.messageListContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={scrollToBottom}
          >
            {messages.map((msg, index) => (
              <View
                key={index}
                style={[
                  styles.messageRow,
                  msg.role === 'user' ? styles.userRow : styles.assistantRow,
                ]}
              >
                {msg.role === 'assistant' && (
                  <View style={styles.botAvatar}>
                    <Ionicons name="medical" size={14} color="#FFFFFF" />
                  </View>
                )}
                <View
                  style={[
                    styles.bubble,
                    msg.role === 'user' ? styles.userBubble : styles.assistantBubble,
                  ]}
                >
                  <Text
                    style={[
                      styles.bubbleText,
                      msg.role === 'user' ? styles.userText : styles.assistantText,
                    ]}
                  >
                    {msg.content}
                  </Text>
                </View>
              </View>
            ))}

            {/* Typing indicator */}
            {isSending && (
              <View style={[styles.messageRow, styles.assistantRow]}>
                <View style={styles.botAvatar}>
                  <Ionicons name="medical" size={14} color="#FFFFFF" />
                </View>
                <View style={[styles.bubble, styles.assistantBubble, styles.typingBubble]}>
                  <View style={styles.typingDots}>
                    <View style={[styles.dot, styles.dot1]} />
                    <View style={[styles.dot, styles.dot2]} />
                    <View style={[styles.dot, styles.dot3]} />
                  </View>
                </View>
              </View>
            )}

            {/* Suggested questions — only show when no user message yet */}
            {messages.length === 1 && (
              <View style={styles.suggestedSection}>
                <Text style={styles.suggestedTitle}>Suggested Questions</Text>
                {SUGGESTED_QUESTIONS.map((q, i) => (
                  <Pressable
                    key={i}
                    style={styles.suggestedRow}
                    onPress={() => sendMessage(q.text)}
                  >
                    <View style={styles.suggestedIcon}>
                      <Ionicons name={q.icon as keyof typeof Ionicons.glyphMap} size={16} color={theme.colors.primary} />
                    </View>
                    <Text style={styles.suggestedText}>{q.text}</Text>
                    <Ionicons name="chevron-forward" size={16} color={theme.colors.textLight} />
                  </Pressable>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Disclaimer */}
          <View style={styles.disclaimer}>
            <Text style={styles.disclaimerText}>
              Disclaimer: This information is for general knowledge only and is not a substitute for professional medical advice.
            </Text>
          </View>

          {/* ── Input ── */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={textInput}
              onChangeText={setTextInput}
              placeholder="Type your message..."
              placeholderTextColor={theme.colors.textLight}
              multiline
              maxLength={1000}
              editable={!isSending}
              onSubmitEditing={handleSend}
            />
            <Pressable
              style={[styles.sendBtn, (!textInput.trim() || isSending) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!textInput.trim() || isSending}
            >
              <Ionicons name="send" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  keyboardAvoid: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  aiAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary },
  headerSub: { fontSize: 11, color: theme.colors.textSecondary },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageList: { flex: 1 },
  messageListContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.sm },
  userRow: { justifyContent: 'flex-end' },
  assistantRow: { justifyContent: 'flex-start' },
  botAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 20,
  },
  userBubble: {
    backgroundColor: theme.colors.primary,
    borderBottomRightRadius: 6,
  },
  assistantBubble: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  typingBubble: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  userText: { color: '#FFFFFF' },
  assistantText: { color: theme.colors.textPrimary },
  typingDots: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.textLight,
  },
  dot1: {},
  dot2: { opacity: 0.7 },
  dot3: { opacity: 0.4 },
  suggestedSection: {
    marginTop: theme.spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  suggestedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  suggestedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  suggestedIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestedText: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.textPrimary,
    fontWeight: '500',
  },
  disclaimer: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  disclaimerText: {
    fontSize: 10,
    color: theme.colors.textLight,
    textAlign: 'center',
    lineHeight: 14,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.xl,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    maxHeight: 100,
    fontSize: 15,
    color: theme.colors.textPrimary,
    minHeight: 44,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.soft,
  },
  sendBtnDisabled: { opacity: 0.4 },
});
