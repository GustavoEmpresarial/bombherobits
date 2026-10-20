function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return typeof error === "string" ? error : "Wallet sign-in failed. Please try again.";
}

export function walletError(error: unknown) {
  const message = errorMessage(error);
  const staleAccount = /UserKeyring not found/i.test(message);
  return {
    staleAccount,
    message: staleAccount
      ? "Your wallet could not find the connected account. Open your wallet extension, unlock it and select an available Solana account. Then reconnect your wallet."
      : message,
  };
}
