import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAuth } from "../context/AuthContext";
import { colors } from "../theme";
import PrimaryButton from "../components/PrimaryButton";

export default function HomeScreen() {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.name}>{user?.name || user?.email || "Patient"}</Text>
        <Text style={styles.body}>
          Your secure session is active. This starter frontend is ready for the future FastAPI / Spring auth connection.
        </Text>
        <PrimaryButton title="Logout" onPress={logout} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: colors.background,
    justifyContent: "center",
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    color: colors.accent,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  name: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 10,
  },
  body: {
    color: colors.muted,
    lineHeight: 22,
    marginBottom: 18,
  },
});

