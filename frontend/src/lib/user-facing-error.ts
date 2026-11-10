/** Error whose message is already translated text that is safe to show to the user. */
export class UserFacingError extends Error {}

export function toUserMessage(error: unknown, fallback: string, network: string): string {
  if (error instanceof UserFacingError) return error.message;
  if (error instanceof TypeError) return network; // fetch rejects with TypeError when the network fails
  return fallback;
}
