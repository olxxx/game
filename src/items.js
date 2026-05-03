export const ITEM_TYPE = {
  BLOCK: 'block',
  TOOL: 'tool',
};

export const TOOL_TYPE = {
  PICKAXE: 'pickaxe',
  AXE: 'axe',
  SHOVEL: 'shovel',
};

export const ITEMS = [
  { id: 0, name: 'Air' },
  { id: 1, name: 'Grass', type: ITEM_TYPE.BLOCK, hardness: 0.6, drops: 1 },
  { id: 2, name: 'Dirt', type: ITEM_TYPE.BLOCK, hardness: 0.5, drops: 2 },
  { id: 3, name: 'Stone', type: ITEM_TYPE.BLOCK, hardness: 1.5, drops: 8 },
  { id: 4, name: 'Water', type: ITEM_TYPE.BLOCK, hardness: Infinity },
  { id: 5, name: 'Sand', type: ITEM_TYPE.BLOCK, hardness: 0.5, drops: 5 },
  { id: 6, name: 'Log', type: ITEM_TYPE.BLOCK, hardness: 2.0, drops: 9 },
  { id: 7, name: 'Leaves', type: ITEM_TYPE.BLOCK, hardness: 0.2, drops: 0 },
  { id: 8, name: 'Cobblestone', type: ITEM_TYPE.BLOCK, hardness: 2.0, drops: 8 },
  { id: 9, name: 'Planks', type: ITEM_TYPE.BLOCK, hardness: 2.0, drops: 9 },
  { id: 10, name: 'Pickaxe', type: ITEM_TYPE.TOOL, toolType: TOOL_TYPE.PICKAXE, speed: 4.0, effective: [3, 8] },
  { id: 11, name: 'Axe', type: ITEM_TYPE.TOOL, toolType: TOOL_TYPE.AXE, speed: 3.0, effective: [6, 9] },
  { id: 12, name: 'Shovel', type: ITEM_TYPE.TOOL, toolType: TOOL_TYPE.SHOVEL, speed: 3.0, effective: [1, 2, 5] },
  { id: 13, name: 'Torch', type: ITEM_TYPE.BLOCK, hardness: 0.3, drops: 13 },
];

const ITEM_MAP = new Map(ITEMS.map(item => [item.id, item]));

export const BARE_HAND_SPEED = 0.3;

export function getItem(id) {
  return ITEM_MAP.get(id) ?? null;
}

export function isTool(id) {
  const item = getItem(id);
  return item?.type === ITEM_TYPE.TOOL;
}

export function isBlock(id) {
  const item = getItem(id);
  return item?.type === ITEM_TYPE.BLOCK;
}

export function getMineTime(blockId, toolId) {
  const block = getItem(blockId);
  if (!block || block.hardness === Infinity || block.hardness === undefined) return Infinity;

  const tool = getItem(toolId);
  let speed = BARE_HAND_SPEED;

  if (tool && tool.type === ITEM_TYPE.TOOL) {
    if (tool.effective && tool.effective.includes(blockId)) {
      speed = tool.speed;
    } else {
      speed = Math.max(BARE_HAND_SPEED, tool.speed * 0.3);
    }
  }

  return block.hardness / speed;
}

export function getDropId(blockId) {
  const block = getItem(blockId);
  if (!block) return null;
  if ('drops' in block) return block.drops;
  return null;
}
