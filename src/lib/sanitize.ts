/**
 * ============================================================================
 *  Input sanitization + validation utilities
 * ============================================================================
 *  - Strip HTML/script tags (XSS prevention)
 *  - Normalize phone numbers (handle +213, spaces, dashes)
 *  - Enforce max lengths
 *  - Strip control characters
 * ============================================================================
 */

/** Strip HTML tags + dangerous chars (XSS prevention). */
export function sanitizeText(input: string): string {
  if (!input) return "";
  return String(input)
    .replace(/<[^>]*>/g, "") // strip HTML tags
    .replace(/[\u0000-\u001F\u007F]/g, "") // strip control chars
    .replace(/javascript:/gi, "") // strip js: URLs
    .replace(/on\w+\s*=/gi, "") // strip event handlers
    .trim();
}

/**
 * Normalize Algerian phone number to 0XXXXXXXXX format.
 * Handles: +213 555 12 34 56, 213555123456, 0555-12-34-56, etc.
 * Returns null if invalid.
 */
export function normalizePhone(input: string): string | null {
  if (!input) return null;
  let phone = String(input).replace(/[\s\-().]/g, ""); // strip separators

  // Handle +213 or 213 prefix → convert to 0
  if (phone.startsWith("+213")) phone = "0" + phone.slice(4);
  else if (phone.startsWith("213")) phone = "0" + phone.slice(3);

  // Must be exactly 10 digits starting with 05/06/07
  if (!/^0[567]\d{8}$/.test(phone)) return null;
  return phone;
}

/** Validate + sanitize name: 3-80 chars, no HTML, no control chars. */
export function sanitizeName(input: string): string {
  return sanitizeText(input).slice(0, 80);
}

/** Validate + sanitize notes: max 500 chars, no HTML. */
export function sanitizeNotes(input: string): string {
  return sanitizeText(input).slice(0, 500);
}

/** Validate quantity: integer 1-4. */
export function sanitizeQuantity(input: unknown): number {
  const q = Number(input);
  if (!Number.isInteger(q) || q < 1 || q > 4) return 1;
  return q;
}
