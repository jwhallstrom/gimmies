import { signInWithRedirect } from 'aws-amplify/auth';

export type OAuthProvider = 'Google' | 'Facebook' | 'Apple';

/**
 * Start federated sign-in. Optional hook runs before redirect (e.g. stash invite targets).
 * Pending invite keys live in sessionStorage and survive the OAuth round-trip.
 */
export async function signInWithOAuth(
  provider: OAuthProvider,
  options?: { beforeRedirect?: () => void }
): Promise<void> {
  options?.beforeRedirect?.();
  await signInWithRedirect({ provider });
}

/** Build display name + profile fields from Cognito user attributes after OAuth. */
export function oauthProfileHints(attributes: Partial<Record<string, string>>) {
  const given = attributes.given_name?.trim();
  const family = attributes.family_name?.trim();
  const full = attributes.name?.trim();
  const suggestedName =
    full || (given && family ? `${given} ${family}` : undefined);

  return {
    email: attributes.email,
    suggestedName,
    firstName: given,
    lastName: family,
    photoUrl: attributes.picture,
    canAutoSubmit: Boolean(suggestedName),
  };
}
