# MyHealthtwin Mobile Frontend

React Native app built with Expo for the Digital Twin project.

## Current scope

- blue and white medical-themed UI
- animated auth landing screen
- login and register pages
- Firebase authentication scaffold
- Firestore-backed patient profile storage
- lightweight home screen after sign-in

## Stack

- Expo Router
- React Native
- Firebase Authentication
- Firestore for user profile persistence
- `@react-native-async-storage/async-storage` for local fallback caching

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create your local environment file:

```bash
cp .env.example .env
```

3. Fill in the Firebase values from your Firebase project settings.

4. Run the app:

```bash
npx expo start
```

## Firebase config

The app reads these environment variables:

- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`

If Firebase is not configured yet, the app can still fall back to the local demo session so you can keep working on the UI.

## Firestore data model

The frontend currently stores data in Firestore using this structure:

- `users/{uid}`
  - basic auth metadata such as name, email, provider, and timestamps
- `users/{uid}/profile/current`
  - the current patient intake form

The app also keeps a local AsyncStorage cache so the form still works if Firestore is temporarily unavailable.

## Design direction

- bright medical blue palette
- soft white cards
- subtle floating animation
- patient-friendly onboarding language
- clean screens that can scale into a dashboard later
