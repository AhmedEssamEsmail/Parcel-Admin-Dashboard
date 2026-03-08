/**
 * Returns a greeting message
 * @param name - Optional name to personalize the greeting
 * @returns A greeting string
 */
export function getGreeting(name?: string): string {
  // Handle edge cases
  if (!name || name.trim() === '') {
    return 'Hello World!';
  }

  // Return personalized greeting
  return `Hello, ${name.trim()}!`;
}
