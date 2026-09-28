export const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

export const emailError = (email: string, required = true): string => {
  const trimmed = email.trim();
  if (!trimmed) return required ? "Email is required" : "";
  return isValidEmail(trimmed) ? "" : "Enter a valid email address";
};

export interface CountryCode {
  code: string;
  flag: string;
  name: string;
}

export const COUNTRY_CODES: CountryCode[] = [
  { code: "+234", flag: "🇳🇬", name: "Nigeria" },
  { code: "+233", flag: "🇬🇭", name: "Ghana" },
  { code: "+254", flag: "🇰🇪", name: "Kenya" },
  { code: "+27", flag: "🇿🇦", name: "South Africa" },
  { code: "+256", flag: "🇺🇬", name: "Uganda" },
  { code: "+255", flag: "🇹🇿", name: "Tanzania" },
  { code: "+1", flag: "🇺🇸", name: "US/Canada" },
  { code: "+44", flag: "🇬🇧", name: "UK" },
];

const CODES_BY_LENGTH = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);

// Splits a stored phone value like "+2348012345678" into its country code and
// national digits. Falls back to +234 for values with no recognized prefix
// (e.g. legacy free-text numbers saved before this component existed).
export const parsePhone = (value: string): { countryCode: string; national: string } => {
  const trimmed = (value ?? "").trim();
  const match = CODES_BY_LENGTH.find((c) => trimmed.startsWith(c.code));
  if (match) return { countryCode: match.code, national: trimmed.slice(match.code.length).replace(/\D/g, "") };
  return { countryCode: "+234", national: trimmed.replace(/\D/g, "") };
};

export const formatPhone = (countryCode: string, national: string): string => `${countryCode}${national}`;

export const phoneError = (value: string, minDigits = 11, required = true): string => {
  const { national } = parsePhone(value);
  if (!national) return required ? "Phone number is required" : "";
  return national.length < minDigits ? `Enter at least ${minDigits} digits` : "";
};
