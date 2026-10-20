import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";

export function isValidSolanaAddress(wallet: string): boolean {
  try {
    const key = new PublicKey(wallet);
    return PublicKey.isOnCurve(key.toBytes());
  } catch {
    return false;
  }
}

export function verifyWalletSignature(
  wallet: string,
  message: string,
  signatureBase58: string,
): boolean {
  try {
    const publicKey = new PublicKey(wallet).toBytes();
    const msg = new TextEncoder().encode(message);
    const signature = bs58.decode(signatureBase58);
    return nacl.sign.detached.verify(msg, signature, publicKey);
  } catch {
    return false;
  }
}

export function buildSignInMessage(wallet: string, nonce: string, issuedAt: string) {
  return [
    "Sign in to Bomb Hero Bits on Solana Mainnet",
    "",
    `Wallet: ${wallet}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
}
