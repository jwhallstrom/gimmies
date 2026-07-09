export const PASSWORD_HINT =
  'At least 8 characters with uppercase, lowercase, and a number.';

export function mapAuthError(err: unknown): string {
  const e = err as { name?: string; message?: string };
  const name = e?.name || '';
  const msg = e?.message || '';

  if (name === 'UsernameExistsException' || msg.includes('already exists')) {
    return 'That email is already registered. Sign in or reset your password below.';
  }
  if (name === 'NotAuthorizedException' || name === 'UserNotFoundException') {
    return 'Incorrect email or password. Try again or reset your password.';
  }
  if (name === 'InvalidPasswordException' || msg.includes('Password')) {
    return `${msg || 'Password does not meet requirements.'} ${PASSWORD_HINT}`;
  }
  if (name === 'UserNotConfirmedException') {
    return 'Your account needs confirmation. Check your email for a code, or try signing in.';
  }
  if (name === 'UserAlreadyAuthenticatedException' || msg.includes('already a signed in user')) {
    return '';
  }
  if (msg.includes('PreSignUp failed') || msg.includes('already exists')) {
    return 'That email is already registered with a password. Sign in with email or reset your password.';
  }
  return msg || 'Something went wrong. Please try again.';
}
