import { ORES } from '../config/ores.js';
import { BiomeManager } from './BiomeManager.js';

export class OreLayer {
  constructor(biomeManager = new BiomeManager()) {
    this.biomeManager = biomeManager;
  }

  // km 깊이의 layer.oreProbabilities 를 누적분포로 보고, rand가 떨어진 슬롯의 광물을 반환.
  // 어느 슬롯에도 들지 못하면 null (= 일반 흙 타일)
  rollOreAt(km, rand = Math.random()) {
    const layer = this.biomeManager.getLayerAt(km);
    const probs = layer.oreProbabilities ?? {};

    let cumulative = 0;
    for (const [oreId, prob] of Object.entries(probs)) {
      cumulative += prob;
      if (rand < cumulative) return ORES[oreId];
    }
    return null;
  }
}
