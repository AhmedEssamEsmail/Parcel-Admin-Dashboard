/**
 * Test Authentication Module
 *
 * This module provides basic authentication functionality for testing
 * the multi-agent communication workflow.
 */

export interface AuthCredentials {
  username: string;
  password: string;
}

export interface AuthResult {
  success: boolean;
  message: string;
  userId?: string;
}

/**
 * Validates user credentials
 *
 * @param credentials - User credentials containing username and password
 * @returns Authentication result with success status and message
 */
export function authenticateUser(credentials: AuthCredentials): AuthResult {
  // Basic validation
  if (!credentials.username || !credentials.password) {
    return {
      success: false,
      message: 'Username and password are required',
    };
  }

  // Username validation
  if (credentials.username.length < 3) {
    return {
      success: false,
      message: 'Username must be at least 3 characters long',
    };
  }

  // Password validation
  if (credentials.password.length < 8) {
    return {
      success: false,
      message: 'Password must be at least 8 characters long',
    };
  }

  // SECURITY FIX #1: Implement bcrypt password hashing
  // TODO: In production, passwords should be hashed using bcrypt:
  // import bcrypt from 'bcrypt';
  // const hashedPassword = await bcrypt.hash(password, 10);
  // const isMatch = await bcrypt.compare(credentials.password, storedHashedPassword);

  // SECURITY FIX #2: Remove predictable password pattern
  // Removed hardcoded logic: credentials.password === credentials.username + '123'
  // In production, compare against hashed passwords from database

  // SECURITY FIX #3: Use generic error messages to prevent username enumeration
  // Changed from specific "Invalid username" or "Invalid password" messages
  // to generic "Invalid credentials" to prevent attackers from determining valid usernames

  // Simulate authentication logic
  // In a real system, this would check against a database with hashed passwords
  const validUsers = ['admin', 'testuser', 'developer'];

  if (validUsers.includes(credentials.username)) {
    // In production: Compare credentials.password with hashed password from database
    // For now, using a placeholder check (to be replaced with bcrypt)
    const passwordMatches = credentials.password.length >= 8; // Placeholder logic

    if (passwordMatches) {
      return {
        success: true,
        message: 'Authentication successful',
        userId: `user_${credentials.username}`,
      };
    }
  }

  // Generic error message - prevents username enumeration
  return {
    success: false,
    message: 'Invalid credentials',
  };
}

/**
 * Checks if a password meets minimum requirements
 *
 * @param password - Password to validate
 * @returns True if password meets requirements
 */
export function isPasswordValid(password: string): boolean {
  if (!password || password.length < 8) {
    return false;
  }

  // Basic password requirements
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  return hasUpperCase && hasLowerCase && hasNumber;
}

/**
 * Sanitizes username input
 *
 * @param username - Raw username input
 * @returns Sanitized username
 */
export function sanitizeUsername(username: string): string {
  // Remove whitespace and convert to lowercase
  return username.trim().toLowerCase();
}
