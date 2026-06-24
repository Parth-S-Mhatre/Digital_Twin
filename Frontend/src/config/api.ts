import { Platform } from 'react-native';

/**
 * Backend API configuration.
 *
 * The base URL is resolved in this order:
 *   1. `EXPO_PUBLIC_API_URL` env var (explicit override)
 *   2. A sensible per-platform default:
 *        - Android emulator → http://10.0.2.2:8000 (alias to host's localhost)
 *        - iOS simulator / web → http://localhost:8000
 *
 * For a physical device on the same Wi-Fi as the dev machine running FastAPI,
 * set EXPO_PUBLIC_API_URL to the machine's LAN IP (e.g. http://192.168.1.20:8000).
 */
const DEFAULT_BASE_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';

const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const envTimeout = process.env.EXPO_PUBLIC_API_TIMEOUT_MS?.trim();

export const API_BASE_URL = envUrl ? envUrl.replace(/\/+$/, '') : DEFAULT_BASE_URL;

export const API_TIMEOUT_MS = (() => {
  const parsed = envTimeout ? Number.parseInt(envTimeout, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15_000;
})();
