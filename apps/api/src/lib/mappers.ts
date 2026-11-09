import type { Hero, User } from "@prisma/client";
import type { HeroDto, UserDto } from "@herobits/shared";
import { HERO_SKILLS, type HeroSkill } from "@herobits/shared";
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
    scrap: user.scrap,
    summonPity: { rare: user.summonPityRare, superRare: user.summonPitySuperRare, epic: user.summonPityEpic },
    gearPity: { blue: user.gearPityBlue, purple: user.gearPityPurple, gold: user.gearPityGold },
    inviteCode: user.inviteCode ?? "",
    porterOn: user.porterOn,
    shieldRepairOn: user.shieldRepairOn,
    shieldRepairRarities: user.shieldRepairRarities,
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
    shield: hero.shield,
    shieldMax: hero.shieldMax,
    shieldLevel: hero.shieldLevel,
    skills: Array.isArray(hero.skills) ? hero.skills.filter((value): value is HeroSkill => typeof value === "string" && HERO_SKILLS.includes(value as HeroSkill)) : [],
    forgeMode: hero.forgeMode as HeroDto["forgeMode"],
    status: hero.status,
    active: hero.active,
    dungeonX: hero.dungeonX,
    dungeonY: hero.dungeonY,
  };
}
