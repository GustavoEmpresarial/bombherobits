import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Wallet auth: no demo password user. Connect Phantom/Solflare on mainnet.
  await prisma.authChallenge.deleteMany();
  console.log("Seed ok — connect a Solana mainnet wallet to play.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
