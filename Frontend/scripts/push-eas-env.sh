#!/usr/bin/env bash
# Push local .env Firebase variables to EAS "preview" environment for cloud builds.
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "Missing .env — copy .env.example to .env and fill in your Firebase values first."
  exit 1
fi

echo "Uploading EXPO_PUBLIC_* variables from .env to EAS (preview environment)..."

while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
  key="${line%%=*}"
  value="${line#*=}"
  [[ "$key" != EXPO_PUBLIC_* ]] && continue
  value="${value%\"}"
  value="${value#\"}"
  echo "  → $key"
  eas env:create --environment preview --name "$key" --value "$value" --visibility plaintext --force 2>/dev/null \
    || eas env:update --environment preview --name "$key" --value "$value" --visibility plaintext
done < .env

echo "Done. Run: eas build --profile preview --platform android"
