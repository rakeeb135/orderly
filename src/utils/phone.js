/**
 * Normalizes any Sri Lankan mobile input into a standard 10-digit format (07XXXXXXXX).
 * Handles:
 *  - +94771234567
 *  - 0094771234567
 *  - 94771234567
 *  - 771234567
 *  - 077 123 4567 / 077-1234567
 */
export function normalizeSLPhone(rawPhone) {
  if (!rawPhone) return '';
  
  // Remove all non-numeric characters
  let digits = rawPhone.toString().replace(/[^0-9]/g, '');

  // Strip international prefixes (94 or 0094)
  if (digits.startsWith('0094')) {
    digits = digits.slice(4);
  } else if (digits.startsWith('94')) {
    digits = digits.slice(2);
  }

  // Ensure standard leading 0
  if (!digits.startsWith('0') && digits.length === 9) {
    digits = '0' + digits;
  }

  return digits;
}

export function isValidSLPhone(normalized) {
  // Must be exactly 10 digits starting with 07
  return /^07[01245678][0-9]{7}$/.test(normalized);
}