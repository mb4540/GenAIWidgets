# Frontend Components Rules

Standards for React component development using TypeScript, Tailwind CSS, and shadcn/ui.

---

## Overview

These rules ensure consistent, accessible, and maintainable frontend components across all projects.

---

## Core Principles

### 1. Component Composition

- Build small, focused, reusable components
- Favor composition over inheritance
- Single responsibility per component
- Maximum 200 lines per component file (guideline)

### 2. Type Safety

- Define TypeScript interfaces for all props
- Never use `any` type
- Prefer explicit typing at component boundaries
- Export prop types for reusable components

### 3. Accessibility

- Follow WCAG 2.1 AA guidelines
- Use semantic HTML elements
- Support keyboard navigation
- Provide screen reader context
- Test with accessibility tools

### 4. Performance

- Avoid unnecessary re-renders
- Use memoization intentionally
- Be mindful of bundle size
- Lazy load heavy components

### 5. Consistency

- Prefer shadcn/ui components when available
- Use Tailwind utilities consistently
- Follow established patterns
- Avoid ad-hoc styling

---

## Component Structure

### File Organization

```typescript
// 1. Imports (React, libraries, internal)
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// 2. Types
interface UserCardProps {
  user: User;
  onSelect?: (user: User) => void;
  className?: string;
}

// 3. Component
export function UserCard({ user, onSelect, className }: UserCardProps) {
  // 3a. Hooks
  const [isHovered, setIsHovered] = useState(false);

  // 3b. Handlers
  const handleClick = () => {
    onSelect?.(user);
  };

  // 3c. Render
  return (
    <div className={cn('rounded-lg p-4', className)}>
      {/* content */}
    </div>
  );
}
```

### Props Interface Pattern

```typescript
interface ComponentProps {
  // Required props first
  title: string;
  items: Item[];
  
  // Optional props
  description?: string;
  onAction?: () => void;
  
  // Style props last
  className?: string;
  style?: React.CSSProperties;
}
```

---

## shadcn/ui Usage

### When to Use shadcn/ui

- Buttons, inputs, forms
- Dialogs, modals, sheets
- Dropdowns, selects, comboboxes
- Cards, tables, lists
- Navigation components
- Any component shadcn/ui provides

### When to Build Custom

- Highly specialized business components
- Components not in shadcn/ui library
- Performance-critical custom implementations

### Customization Rules

- Extend shadcn/ui components, don't duplicate
- Use variants for style variations
- Keep customizations in component file
- Document deviations from defaults

### Adding shadcn/ui Components

```bash
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add dialog
```

---

## Tailwind CSS Standards

### Class Organization

Order classes consistently:

1. Layout (display, position, flex/grid)
2. Sizing (width, height, padding, margin)
3. Typography (font, text)
4. Visual (background, border, shadow)
5. Interactive (hover, focus, transition)

```tsx
<div className="flex items-center justify-between w-full p-4 text-sm font-medium bg-white border rounded-lg hover:bg-gray-50 transition-colors">
```

### Using cn() Helper

```typescript
import { cn } from '@/lib/utils';

// Conditional classes
<div className={cn(
  'base-classes',
  isActive && 'active-classes',
  variant === 'primary' && 'primary-classes',
  className // Allow override from props
)} />
```

### Responsive Design

- Mobile-first approach
- Use Tailwind breakpoints: `sm:`, `md:`, `lg:`, `xl:`
- Test all breakpoints
- Avoid fixed pixel widths

### Dark Mode

- Use Tailwind dark mode classes: `dark:`
- Test both light and dark themes
- Ensure sufficient contrast

---

## State Management

### Local State

- Use `useState` for component-specific state
- Use `useReducer` for complex state logic
- Keep state as close to usage as possible

### Shared State

- Use React Context for truly global state
- Avoid prop drilling beyond 2-3 levels
- Consider state management libraries for complex apps

### Derived State

