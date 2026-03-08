/**
 * Escapes HTML entities to prevent XSS attacks
 */
export function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };

  return text.replace(/[&<>"'/]/g, (char) => htmlEntities[char] || char);
}

/**
 * Prevents path traversal attacks by removing dangerous path sequences
 */
export function sanitizePath(path: string): string {
  // Remove any path traversal sequences
  let sanitized = path.replace(/\.\./g, '');
  
  // Remove leading slashes
  sanitized = sanitized.replace(/^\/+/, '');
  
  // Remove any null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Normalize multiple slashes to single slash
  sanitized = sanitized.replace(/\/+/g, '/');
  
  return sanitized;
}

/**
 * Sanitizes user input by escaping HTML and trimming whitespace
 */
export function sanitizeInput(input: string): string {
  return escapeHtml(input.trim());
}

/**
 * Sanitizes an object's string values
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized = { ...obj };
  
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'string') {
      (sanitized as Record<string, unknown>)[key] = sanitizeInput(sanitized[key] as string);
    }
  }
  
  return sanitized;
}
