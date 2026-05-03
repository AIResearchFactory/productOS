import os from 'os';

/**
 * Retrieves the current system username.
 */
export function getSystemUsername() {
  return process.env.USER || process.env.USERNAME || os.userInfo().username || 'user';
}

/**
 * Retrieves the username and formats it as an owner name (e.g., "dominik" -> "Dominik").
 */
export function getFormattedOwnerName() {
  const username = getSystemUsername();
  if (!username) return 'User';
  return username.charAt(0).toUpperCase() + username.slice(1);
}
