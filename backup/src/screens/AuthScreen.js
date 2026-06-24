import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import LoginScreen from "./LoginScreen";
import RegisterScreen from "./RegisterScreen";
import { colors } from "../theme";

export default function AuthScreen() {
  const [mode, setMode] = useState("login");

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>Digital Twin for Preventive Healthcare</Text>
        <Text style={styles.title}>Health companion login</Text>
        <Text style={styles.subtitle}>
          A calm, nature-inspired patient experience for secure sign-in and registration.
        </Text>
      </View>

      {mode === "login" ? (
        <LoginScreen onSwitch={() => setMode("register")} />
      ) : (
        <RegisterScreen onSwitch={() => setMode("login")} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: colors.background,
  },
  hero: {
    paddingTop: 20,
    paddingBottom: 18,
  },
  kicker: {
    color: colors.accent,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 10,
  },
  subtitle: {
    color: colors.muted,
    lineHeight: 22,
  },
});

