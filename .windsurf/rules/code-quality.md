---
trigger: always_on
---
# Code Quality Rules

TypeScript and general coding standards for maintainable, readable, and consistent code.

---

## TypeScript Strictness

### Required Compiler Options

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

### Type Safety Rules

- **NEVER** use `any` type—use `unknown` and narrow appropriately
- Define explicit return types for all exported functions
- Use interfaces for object shapes, types for unions/primitives
- Prefer `readonly` for properties that should not be mutated
- Use discriminated unions for state management
- Avoid type assertions (`as`) unless absolutely necessary with justification

### Prohibited Patterns

- `// @ts-ignore` without documented justification
- `// @ts-expect-error` without documented justification
- Implicit `any` from untyped imports
- Non-null assertions (`!`) without validation
- Type assertions to bypass type checking

---

## Linting & Formatting

### ESLint Configuration

Use ESLint with TypeScript support:
- `@typescript-eslint/eslint-plugin`
- `@typescript-eslint/parser`
- `eslint-plugin-react-hooks`
- `eslint-plugin-react-refresh`

### Required Rules

- `no-unused-vars`: error (use `_` prefix for intentionally unused)
- `no-console`: warn (remove before production)
- `eqeqeq`: error (always use `===`)
- `no-var`: error (use `const` or `let`)
- `prefer-const`: error

### Formatting

- Use Prettier for consistent formatting
- 2-space indentation
- Single quotes for strings
- Trailing commas in multiline
- No semicolons (or always semicolons—be consistent)
- 100 character line length maximum

---

## Naming Conventions

### Files & Directories

| Type | Convention | Example |
|------|------------|---------|
| React components | PascalCase | `UserProfile.tsx` |
| Hooks | camelCase with `use` prefix | `useAuth.ts` |
| Utilities | camelCase | `formatDate.ts` |
| Types/Interfaces | PascalCase | `types.ts` |
| Constants | SCREAMING_SNAKE_CASE | `constants.ts` |
| Directories | kebab-case | `user-profile/` |

### Code Elements

| Type | Convention | Example |
|------|------------|---------|
| Variables | camelCase | `userName` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_RETRY_COUNT` |
| Functions | camelCase | `getUserById` |
| React components | PascalCase | `UserProfile` |
| Interfaces | PascalCase with `I` prefix optional | `User` or `IUser` |
| Types | PascalCase | `UserRole` |
| Enums | PascalCase | `UserStatus` |
| Enum values | PascalCase or SCREAMING_SNAKE_CASE | `Active` or `ACTIVE` |

### Database Columns

- Use snake_case for PostgreSQL columns
- Use camelCase in TypeScript after mapping

---

## File & Folder Organization

### Source Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/              # shadcn/ui components
│   ├── auth/            # Auth-specific components
│   └── layout/          # Layout components
├── contexts/            # React contexts
├── hooks/               # Custom hooks
├── lib/                 # Utility libraries
├── pages/               # Route page components
├── types/               # Shared type definitions
├── App.tsx
├── main.tsx
└── index.css
```

### Component Organization

For complex components, use folder structure:

```
components/
└── UserProfile/
    ├── index.ts           # Re-exports
    ├── UserProfile.tsx    # Main component
    ├── UserAvatar.tsx     # Sub-component
    └── types.ts           # Component-specific types
```

### Import Order

1. React and framework imports
2. Third-party libraries
3. Internal aliases (`@/`)
4. Relative imports
5. Type imports (separate with blank line)

---

## Readability Standards

### Function Length

- Functions should do one thing
- Maximum 50 lines per function (guideline, not hard rule)
- Extract complex logic into well-named helper functions

### Complexity

- Maximum cyclomatic complexity: 10
- Avoid deeply nested conditionals (max 3 levels)
- Use early returns to reduce nesting
- Extract complex conditions into named variables or functions

### Comments

- Code should be self-documenting
- Use comments for "why", not "what"
- Document non-obvious business logic
- Keep comments up-to-date with code changes
- Use JSDoc for exported functions and complex types

### Magic Values

- No magic numbers or strings
- Extract to named constants
- Document the meaning of constants

---

## Error Handling

### Required Practices

- Handle all promise rejections
- Use try-catch for async operations
- Provide meaningful error messages
- Log errors with context
- Return user-friendly error responses from APIs

### Error Types

- Create custom error classes for domain errors
- Include error codes for programmatic handling
- Preserve error stack traces

### Prohibited Practices

- Empty catch blocks
- Swallowing errors silently
- Exposing internal errors to users
- Using exceptions for control flow

---

## Async Code

### Required Practices

- Use `async/await` over raw promises
- Handle loading and error states
- Implement proper cleanup in useEffect
- Use AbortController for cancellable requests

### Prohibited Practices

- Unhandled promise rejections
- Mixing async/await with `.then()` chains
- Fire-and-forget async calls without error handling
- Race conditions from unmanaged concurrent requests

---

## React-Specific Rules

### Component Rules

- One component per file (except small helper components)
- Use functional components exclusively
- Destructure props in function signature
- Define prop types with TypeScript interfaces

### Hooks Rules

- Follow Rules of Hooks (enforced by eslint-plugin-react-hooks)
- Custom hooks must start with `use`
- Keep hooks at the top of components
- Memoize expensive computations with `useMemo`
- Memoize callbacks passed to children with `useCallback`

### State Management

- Lift state only as high as necessary
- Use context for truly global state
- Prefer derived state over synchronized state
- Avoid prop drilling beyond 2-3 levels

---

## Code Review Checklist

Before submitting code:

- [ ] TypeScript compiles without errors
- [ ] ESLint passes without warnings
- [ ] No `any` types without justification
- [ ] Error cases are handled
- [ ] Loading states are handled
- [ ] Code is formatted consistently
- [ ] Names are clear and descriptive
- [ ] Complex logic is documented
- [ ] No console.log statements (except intentional logging)
- [ ] No commented-out code

---

*Consistency is more important than personal preference. Follow established patterns.*
