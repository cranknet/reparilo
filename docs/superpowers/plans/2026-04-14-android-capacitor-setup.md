# Android Capacitor 7 Setup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the Reparilo web app as a production-ready Android application using Capacitor 7.

**Architecture:** Install Capacitor 7 core + CLI + Android platform, create typed config, scaffold the native Android project, configure SDK versions and security hardening (ProGuard, cleartext), add Android back button handling, and update the Axios client for remote API connections.

**Tech Stack:** Capacitor 7, Vite 8, React 19, Android SDK 31–35, ProGuard

---

### Task 1: Install Capacitor 7 Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Capacitor core, CLI, and Android platform**

```bash
pnpm add @capacitor/core && pnpm add -D @capacitor/cli && pnpm add @capacitor/android
```

- [ ] **Step 2: Verify installation**

```bash
pnpm list @capacitor/core @capacitor/cli @capacitor/android
```

Expected: All three packages listed with version 7.x

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add Capacitor 7 dependencies"
```

---

### Task 2: Create capacitor.config.ts

**Files:**
- Create: `capacitor.config.ts`

- [ ] **Step 1: Create the Capacitor configuration file**

```typescript
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.reparilo.app",
  appName: "Reparilo",
  webDir: "dist",
  server: {
    ...(process.env.NODE_ENV === "development" && {
      url: "http://localhost:5173",
      cleartext: true,
    }),
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
    },
  },
};

export default config;
```

- [ ] **Step 2: Verify config is valid**

```bash
npx cap ls
```

Expected: No errors, lists the project configuration

- [ ] **Step 3: Commit**

```bash
git add capacitor.config.ts
git commit -m "feat: add Capacitor 7 config for Android"
```

---

### Task 3: Add Convenience Scripts to package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add cap:sync and cap:copy scripts**

In `package.json`, update the `scripts` section to add these entries alongside the existing `"android"` script:

```json
"android": "cap sync && cap open android",
"cap:sync": "cap sync",
"cap:copy": "cap copy"
```

- [ ] **Step 2: Verify scripts work**

```bash
pnpm cap:copy --help
```

Expected: Capacitor CLI help output (the command exists)

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add Capacitor convenience scripts"
```

---

### Task 4: Build Web Assets and Scaffold Android Project

**Files:**
- Generated: `android/` (gitignored)

- [ ] **Step 1: Build the Vite project**

```bash
pnpm build
```

Expected: Build succeeds, `dist/` directory populated

- [ ] **Step 2: Add Android platform**

```bash
npx cap add android
```

Expected: `android/` directory created with native project files

- [ ] **Step 3: Sync web assets**

```bash
pnpm cap:sync
```

Expected: Web assets copied to `android/app/src/main/assets/public/`

- [ ] **Step 4: Verify Android project structure**

```bash
ls android/app/src/main/
```

Expected: `assets/`, `java/`, `res/`, `AndroidManifest.xml` present

---

### Task 5: Configure Android SDK Versions and ProGuard

**Files:**
- Modify: `android/app/build.gradle`
- Create: `android/app/proguard-rules.pro`

- [ ] **Step 1: Read the generated build.gradle**

```bash
ls android/app/
```

Read `android/app/build.gradle` (or `build.gradle.kts` if Kotlin DSL) to find the default SDK version blocks.

- [ ] **Step 2: Update SDK versions**

Find the `android {}` block and set:

```groovy
android {
    defaultConfig {
        minSdkVersion 31
        targetSdkVersion 35
        compileSdkVersion 35
    }
    buildTypes {
        release {
            minifyEnabled true
            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
        }
    }
}
```

- [ ] **Step 3: Create ProGuard rules**

Create `android/app/proguard-rules.pro`:

```proguard
# Capacitor
-keep class com.getcapacitor.** { *; }
-keep class com.reparilo.app.** { *; }
-keepattributes *Annotation*
-keepattributes JavascriptInterface
-keep class * extends com.getcapacitor.Plugin { *; }

# WebView
-keep class android.webkit.** { *; }
```

- [ ] **Step 4: Verify Gradle sync**

