BEGIN;
-- Independent stamina ranges replace the former class capacity × rarity multiplier.
UPDATE "RuntimeSettings" SET
 "data"=jsonb_set(
   jsonb_set("data",'{stamina}',("data"->'stamina')||'{"energyPerPoint":50,"rarityPoints":{"COMMON":{"min":1,"max":3},"RARE":{"min":3,"max":6},"SUPER_RARE":{"min":6,"max":9},"EPIC":{"min":9,"max":12},"LEGENDARY":{"min":12,"max":15},"SUPER_LEGENDARY":{"min":15,"max":18}}}'::jsonb),
   '{heroes,classes}',jsonb_build_object(
    'WARRIOR',("data"#>'{heroes,classes,WARRIOR}')-'maxStamina',
    'MAGE',("data"#>'{heroes,classes,MAGE}')-'maxStamina',
    'ROGUE',("data"#>'{heroes,classes,ROGUE}')-'maxStamina'
   )
 ),
 "revision"="revision"+1,"updatedAt"=CURRENT_TIMESTAMP
WHERE NOT (("data"->'stamina') ? 'rarityPoints');

-- Adapt owned heroes once, retaining their charge percentage (rounded down).
-- Purchased packs retain the exact attributes already paid for/revealed.
WITH limits(rarity,min_points,max_points) AS (
 VALUES ('COMMON',1,3),('RARE',3,6),('SUPER_RARE',6,9),
        ('EPIC',9,12),('LEGENDARY',12,15),('SUPER_LEGENDARY',15,18)
), capacities AS (
 SELECT h."id",h."maxStamina" AS old_max,h."stamina" AS old_energy,
  50*GREATEST(l.min_points,LEAST(l.max_points,ROUND(h."maxStamina"::numeric/50)::int)) AS new_max
 FROM "Hero" h JOIN limits l ON h."rarity"::text=l.rarity
), converted AS (
 SELECT *,FLOOR(new_max::numeric*GREATEST(0,LEAST(old_energy,old_max))/GREATEST(1,old_max))::int AS new_energy
 FROM capacities
)
UPDATE "Hero" h SET
 "maxStamina"=c.new_max,"stamina"=c.new_energy,
 "staminaRecoveryUnits"=CASE WHEN c.new_energy=c.new_max THEN 0 ELSE h."staminaRecoveryUnits" END,
 "staminaUsageUnits"=CASE WHEN c.new_energy=0 THEN 0 ELSE h."staminaUsageUnits" END,
 "status"=CASE WHEN c.new_energy=0 AND h."status"='HUNTING' THEN 'IDLE'::"HeroStatus" ELSE h."status" END
FROM converted c WHERE h."id"=c."id" AND c.old_max<>c.new_max;
COMMIT;
