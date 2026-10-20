import type { Hero, User } from "@prisma/client";
import type { HeroDto, UserDto } from "@herobits/shared";
import { Decimal } from "@prisma/client/runtime/library";

export function toGold(value: Decimal | number | string): number {
  return Number(value);
}

export function shortWallet(wallet: string): string {
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    wallet: user.wallet,
    displayName: user.displayName,
    gold: toGold(user.gold),
    chest: toGold(user.chest),
    mintCards: user.mintCards,
    inviteCode: user.inviteCode ?? "",
    porterOn: user.porterOn,
  };
}

export function toHeroDto(hero: Hero): HeroDto {
  return {
    id: hero.id,
    class: hero.class,
    rarity: hero.rarity,
    level: hero.level,
    atk: hero.atk,
    spd: hero.spd,
    stamina: hero.stamina,
    maxStamina: hero.maxStamina,
    status: hero.status,
    dungeonX: hero.dungeonX,
    dungeonY: hero.dungeonY,
  };
}