- Prefer computed values over synchronized state
- Use `useMemo` for expensive computations
- Avoid redundant state

---

## Event Handling

### Handler Naming

```typescript
// Use handle prefix
const handleClick = () => {};
const handleSubmit = () => {};
const handleInputChange = () => {};
```

### Callback Props

```typescript
// Use on prefix for callback props
interface Props {
  onClick?: () => void;
  onSubmit?: (data: FormData) => void;
  onChange?: (value: string) => void;
}
```

### Event Types

```typescript
const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {};
const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {};
const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {};
```

---

## Accessibility Requirements

### Semantic HTML

- Use `<button>` for clickable actions
- Use `<a>` for navigation
- Use `<nav>`, `<main>`, `<aside>` appropriately
- Use heading hierarchy (`h1` → `h2` → `h3`)

### ARIA Attributes

- Add `aria-label` for icon-only buttons
- Use `aria-describedby` for form hints
- Use `aria-live` for dynamic content
- Use `role` only when semantic HTML insufficient

### Keyboard Navigation

- All interactive elements must be focusable
- Visible focus indicators required
- Support Enter/Space for buttons
- Support Escape to close modals

### Form Accessibility

```tsx
<label htmlFor="email">Email</label>
<input 
  id="email"
  type="email"
  aria-describedby="email-hint"
  aria-invalid={hasError}
/>
<span id="email-hint">We'll never share your email</span>
```

---

## Performance Guidelines

### Memoization

```typescript
// Memoize expensive computations
const sortedItems = useMemo(() => 
  items.sort((a, b) => a.name.localeCompare(b.name)),
  [items]
);

// Memoize callbacks passed to children
const handleClick = useCallback(() => {
  doSomething(id);
}, [id]);

// Memoize components that receive objects/arrays
const MemoizedChild = memo(ChildComponent);
```

### When to Memoize

- Expensive computations
- Callbacks passed to memoized children
- Components receiving non-primitive props
- Components in lists

### When NOT to Memoize

- Simple computations
- Components that always re-render anyway
- Callbacks used only in current component
- Premature optimization

### Code Splitting

```typescript
// Lazy load heavy components
const HeavyChart = lazy(() => import('./HeavyChart'));

// Use Suspense for loading state
<Suspense fallback={<ChartSkeleton />}>
  <HeavyChart data={data} />
</Suspense>
```

---

## Testing Components

### What to Test

- Renders without crashing
- Displays correct content
- Responds to user interactions
- Shows loading/error states
- Accessibility requirements met

### Testing Pattern

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('UserCard', () => {
  it('should display user name', () => {
    render(<UserCard user={mockUser} />);
    expect(screen.getByText(mockUser.name)).toBeInTheDocument();
  });

  it('should call onSelect when clicked', async () => {
    const onSelect = vi.fn();
    render(<UserCard user={mockUser} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith(mockUser);
  });
});
```

---

## Prohibited Practices

### Never Do

- Use `any` type for props
- Duplicate shadcn/ui components
- Ignore accessibility requirements
- Use inline styles without justification
- Create components over 300 lines
- Use `dangerouslySetInnerHTML` without sanitization
- Hardcode colors outside Tailwind config
- Skip TypeScript prop definitions

### Always Do

- Define prop interfaces
- Use shadcn/ui when available
- Test keyboard navigation
- Support className prop for customization
- Handle loading and error states
- Use semantic HTML
- Follow naming conventions

---

## Component Checklist

Before committing a component:

- [ ] Props interface defined
- [ ] No `any` types
- [ ] Uses shadcn/ui where applicable
- [ ] Tailwind classes organized
- [ ] Accessible (keyboard, screen reader)
- [ ] Handles loading state
- [ ] Handles error state
- [ ] Responsive design verified
- [ ] Dark mode works (if applicable)
- [ ] Tests written

---

*Components are the building blocks. Build them well.*
