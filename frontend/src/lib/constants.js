// Re-export shared constants for convenient frontend imports.
// Pages import from '../../lib/constants.js' instead of deep relative paths.
export {
  FEATURE_DEPS, FEATURE_DEFAULTS_OFF, isOn,
  FINANCE_PAYMENT_METHODS, MEMBER_PAYMENT_METHODS,
  SETTINGS_PAYMENT_METHODS, ALL_PAYMENT_METHODS,
  UK_POSTCODE_RE,
} from '../../../shared/constants.js';
