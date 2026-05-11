---
name: react-typescript
description: >
  Write production-quality React components and hooks in TypeScript. Use this skill whenever
  the user is building React UI (web), writing or typing components, custom hooks, context,
  forms, or data-fetching logic in TypeScript. Trigger for: component prop typing, generic
  hooks, event handler types, React.FC patterns, context/provider typing, type-safe forms,
  and enforcing strict TypeScript conventions in React codebases. Also trigger when the user
  asks to refactor JS React code to TypeScript, or when debugging type errors in React.
  For React Native / Expo, use expo-react-native skill instead.
---

# React TypeScript Skill

## Conventions at a Glance

- **No `React.FC`** — use plain function signatures with explicit return type when needed
- **Props interfaces** — always `interface`, not `type` (unless union/intersection is needed)
- **Exports** — named exports for components; default export only for pages/routes
- **Hooks** — prefix with `use`, return typed objects (not arrays) for >2 values
- **Events** — use React's event types (`React.ChangeEvent<HTMLInputElement>`)
- **No `any`** — use `unknown`, generics, or proper unions instead
- **Strict mode** — `"strict": true` in `tsconfig.json` always

---

## Component Patterns

### Standard Component
```tsx
interface UserCardProps {
  user: User;
  onSelect?: (id: string) => void;
  className?: string;
}

export function UserCard({ user, onSelect, className }: UserCardProps) {
  return (
    <div className={cn('rounded-xl border p-4', className)}>
      <p className="font-semibold text-gray-900">{user.name}</p>
      {onSelect && (
        <button onClick={() => onSelect(user.id)} className="mt-2 text-sm text-indigo-600">
          Select
        </button>
      )}
    </div>
  );
}
```

### Component with children
```tsx
interface CardProps {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function Card({ title, children, actions }: CardProps) {
  return (
    <div className="rounded-2xl border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        {actions}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}
```

### Polymorphic component (as prop)
```tsx
type TextProps<T extends React.ElementType = 'p'> = {
  as?: T;
  children: React.ReactNode;
} & React.ComponentPropsWithoutRef<T>;

export function Text<T extends React.ElementType = 'p'>({
  as,
  children,
  ...props
}: TextProps<T>) {
  const Component = as ?? 'p';
  return <Component {...props}>{children}</Component>;
}

// Usage: <Text as="h1" className="text-2xl">Title</Text>
```

### forwardRef
```tsx
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input
        ref={ref}
        className={cn(
          'h-10 rounded-lg border px-3 text-sm',
          error ? 'border-red-500' : 'border-gray-300',
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  ),
);
Input.displayName = 'Input';
```

---

## Hook Patterns

### Data fetching hook (React Query)
```tsx
interface UseUsersOptions {
  enabled?: boolean;
}

export function useUsers({ enabled = true }: UseUsersOptions = {}) {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<User[]>('/users'),
    enabled,
  });
}
// Returns { data, isLoading, error, refetch } — fully typed
```

### Generic fetch hook
```tsx
function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then(r => r.json())
      .then((d: T) => { if (!cancelled) setData(d); })
      .catch((e: Error) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [url]);

  return { data, loading, error };
}
```

### Local state hook (expose object, not tuple)
```tsx
export function useCounter(initial = 0) {
  const [count, setCount] = useState(initial);
  const increment = useCallback(() => setCount(c => c + 1), []);
  const decrement = useCallback(() => setCount(c => c - 1), []);
  const reset = useCallback(() => setCount(initial), [initial]);
  return { count, increment, decrement, reset };
}
```

---

## Context Pattern

```tsx
// contexts/AuthContext.tsx
interface AuthContextValue {
  user: User | null;
  signIn: (credentials: Credentials) => Promise<void>;
  signOut: () => void;
  isLoading: boolean;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ... implementation

  return (
    <AuthContext.Provider value={{ user, signIn, signOut, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

// Always throw if used outside provider
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

---

## Type Patterns

### Discriminated unions for state
```tsx
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };
```

### Extract prop types from a component
```tsx
type ButtonProps = React.ComponentProps<typeof Button>;
type InputOnChange = React.ComponentProps<'input'>['onChange'];
```

### Utility types in props
```tsx
interface EditUserProps extends Partial<Pick<User, 'name' | 'email' | 'avatar'>> {
  userId: string;
  onSave: (updates: Partial<User>) => Promise<void>;
}
```

### Event handlers
```tsx
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => { /* ... */ };
const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  /* ... */
};
const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => { /* ... */ };
```

---

## Form Handling (React Hook Form + Zod)

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormValues) => {
    await signIn(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
      <Input label="Password" type="password" error={errors.password?.message} {...register('password')} />
      <Button type="submit" loading={isSubmitting}>Sign In</Button>
    </form>
  );
}
```

---

## File & Folder Conventions

```
src/
  components/
    ui/          # Primitive, reusable: Button, Input, Card, Badge
    features/    # Feature-scoped: UserCard, ProductGrid
  hooks/         # useAuth, useDebounce, useLocalStorage
  contexts/      # AuthContext, ThemeContext
  lib/           # api.ts, cn.ts, constants.ts, validators.ts
  types/         # index.ts (shared domain types: User, Product, etc.)
  pages/ or app/ # Route-level components only — thin, delegate to features
```

---

## Strict TypeScript Config

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "paths": { "@/*": ["./src/*"] }
  }
}
```

---

## What to Avoid

- `React.FC` — it adds implicit `children` and obscures return type
- `any` — use `unknown` + type guard, or a proper generic
- Non-null assertions (`!`) without a comment explaining why it's safe
- Inline object/function props that cause re-renders: extract to `useMemo`/`useCallback`
- `useEffect` for derived state — compute inline or with `useMemo`
- Default exports for non-page components — hurts tree-shaking and discoverability

