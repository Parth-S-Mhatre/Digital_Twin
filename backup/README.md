# Digital Twin React Native Frontend

This folder contains the first React Native frontend for the digital twin project.

## What is included now

- Login screen
- Register screen
- Local auth flow
- Secure session storage
- Minimal home screen after sign-in

## Recommended frontend stack

Use:

- **React Native with Expo**
- **Expo SecureStore** for session storage
- **FastAPI JWT** later for the real auth backend

## Why this is the best fit for now

For this project, I recommend **not using Firebase for the first version**.

Firebase Auth is stable and feature-rich, but it introduces another external auth platform, extra configuration, and extra moving parts. Since the backend already exists and Spring Boot auth is planned later, the cleanest option is:

- Expo-managed React Native frontend
- Backend JWT authentication
- Secure token storage on device

Expo's official documentation recommends using a React Native framework like Expo for new apps, and its authentication guide describes storing sessions securely with JWTs on native platforms and using secure storage for auth results.

## Setup idea

If you have not created the app scaffold yet, use:

```bash
npx create-expo-app@latest
cd <your-app-folder>
npx expo install expo-secure-store
```

Then copy the files from this folder into the generated app.

If you later wire the frontend to FastAPI or Spring Boot, flip `USE_API_AUTH` to `true` in [`src/constants.js`](/home/parth-sanjay-mhatre/Desktop/Digital_twin/Frontend/src/constants.js).

## Next step

After the login/register flow, connect the frontend to the real FastAPI auth endpoints, then later add Spring Boot for JWT, roles, and cache.
