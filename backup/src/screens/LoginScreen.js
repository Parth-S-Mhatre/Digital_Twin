import React, { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { useAuth } from "../context/AuthContext";
import { colors } from "../theme";
import InputField from "../components/InputField";
import PrimaryButton from "../components/PrimaryButton";

export default function LoginScreen({ onSwitch }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    try {
      setLoading(true);
      await login({ email, password });
    } catch (error) {
      Alert.alert("Login failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Login</Text>
      <InputField label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
      <InputField label="Password" value={password} onChangeText={setPassword} placeholder="Enter your password" secureTextEntry />
      <PrimaryButton title={loading ? "Signing in..." : "Sign In"} onPress={handleLogin} />
      <PrimaryButton title="Create new account" onPress={onSwitch} variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
  },
  heading: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 16,
  },
});

