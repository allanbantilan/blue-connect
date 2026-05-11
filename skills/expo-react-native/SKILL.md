---
name: expo-react-native
description: >
  Scaffold, build, and enforce conventions for React Native apps using Expo. Use this skill
  whenever the user mentions Expo, React Native, mobile screens, navigation, native modules,
  app.json, expo-router, EAS Build, or any mobile app development task — even if they don't
  say "Expo" explicitly. Trigger for: new RN project setup, screen/component creation,
  navigation wiring, native permissions, device APIs, push notifications, and OTA updates.
---

# Expo React Native Skill

## Stack Conventions

- **Expo SDK**: Always target latest stable (SDK 51+)
- **Router**: `expo-router` (file-based routing) — NOT React Navigation directly
- **Entry**: `app/` directory with `_layout.tsx` as root
- **TypeScript**: Always `.tsx` / `.ts` — no `.js` files
- **Styling**: NativeWind v4 (see nativewind-tailwind skill for styling rules)
- **State**: Zustand for global state; React Query (`@tanstack/react-query`) for server state
- **Icons**: `@expo/vector-icons` (Ionicons preferred)
- **Images**: `expo-image` (not RN's built-in `Image`)
- **Storage**: `expo-secure-store` for sensitive data, `@react-native-async-storage/async-storage` for general
- **Env vars**: `expo-constants` + `.env` with `EXPO_PUBLIC_` prefix

---

## Project Structure

```
app/
  _layout.tsx          # Root layout (fonts, providers, global error boundary)
  (tabs)/
    _layout.tsx        # Tab navigator
    index.tsx          # Home tab
    profile.tsx
  (auth)/
    _layout.tsx        # Auth stack
    login.tsx
    register.tsx
  modal.tsx            # Presented as modal
components/
  ui/                  # Dumb, reusable primitives
  features/            # Feature-specific components
hooks/                 # Custom hooks (useAuth, useTheme, etc.)
store/                 # Zustand stores
lib/                   # API clients, utils, constants
assets/
  fonts/
  images/
```

---

## Scaffolding Rules

### New Screen
```tsx
// app/(tabs)/example.tsx
import { View, Text, ScrollView } from 'react-native';
import { Stack } from 'expo-router';

export default function ExampleScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Example' }} />
      <ScrollView className="flex-1 bg-white">
        <View className="p-4">
          <Text className="text-xl font-bold text-gray-900">Hello</Text>
        </View>
      </ScrollView>
    </>
  );
}
```

### Root Layout
```tsx
// app/_layout.tsx
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import '../global.css'; // NativeWind

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({ /* fonts */ });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return <Stack screenOptions={{ headerShown: false }} />;
}
```

### Tab Navigator
```tsx
// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#6366f1' }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

---

## Key Conventions

### Navigation
- Use `expo-router` `Link`, `useRouter`, `useLocalSearchParams` — never `navigation.navigate()`
- Pass params via typed routes: `router.push({ pathname: '/user/[id]', params: { id: '1' } })`
- Always define `href` types for typed routes in `app/types/routes.d.ts`

### Permissions
```tsx
import * as Location from 'expo-location';

const { status } = await Location.requestForegroundPermissionsAsync();
if (status !== 'granted') {
  // handle denial gracefully — never assume granted
}
```

### Fonts
- Load via `expo-font` + `useFonts` in root `_layout.tsx`
- Gate render behind `loaded` — always prevent flash of unstyled text

### Safe Area
```tsx
import { SafeAreaView } from 'react-native-safe-area-context';
// Use SafeAreaView as the outermost container, not RN's built-in
```

### Platform-specific code
```tsx
import { Platform } from 'react-native';
// Prefer Platform.select() or .ios.tsx / .android.tsx file suffixes
const shadow = Platform.select({ ios: 'shadow-md', android: 'elevation-4' });
```

---

## app.json / app.config.ts Conventions

```ts
// app.config.ts (preferred over app.json for dynamic config)
export default {
  expo: {
    name: 'MyApp',
    slug: 'my-app',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'myapp',            // deep link scheme
    userInterfaceStyle: 'automatic',
    splash: { /* ... */ },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.org.myapp',
    },
    android: {
      adaptiveIcon: { /* ... */ },
      package: 'com.org.myapp',
    },
    plugins: [
      'expo-router',
      'expo-secure-store',
      // add native plugins here
    ],
    extra: {
      eas: { projectId: '<your-project-id>' },
    },
  },
};
```

---

## EAS Build

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure
eas build:configure

# Development build (needed for custom native modules)
eas build --profile development --platform ios

# Production
eas build --profile production --platform all
```

`eas.json` profiles: `development` (dev client), `preview` (internal distribution), `production`.

---

## Common Gotchas to Avoid

- **Never** use `StyleSheet.create` when NativeWind is in use — use `className` only
- **Never** import from `react-navigation` directly — always go through `expo-router`
- **Always** wrap app in `SafeAreaProvider` (in root layout)
- **Always** handle Android back button for modals
- **Avoid** `useEffect` for navigation side effects — use `router.replace()` in event handlers
- Metro bundler doesn't HMR native code — remind user to rebuild after adding native plugins

---

## Dependencies Reference

```bash
npx create-expo-app@latest MyApp --template blank-typescript

# Core
npx expo install expo-router expo-constants expo-font expo-image
npx expo install expo-secure-store @react-native-async-storage/async-storage
npx expo install react-native-safe-area-context react-native-screens

# State / data
npm install zustand @tanstack/react-query

# UI
npm install nativewind
npm install --save-dev tailwindcss
```

