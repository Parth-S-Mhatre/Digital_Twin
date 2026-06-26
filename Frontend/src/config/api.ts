import { Platform } from 'react-native';

/**
 * Backend API configuration.
 *
 * The base URL is resolved in this order:
 *   1. `EXPO_PUBLIC_API_URL` env var (explicit override)
 *   2. Use Railway production URL by default
 */
const DEFAULT_BASE_URL = 'https://digital-twin-backend-production-9b9d.up.railway.app';

const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const envTimeout = process.env.EXPO_PUBLIC_API_TIMEOUT_MS?.trim();

export const API_BASE_URL = envUrl ? envUrl.replace(/\/+$/, '') : DEFAULT_BASE_URL;

console.log('🔗 API Base URL:', API_BASE_URL);

export const API_TIMEOUT_MS = (() => {
  const parsed = envTimeout ? Number.parseInt(envTimeout, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15_000;
})();
