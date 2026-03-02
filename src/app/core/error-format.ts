type ErrorLike = {
  message?: unknown;
  code?: unknown;
  details?: unknown;
  hint?: unknown;
  status?: unknown;
  error_description?: unknown;
  name?: unknown;
};

function sanitize(value: unknown, maxLength = 320): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  if (!text) {
    return null;
  }
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
}

export function formatAppError(error: unknown, context: string): string {
  const source = (error || {}) as ErrorLike;
  const message = sanitize(source.message) || 'Unbekannter Fehler';
  const code = sanitize(source.code);
  const details = sanitize(source.details);
  const hint = sanitize(source.hint) || sanitize(source.error_description);
  const status = sanitize(source.status);
  const name = sanitize(source.name);
  const timestamp = new Date().toISOString();

  const parts = [`${context}`, `Message: ${message}`];
  if (code) parts.push(`Code: ${code}`);
  if (status) parts.push(`Status: ${status}`);
  if (details) parts.push(`Details: ${details}`);
  if (hint) parts.push(`Hint: ${hint}`);
  if (name && name !== 'Error') parts.push(`Type: ${name}`);
  parts.push(`Time: ${timestamp}`);

  return parts.join('\n');
}
