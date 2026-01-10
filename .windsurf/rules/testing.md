# Testing Rules

Standards for testing React applications with Netlify Functions backend.

---

## Testing Philosophy

- Tests are documentation of expected behavior
- Tests enable confident refactoring
- Tests catch regressions before users do
- Untested code is assumed broken

---

## Test Categories

### Unit Tests

**Scope**: Individual functions, hooks, utilities

**Responsibilities**:
- Pure function logic
- Custom hook behavior
- Utility function correctness
- Type transformations
- Validation logic

**Characteristics**:
- Fast execution (< 100ms each)
- No external dependencies
- Deterministic results
- Isolated from other units

### Integration Tests

**Scope**: Component interactions, API endpoints

**Responsibilities**:
- Component rendering with props
- User interaction flows
- API request/response cycles
- Database operations
- Context provider behavior

**Characteristics**:
- May use test databases
- May mock external services
- Test realistic scenarios
- Verify component composition

### End-to-End Tests

**Scope**: Full user workflows

**Responsibilities**:
- Critical user journeys
- Authentication flows
- Multi-page workflows
- Production-like environment testing

**Characteristics**:
- Run against deployed preview
- Use real browser automation
- Slower execution
- High confidence

---

## Frontend Testing

### Component Testing

**Required Coverage**:
- Renders without crashing
- Displays correct content for given props
- Handles user interactions
- Shows appropriate loading states
- Displays error states correctly
- Accessibility requirements met

**Tools**:
- Vitest for test runner
- React Testing Library for component tests
- @testing-library/user-event for interactions

**Approach**:
- Test behavior, not implementation
- Query by accessible roles and labels
- Avoid testing internal state directly
- Test what users see and do

### Hook Testing

**Required Coverage**:
- Initial state
- State changes from actions
- Side effect cleanup
- Error handling

**Tools**:
- @testing-library/react for renderHook

---

## Backend Testing (Netlify Functions)

### Function Testing

**Required Coverage**:
- Successful request handling
- Input validation errors
- Authentication/authorization failures
- Database error handling
- Edge cases

**Approach**:
- Test handler functions directly
- Mock database connections
- Verify response structure
- Check status codes

### Database Testing

**Required Coverage**:
- Query correctness
- Constraint enforcement
- Transaction behavior
- Migration success

**Approach**:
- Use test database (Neon branch)
- Reset state between tests
- Test with realistic data volumes

---

## Mocking Rules

### When to Mock

- External API calls
- Database connections in unit tests
- Time-dependent operations
- Random number generation
- File system operations

### When NOT to Mock

- The code under test
- Simple utility functions
- Type definitions
- React components in integration tests

### Mock Quality

- Mocks must match real interface signatures
- Update mocks when interfaces change
- Document mock behavior assumptions
- Prefer minimal mocks over comprehensive fakes

---

## Test Data

### Required Practices

- Use factories for test data generation
- Keep test data realistic but anonymized
- Avoid hardcoded IDs that may conflict
- Clean up test data after tests
- Use deterministic data for snapshots

### Prohibited Practices

- Real user data in tests
- Production database connections
- Shared mutable test state
- Flaky random data without seeds

### Test Data Factories

Create reusable factories:

```typescript
// Example pattern
const createTestUser = (overrides?: Partial<User>): User => ({
  id: 'test-user-id',
  email: 'test@example.com',
  fullName: 'Test User',
  createdAt: new Date('2024-01-01'),
  ...overrides,
});
```

---

## Coverage Expectations

### Minimum Thresholds

| Category | Line Coverage | Branch Coverage |
|----------|---------------|-----------------|
| Utilities | 90% | 85% |
| Hooks | 85% | 80% |
| Components | 80% | 75% |
| API Functions | 85% | 80% |

### Coverage Philosophy

- Coverage is a guide, not a goal
- 100% coverage does not mean bug-free
- Focus on critical paths first
- Untested edge cases are acceptable if documented

### What Must Be Tested

- Authentication flows
- Authorization checks
- Data validation
- Error handling paths
- Business logic

### What May Be Skipped

- Third-party library wrappers
- Pure UI styling
- Generated code
- Development-only utilities

---

## CI/CD Integration

### Required Checks

- All tests pass before merge
- Coverage thresholds met
- No skipped tests without justification
- Test execution time within limits

### Test Execution

- Run unit tests on every commit
- Run integration tests on PR
- Run E2E tests on deploy preview
- Parallelize where possible

### Failure Handling

- Failing tests block deployment
- Flaky tests must be fixed or quarantined
- Test failures require investigation, not retry

---

## Test Organization

### File Structure

```
src/
├── components/
│   └── UserProfile/
│       ├── UserProfile.tsx
│       └── UserProfile.test.tsx    # Co-located
├── hooks/
│   ├── useAuth.ts
│   └── useAuth.test.ts
└── lib/
    ├── utils.ts
    └── utils.test.ts

netlify/
└── functions/
    └── api/
        └── auth/
            ├── signup.ts
            └── signup.test.ts
```

### Naming Conventions

- Test files: `*.test.ts` or `*.test.tsx`
- Test descriptions: Start with "should"
- Describe blocks: Match component/function name

---

## Prohibited Testing Shortcuts

### Never Do

- Skip tests to meet deadlines
- Comment out failing tests
- Use `test.skip` without tracking issue
- Ignore flaky tests
- Test implementation details
- Copy-paste tests without understanding
- Write tests after bugs ship (write them before)

### Always Do

- Write tests before or alongside code
- Fix broken tests immediately
- Review test code with same rigor as production code
- Refactor tests when refactoring code
- Document test assumptions

---

## Test Quality Checklist

Before committing tests:

- [ ] Tests have clear, descriptive names
- [ ] Tests are independent (no shared state)
- [ ] Tests clean up after themselves
- [ ] Mocks are minimal and accurate
- [ ] Edge cases are covered
- [ ] Error paths are tested
- [ ] Tests run in < 10 seconds (unit) / < 60 seconds (integration)
- [ ] No console warnings or errors during test run

---

*Tests are a feature, not overhead. Invest in them accordingly.*
