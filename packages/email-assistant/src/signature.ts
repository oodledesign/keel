export function appendSignature(
  body: string,
  signature: string | null | undefined,
) {
  const trimmedBody = body.trim();
  const trimmedSignature = signature?.trim();

  if (!trimmedSignature) {
    return trimmedBody;
  }

  if (trimmedBody.endsWith(trimmedSignature)) {
    return trimmedBody;
  }

  return `${trimmedBody}\n\n${trimmedSignature}`;
}
