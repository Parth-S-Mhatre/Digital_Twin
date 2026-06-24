import * as SecureStore from "expo-secure-store";

import { API_BASE_URL, USE_API_AUTH } from "../constants";

const SESSION_KEY = "dt_session";
const USERS_KEY = "dt_users";

async function loadUsers() {
  const raw = await SecureStore.getItemAsync(USERS_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function saveUsers(users) {
  await SecureStore.setItemAsync(USERS_KEY, JSON.stringify(users));
}

async function saveSession(session) {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function getStoredSession() {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function logout() {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

export async function register({ name, email, password }) {
  if (USE_API_AUTH) {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Registration failed");
    }
    const data = await response.json();
    await saveSession(data);
    return data;
  }

  const users = await loadUsers();
  const exists = users.find((user) => user.email.toLowerCase() === email.toLowerCase());
  if (exists) {
    throw new Error("This email is already registered.");
  }

  const session = {
    access_token: `local_${Date.now()}`,
    token_type: "local",
    user: { name, email },
  };

  users.push({ name, email, password });
  await saveUsers(users);
  await saveSession(session);
  return session;
}

export async function login({ email, password }) {
  if (USE_API_AUTH) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Login failed");
    }
    const data = await response.json();
    await saveSession(data);
    return data;
  }

  const users = await loadUsers();
  const user = users.find(
    (item) => item.email.toLowerCase() === email.toLowerCase() && item.password === password
  );

  if (!user) {
    throw new Error("Invalid email or password.");
  }

  const session = {
    access_token: `local_${Date.now()}`,
    token_type: "local",
    user: { name: user.name, email: user.email },
  };

  await saveSession(session);
  return session;
}

