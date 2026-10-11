import { world, system, ItemStack } from "@minecraft/server";

const customSwordIds = new Set([
  "custom:mob_head_dropper_iron",
  "custom:mob_head_dropper_diamond",
  "custom:mob_head_dropper_netherite"
]);

const mobHeadMap = {
  "minecraft:wither_skeleton": "custom:wither_skeleton_head",
  "minecraft:blaze": "custom:blaze_head",
  "minecraft:enderman": "custom:enderman_head"
};

const processedDeaths = new Map();
const DEATH_RECORD_EXPIRY_MS = 3000;
const MAX_DEATH_RECORDS = 10000;

function cleanupOldDeaths() {
  const now = Date.now();
  for (const [key, timestamp] of processedDeaths.entries()) {
    if (now - timestamp > DEATH_RECORD_EXPIRY_MS) {
      processedDeaths.delete(key);
    }
  }
  if (processedDeaths.size > MAX_DEATH_RECORDS) {
    const entries = Array.from(processedDeaths.entries());
    for (let i = 0; i < entries.length / 2; i++) {
      processedDeaths.delete(entries[i][0]);
    }
  }
}

function getDeathKey(deadEntity) {
  const loc = deadEntity.location;
  return `${deadEntity.id}_${Math.floor(loc.x)}_${Math.floor(loc.y)}_${Math.floor(loc.z)}`;
}

function hasDeathBeenProcessed(deadEntity) {
  const key = getDeathKey(deadEntity);
  return processedDeaths.has(key);
}

function markDeathAsProcessed(deadEntity) {
  const key = getDeathKey(deadEntity);
  processedDeaths.set(key, Date.now());
}

function getPlayerMainHandItem(player) {
  try {
    const equippable = player.getComponent("minecraft:equippable");
    if (!equippable) return null;
    
    const mainhandSlot = equippable.getEquipmentSlot("Mainhand");
    if (!mainhandSlot) return null;
    
    const item = mainhandSlot.getItem();
    if (!item) return null;
    
    return item;
  } catch (e) {
    return null;
  }
}

function tryDropHead(deadEntity, killer) {
  try {
    if (!deadEntity || !killer) return false;
    
    if (!killer.isPlayer?.()) return false;
    
    const item = getPlayerMainHandItem(killer);
    if (!item) return false;
    
    if (!customSwordIds.has(item.typeId)) return false;
    
    const headItemId = mobHeadMap[deadEntity.typeId];
    if (!headItemId) return false;
    
    const dimension = world.getDimension(deadEntity.dimension.id);
    const headStack = new ItemStack(headItemId, 1);
    
    const dropLocation = {
      x: deadEntity.location.x,
      y: deadEntity.location.y + 0.5,
      z: deadEntity.location.z
    };
    
    dimension.spawnItem(headStack, dropLocation);
    return true;
  } catch (e) {
    return false;
  }
}

world.afterEvents.entityDie.subscribe((event) => {
  try {
    const { deadEntity, damageSource } = event;
    if (!deadEntity || !damageSource) return;
    
    if (hasDeathBeenProcessed(deadEntity)) return;
    
    const killer = damageSource.damagingEntity;
    if (!killer) return;
    
    if (tryDropHead(deadEntity, killer)) {
      markDeathAsProcessed(deadEntity);
    }
  } catch (e) {
  }
}, { namespaces: ["minecraft"] });

system.runInterval(() => {
  cleanupOldDeaths();
}, 20);
