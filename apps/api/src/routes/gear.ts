import type { FastifyInstance } from "fastify";
import { authenticate } from "../lib/auth.js";
import { scrapHero, repairShield, upgradeShield, buyScrap } from "../services/gear.js";
import { buyEquipment, equipEquipment, fuseEquipment, listEquipment, removeEquipment, repairEquipment, salvageEquipment } from "../services/equipment.js";
import type { GearRarity } from "@herobits/shared";

export async function gearRoutes(app: FastifyInstance) {
  app.get("/equipment", { preHandler: authenticate }, async (request) => listEquipment(request.user.id));
  app.post("/equipment/boxes", { preHandler: authenticate }, async (request) => {
    const { rarity, requestKey } = (request.body ?? {}) as { rarity?: GearRarity; requestKey?: string };
    return buyEquipment(request.user.id, rarity as GearRarity, requestKey ?? "");
  });
  app.post("/equipment/fusion", { preHandler: authenticate }, async (request) => {
    const { pieceIds } = (request.body ?? {}) as { pieceIds?: string[] };
    return fuseEquipment(request.user.id, Array.isArray(pieceIds) ? pieceIds : []);
  });
  app.post("/equipment/salvage", { preHandler: authenticate }, async (request) => {
    const { pieceIds } = (request.body ?? {}) as { pieceIds?: string[] };
    return salvageEquipment(request.user.id, Array.isArray(pieceIds) ? pieceIds : []);
  });
  app.post("/equipment/:id/equip", { preHandler: authenticate }, async (request) => {
    const { id } = request.params as { id: string };
    const { heroId } = (request.body ?? {}) as { heroId?: string };
    return equipEquipment(request.user.id, id, heroId ?? "");
  });
  app.post("/equipment/:id/remove", { preHandler: authenticate }, async (request) => {
    const { id } = request.params as { id: string };
    return removeEquipment(request.user.id, id);
  });
  app.post("/equipment/:id/repair", { preHandler: authenticate }, async (request) => {
    const { id } = request.params as { id: string };
    return repairEquipment(request.user.id, id);
  });
  app.post("/shop/scrap", { preHandler: authenticate }, async (request) => {
    const { amount, source } = (request.body ?? {}) as { amount?: number; source?: "gold" | "chest" };
    return buyScrap(request.user.id, amount ?? 0, source ?? "gold");
  });
  app.post("/heroes/:id/scrap", { preHandler: authenticate }, async (request) => {
    const { id } = request.params as { id: string };
    return scrapHero(request.user.id, id);
  });
  app.post("/heroes/:id/shield/repair", { preHandler: authenticate }, async (request) => {
    const { id } = request.params as { id: string };
    return repairShield(request.user.id, id);
  });
  app.post("/heroes/:id/shield/upgrade", { preHandler: authenticate }, async (request) => {
    const { id } = request.params as { id: string };
    return upgradeShield(request.user.id, id);
  });
}
