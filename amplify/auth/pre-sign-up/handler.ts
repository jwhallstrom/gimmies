import type { PreSignUpTriggerHandler } from 'aws-lambda';

export const handler: PreSignUpTriggerHandler = async (event) => {
  // Email/password signups: skip verification email (invite-first onboarding).
  event.response.autoConfirmUser = true;
  event.response.autoVerifyEmail = true;

  // Google / federated signups: Google verifies email; keep zero-friction join.
  if (event.triggerSource === 'PreSignUp_ExternalProvider') {
    event.response.autoConfirmUser = true;
    event.response.autoVerifyEmail = true;
  }

  return event;
};
