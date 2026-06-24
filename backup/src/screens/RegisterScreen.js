import React, { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { useAuth } from "../context/AuthContext";
import { colors } from "../theme";
import InputField from "../components/InputField";
import PrimaryButton from "../components/PrimaryButton";

export default function RegisterScreen({ onSwitch }) {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    try {
      setLoading(true);
      await register({ name, email, password });
    } catch (error) {
      Alert.alert("Registration failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Register</Text>
      <InputField label="Name" value={name} onChangeText={setName} placeholder="Your full name" />
      <InputField label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
      <InputField label="Password" value={password} onChangeText={setPassword} placeholder="Create a password" secureTextEntry />
      <PrimaryButton title={loading ? "Creating account..." : "Create Account"} onPress={handleRegister} />
      <PrimaryButton title="Back to login" onPress={onSwitch} variant="secondary" />
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