```bash
cd android && ./gradlew tasks --console=plain 2>&1 | head -5
```

Expected: Gradle tasks listed without errors

- [ ] **Step 5: Commit**

```bash
git add android/app/build.gradle android/app/proguard-rules.pro
git commit -m "feat: configure Android SDK 31-35 and ProGuard"
```

---

### Task 6: Configure AndroidManifest.xml for Security and Performance

**Files:**
- Modify: `android/app/src/main/AndroidManifest.xml`

- [ ] **Step 1: Read the generated manifest**

Read `android/app/src/main/AndroidManifest.xml`

- [ ] **Step 2: Add hardware acceleration, largeHeap, and cleartext settings**

Update the `<application>` tag to include:

```xml
<application
    android:hardwareAccelerated="true"
    android:largeHeap="true"
    android:usesCleartextTraffic="false"
    ...existing attributes...>
```

Note: Keep all existing attributes (`android:name`, `android:allowBackup`, `android:icon`, `android:label`, `android:roundIcon`, `android:supportsRtl`, `android:theme`). Only add the three new attributes above.

- [ ] **Step 3: Verify manifest is well-formed**

```bash
cd android && ./gradlew manifest --console=plain 2>&1 | tail -3
```

Expected: No XML parse errors

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/AndroidManifest.xml
git commit -m "feat: add hardware accel, largeHeap, disable cleartext"
```

---

### Task 7: Update Axios Client for Remote API Connection

**Files:**
- Modify: `src/lib/api.ts`
- Modify: `.env.example`

- [ ] **Step 1: Update api.ts to support VITE_API_BASE_URL**

Replace the full contents of `src/lib/api.ts` with:

```typescript
import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL || "";

const api = axios.create({
  baseURL: baseURL + "/api",
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
```

- [ ] **Step 2: Add VITE_API_BASE_URL to .env.example**

Append to `.env.example`:

```
# Base URL for the API server. Leave empty for web (uses Vite proxy).
# Set for Android: e.g. VITE_API_BASE_URL=https://api.reparilo.com
VITE_API_BASE_URL=
```

- [ ] **Step 3: Verify web build still works**

```bash
pnpm build
```

Expected: Build succeeds without errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/api.ts .env.example
git commit -m "feat: add VITE_API_BASE_URL support for Android API connections"
```

---

### Task 8: Add Android Back Button Handler and Platform Detection

**Files:**
- Modify: `src/main.tsx`

- [ ] **Step 1: Install App plugin**

```bash
pnpm add @capacitor/app
```

- [ ] **Step 2: Update src/main.tsx to handle Android back button**

The file currently uses `BrowserRouter`. Update it to import Capacitor platform detection and add back button handling after the app renders:

```tsx
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { BrowserRouter } from "react-router";
import App from "./app";
import i18n from "./i18n";
import "./app.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </I18nextProvider>
    </QueryClientProvider>
  </React.StrictMode>
);

if (Capacitor.isNativePlatform()) {
  App.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back();
    } else {
      App.exitApp();
    }
  });
}
```

- [ ] **Step 3: Verify web build still works**

```bash
pnpm build
```

Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/main.tsx package.json pnpm-lock.yaml
git commit -m "feat: add Android back button handler with platform detection"
```

---

### Task 9: Final Build, Sync, and Verification

**Files:**
- None (verification only)

- [ ] **Step 1: Full build and sync**

```bash
pnpm build && pnpm cap:sync
```

Expected: Build succeeds, sync copies assets to android/

- [ ] **Step 2: Verify Android project compiles**

```bash
cd android && ./gradlew assembleDebug --console=plain
```

Expected: BUILD SUCCESSFUL, APK generated at `android/app/build/outputs/apk/debug/`

- [ ] **Step 3: Verify lint passes**

```bash
pnpm check
```

Expected: No new lint errors (pre-existing errors are acceptable)

- [ ] **Step 4: Verify tests pass**

```bash
pnpm test
```

Expected: All tests pass

- [ ] **Step 5: Commit any remaining fixes**

```bash
git add -A
git commit -m "chore: finalize Android Capacitor 7 setup"
```