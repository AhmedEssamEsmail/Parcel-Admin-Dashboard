# Test Greeting Utility

## Overview

The `getGreeting` function provides a simple utility for generating greeting messages with optional personalization.

## Function Signature

```typescript
function getGreeting(name?: string): string;
```

## Parameters

- `name` (optional): A string representing the person's name to personalize the greeting
  - If provided, returns a personalized greeting
  - If omitted, empty, or only whitespace, returns the default greeting

## Return Value

Returns a string containing the greeting message:

- Default: `"Hello World!"`
- Personalized: `"Hello, {name}!"`

## Examples

### Basic Usage

```typescript
import { getGreeting } from './lib/test-greeting';

// Default greeting
const greeting1 = getGreeting();
console.log(greeting1); // Output: "Hello World!"

// Personalized greeting
const greeting2 = getGreeting('Alice');
console.log(greeting2); // Output: "Hello, Alice!"
```

### Edge Cases

```typescript
// Empty string
getGreeting(''); // Returns: "Hello World!"

// Whitespace only
getGreeting('   '); // Returns: "Hello World!"

// Name with whitespace (trimmed automatically)
getGreeting('  Bob  '); // Returns: "Hello, Bob!"

// Special characters
getGreeting('José'); // Returns: "Hello, José!"

// Names with spaces
getGreeting('John Doe'); // Returns: "Hello, John Doe!"
```

## Use Cases

- Welcome messages in applications
- Personalized notifications
- Testing and demonstration purposes
- Template for more complex greeting systems

## Implementation Details

- Automatically trims whitespace from provided names
- Handles edge cases gracefully (empty strings, whitespace)
- Supports international characters and multi-word names
- Type-safe with TypeScript

## Testing

Comprehensive unit tests are available in `tests/test-greeting.test.ts` covering:

- Default greeting behavior
- Personalized greetings
- Edge cases (empty strings, whitespace)
- Special characters and multi-word names

Test coverage: 100%

## Related Files

- Implementation: `lib/test-greeting.ts`
- Tests: `tests/test-greeting.test.ts`
