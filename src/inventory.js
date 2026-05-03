const MAX_STACK = 64;
const SLOT_COUNT = 9;

export class Inventory {
  constructor() {
    this.slots = Array.from({ length: SLOT_COUNT }, () => ({ itemId: 0, count: 0 }));
    this.selectedIndex = 0;
    this.onChange = null;
  }

  setDefaultLoadout() {
    this.slots[0] = { itemId: 10, count: 1 }; // Pickaxe
    this.slots[1] = { itemId: 11, count: 1 }; // Axe
    this.slots[2] = { itemId: 12, count: 1 }; // Shovel
    this.slots[3] = { itemId: 1, count: 64 };  // Grass
    this.slots[4] = { itemId: 8, count: 64 };  // Cobblestone
    this.slots[5] = { itemId: 9, count: 64 };  // Planks
    this.slots[6] = { itemId: 0, count: 0 };
    this.slots[7] = { itemId: 0, count: 0 };
    this.slots[8] = { itemId: 0, count: 0 };
    this._notify();
  }

  select(index) {
    if (index < 0 || index >= SLOT_COUNT) return;
    this.selectedIndex = index;
    this._notify();
  }

  cycle(offset) {
    const next = (this.selectedIndex + offset + SLOT_COUNT) % SLOT_COUNT;
    this.select(next);
  }

  selectByNumber(n) {
    this.select(n - 1);
  }

  getSelected() {
    const slot = this.slots[this.selectedIndex];
    return slot.count > 0 ? slot : null;
  }

  getSelectedItemId() {
    const slot = this.slots[this.selectedIndex];
    return slot.count > 0 ? slot.itemId : 0;
  }

  add(itemId, count = 1) {
    if (itemId <= 0 || count <= 0) return false;
    let remaining = count;

    for (let i = 0; i < SLOT_COUNT && remaining > 0; i++) {
      const slot = this.slots[i];
      if (slot.itemId === itemId && slot.count < MAX_STACK) {
        const space = MAX_STACK - slot.count;
        const toAdd = Math.min(remaining, space);
        slot.count += toAdd;
        remaining -= toAdd;
      }
    }

    for (let i = 0; i < SLOT_COUNT && remaining > 0; i++) {
      const slot = this.slots[i];
      if (slot.count === 0) {
        const toAdd = Math.min(remaining, MAX_STACK);
        slot.itemId = itemId;
        slot.count = toAdd;
        remaining -= toAdd;
      }
    }

    if (remaining < count) this._notify();
    return remaining === 0;
  }

  removeSelected(count = 1) {
    const slot = this.slots[this.selectedIndex];
    if (slot.count < count || count <= 0) return false;
    slot.count -= count;
    if (slot.count === 0) slot.itemId = 0;
    this._notify();
    return true;
  }

  _notify() {
    if (this.onChange) this.onChange();
  }
}
