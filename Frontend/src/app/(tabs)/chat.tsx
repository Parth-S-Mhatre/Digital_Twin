import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MedicalBackdrop } from '@/components/MedicalBackdrop';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, spacing, radius } from '@/theme';
import { useAuth } from '@/context/AuthContext';
import { useHealth } from '@/context/HealthContext';
import { profileToPatientInput } from '@/lib/patientMapping';
import { medicalChat } from '@/services/api';
import type { ChatMessage } from '@/types/api';

export default function MedicalChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        "Hello! I'm your medical AI assistant. I can help you understand your health data, answer questions about your risk factors, and provide personalized guidance. How can I assist you today?",
    },
  ]);
  const [textInput, setTextInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const { user } = useAuth();
  const { healthData } = useHealth();

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  const handleSend = useCallback(async () => {
    if (!textInput.trim() || isSending) return;

    const userMessage: ChatMessage = { role: 'user', content: textInput.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setTextInput('');
    setIsSending(true);

    scrollToBottom();

    try {
      const patientInput = healthData?.metrics
        ? profileToPatientInput(healthData.metrics as any)
        : null;

      const response = await medicalChat({
        user_message: userMessage.content,
        conversation_history: newMessages,
        patient_data: patientInput,
      });

      if (response.success) {
        setMessages([
          ...newMessages,
          { role: 'assistant', content: response.response },
        ]);
      } else {
        setMessages([
          ...newMessages,
          {
            role: 'assistant',
            content:
              response.error || "I'm sorry, I couldn't process that. Please try again later.",
          },
        ]);
      }
    } catch (error) {
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content:
            "I'm sorry, I couldn't connect to the server. Please check your connection and try again.",
        },
      ]);
    } finally {
      setIsSending(false);
      scrollToBottom();
    }
  }, [textInput, isSending, messages, healthData, scrollToBottom]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <MedicalBackdrop />
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Medical Assistant</Text>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
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
              <View
                style={[
                  styles.messageBubble,
                  msg.role === 'user' ? styles.userBubble : styles.assistantBubble,
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    msg.role === 'user' ? styles.userText : styles.assistantText,
                  ]}
                >
                  {msg.content}
                </Text>
              </View>
            </View>
          ))}
          {isSending && (
            <View style={[styles.messageRow, styles.assistantRow]}>
              <View style={[styles.messageBubble, styles.assistantBubble]}>
                <ActivityIndicator color={colors.primary} />
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={textInput}
            onChangeText={setTextInput}
            placeholder="Ask me anything about your health..."
            placeholderTextColor={colors.muted}
            multiline
            maxLength={1000}
            editable={!isSending}
            onSubmitEditing={handleSend}
          />
          <PrimaryButton
            title={isSending ? 'Sending...' : 'Send'}
            onPress={handleSend}
            style={styles.sendButton}
            disabled={isSending || !textInput.trim()}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  messageRow: {
    width: '100%',
  },
  userRow: {
    alignItems: 'flex-end',
  },
  assistantRow: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.xl,
  },
  userBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: radius.xs,
  },
  assistantBubble: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: radius.xs,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
  },
  userText: {
    color: colors.white,
  },
  assistantText: {
    color: colors.text,
  },
  inputContainer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 120,
    fontSize: 16,
    color: colors.text,
  },
  sendButton: {
    minWidth: 80,
  },
});
