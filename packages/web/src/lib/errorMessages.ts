import type { Translator } from '../i18n';

const KNOWN_CODES = [
  'insufficient_balance',
  'forbidden',
  'account_deactivated',
  'email_domain_not_allowed',
  'validation_error',
  'invalid_transition',
  'last_admin',
  'concurrent_request',
] as const;

type KnownErrorCode = (typeof KNOWN_CODES)[number];

function isKnownCode(code: string): code is KnownErrorCode {
  return (KNOWN_CODES as readonly string[]).includes(code);
}

/**
 * Maps an ApiError.code to a translated, user-facing toast message.
 * Falls back to a generic translated message for unrecognised codes.
 */
export function translateApiErrorCode(code: string | undefined, t: Translator): string {
  if (code && isKnownCode(code)) {
    return t(`errors.${code}`);
  }
  return t('errors.generic');
}
