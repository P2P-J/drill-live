export class GameState {
  constructor() {
    this.gold = 0;
    this.depthKm = 0;
    this.upgrades = {
      drillPower: 1,
      drillRange: 1,
      fuelTank: 1,
      cargo: 1,
      engine: 1,
    };
    // 채굴한 광물 누계
    this.oresMined = {
      coal: 0, copper: 0, iron: 0, gold: 0,
      crystal: 0, amethyst: 0, sapphire: 0, emerald: 0,
      diamond: 0, ruby: 0, lavaCrystal: 0, voidStone: 0,
    };
    this._listeners = new Map();
  }

  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(fn);
  }

  off(event, fn) {
    this._listeners.get(event)?.delete(fn);
  }

  emit(event, payload) {
    const set = this._listeners.get(event);
    if (!set) return;
    for (const fn of set) fn(payload);
  }

  addGold(amount) {
    this.gold += amount;
    this.emit('gold', this.gold);
  }

  spendGold(amount) {
    if (this.gold < amount) return false;
    this.gold -= amount;
    this.emit('gold', this.gold);
    return true;
  }

  setDepth(km) {
    this.depthKm = km;
    this.emit('depth', km);
  }

  setUpgrade(name, level) {
    this.upgrades[name] = level;
    this.emit('upgrade', { name, level });
  }

  addOre(oreId, count = 1) {
    if (!(oreId in this.oresMined)) return;
    this.oresMined[oreId] += count;
    this.emit('ore', { oreId, total: this.oresMined[oreId] });
  }
}

export const gameState = new GameState();
