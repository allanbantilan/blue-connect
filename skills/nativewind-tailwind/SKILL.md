---
name: nativewind-tailwind
description: >
  Style React Native apps using NativeWind (Tailwind CSS for React Native). Use this skill
  whenever the user is styling a React Native or Expo component, mentions NativeWind,
  className props, Tailwind utilities in mobile context, dark mode in RN, or responsive
  mobile layouts. Also trigger for: theme customization, design tokens, custom colors/fonts
  in Tailwind config, or migrating from StyleSheet to NativeWind. Always use this alongside
  the expo-react-native skill for any visual component work.
---

# NativeWind (Tailwind for React Native) Skill

## Version & Setup

Target **NativeWind v4** with Tailwind CSS v3.

### Installation

```bash
npm install nativewind
npm install --save-dev tailwindcss@3
npx tailwindcss init
```

### Configuration Files

**`tailwind.config.js`**
```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#eef2ff',
          500: '#6366f1',
          600: '#4f46e5',
          900: '#1e1b4b',
        },
        surface: {
          DEFAULT: '#ffffff',
          dark: '#0f172a',
        },
      },
      fontFamily: {
        sans:  ['Inter_400Regular'],
        bold:  ['Inter_700Bold'],
        mono:  ['SpaceMono_400Regular'],
      },
    },
  },
  plugins: [],
};
```

**`metro.config.js`**
```js
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
module.exports = withNativeWind(config, { input: './global.css' });
```

**`global.css`** (import in root `_layout.tsx`)
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**`nativewind-env.d.ts`** (add to repo root)
```ts
/// <reference types="nativewind/types" />
```

---

## Core Usage Rules

### Always use `className`, never `style` for Tailwind utilities
```tsx
// ✅ Correct
<View className="flex-1 bg-white px-4 py-6">
  <Text className="text-lg font-bold text-gray-900">Title</Text>
</View>

// ❌ Wrong — defeats NativeWind
<View style={{ flex: 1, backgroundColor: 'white', padding: 16 }}>
```

### Mixing `style` and `className` — only when necessary
```tsx
// OK for dynamic values that can't be expressed as Tailwind utilities
<View
  className="flex-1 rounded-xl overflow-hidden"
  style={{ height: dynamicHeight }}
/>
```

---

## Layout Patterns

### Full-screen container
```tsx
<SafeAreaView className="flex-1 bg-white dark:bg-slate-900">
  <ScrollView className="flex-1" contentContainerClassName="px-4 py-6 gap-4">
    {/* content */}
  </ScrollView>
</SafeAreaView>
```

### Card
```tsx
<View className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700">
  <Text className="text-base font-semibold text-gray-900 dark:text-white">Card Title</Text>
  <Text className="text-sm text-gray-500 dark:text-slate-400 mt-1">Subtitle</Text>
</View>
```

### Row with space-between
```tsx
<View className="flex-row items-center justify-between">
  <Text className="text-base font-medium text-gray-900">Label</Text>
  <Ionicons name="chevron-forward" size={18} className="text-gray-400" />
</View>
```

### Horizontal scroll chips
```tsx
<ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-2">
  {items.map(item => (
    <Pressable key={item.id} className="bg-indigo-100 dark:bg-indigo-900 px-3 py-1.5 rounded-full">
      <Text className="text-indigo-700 dark:text-indigo-200 text-sm font-medium">{item.label}</Text>
    </Pressable>
  ))}
</ScrollView>
```

---

## Component Conventions

### Button
```tsx
type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';

const variants: Record<Variant, string> = {
  primary:     'bg-indigo-600 active:bg-indigo-700',
  secondary:   'bg-gray-100 dark:bg-slate-700 active:bg-gray-200',
  ghost:       'bg-transparent active:bg-gray-100',
  destructive: 'bg-red-600 active:bg-red-700',
};

const textVariants: Record<Variant, string> = {
  primary:     'text-white',
  secondary:   'text-gray-900 dark:text-white',
  ghost:       'text-gray-700 dark:text-slate-300',
  destructive: 'text-white',
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
}: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={cn(
        'h-12 rounded-xl items-center justify-center px-6',
        variants[variant],
        (disabled || loading) && 'opacity-50',
      )}
    >
      {loading
        ? <ActivityIndicator color={variant === 'primary' ? 'white' : '#6366f1'} />
        : <Text className={cn('text-base font-semibold', textVariants[variant])}>{label}</Text>
      }
    </Pressable>
  );
}
```

### TextInput
```tsx
<TextInput
  className="h-12 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600
             rounded-xl px-4 text-base text-gray-900 dark:text-white
             focus:border-indigo-500 focus:ring-0"
  placeholderTextColor="#9ca3af"
  placeholder="Enter value..."
/>
```

---

## Dark Mode

NativeWind v4 uses the `dark:` variant driven by the system color scheme.

```tsx
// In root _layout.tsx — NativeWind picks this up automatically
import { useColorScheme } from 'nativewind';

// To manually toggle:
const { colorScheme, setColorScheme } = useColorScheme();
setColorScheme('dark'); // or 'light' or 'system'
```

Always pair every `bg-*` with `dark:bg-*`, every `text-*` with `dark:text-*`.

---

## `cn()` Utility

Always install and use `clsx` + `tailwind-merge` for conditional classes:

```bash
npm install clsx tailwind-merge
```

```ts
// lib/cn.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## Responsive / Adaptive Layouts

NativeWind v4 supports breakpoints (`sm:`, `md:`, `lg:`) driven by window width:

```tsx
<View className="flex-col md:flex-row gap-4">
  <View className="flex-1">...</View>
  <View className="flex-1">...</View>
</View>
```

Use `useWindowDimensions()` for logic that can't be expressed in Tailwind.

---

## Gotchas

- **`gap-*` on ScrollView**: use `contentContainerClassName` not `className`
- **`overflow-hidden` on Android**: pair with `elevation-0` or it clips shadows unexpectedly
- **Dynamic class names**: never construct classes dynamically (`'text-' + color`) — Tailwind purges them. Use a lookup map instead (see Button example above)
- **`className` on custom components**: the component must forward `className` via `cssInterop` or use a NativeWind-aware wrapper
- **Fonts**: register custom font family names in `tailwind.config.js` under `theme.extend.fontFamily` — they won't work otherwise

