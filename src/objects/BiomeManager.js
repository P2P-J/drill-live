import { BIOMES } from '../config/biomes.js';
import { GAME } from '../config/game.js';

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpColor(c1, c2, t) {
  const r = Math.round(lerp((c1 >> 16) & 0xff, (c2 >> 16) & 0xff, t));
  const g = Math.round(lerp((c1 >> 8) & 0xff, (c2 >> 8) & 0xff, t));
  const b = Math.round(lerp(c1 & 0xff, c2 & 0xff, t));
  return (r << 16) | (g << 8) | b;
}

export class BiomeManager {
  constructor(biomes = BIOMES) {
    this.biomes = biomes;
  }

  getBiomeAt(km) {
    for (const biome of this.biomes) {
      if (km >= biome.startKm && km < biome.endKm) return biome;
    }
    return this.biomes[this.biomes.length - 1];
  }

  getLayerAt(km) {
    const biome = this.getBiomeAt(km);
    for (const layer of biome.layers) {
      if (km >= layer.startKm && km < layer.endKm) {
        return { ...layer, biomeId: biome.id, biomeName: biome.name, biomeEmoji: biome.emoji };
      }
    }
    return { ...biome.layers[biome.layers.length - 1], biomeId: biome.id, biomeName: biome.name, biomeEmoji: biome.emoji };
  }

  getColorAt(km) {
    const layer = this.getLayerAt(km);

    if (layer.isCycle) {
      const offset = km - layer.startKm;
      const cycleKm = layer.cycleKm;
      const colors = layer.cycleColors;
      const segments = colors.length;
      const segmentFloat = offset / cycleKm;
      const segmentIndex = Math.floor(segmentFloat) % segments;
      const nextIndex = (segmentIndex + 1) % segments;
      const t = segmentFloat - Math.floor(segmentFloat);
      return lerpColor(colors[segmentIndex], colors[nextIndex], t);
    }

    if (layer.transitionTo !== undefined) {
      const span = layer.endKm - layer.startKm;
      const t = span > 0 ? (km - layer.startKm) / span : 0;
      return lerpColor(layer.color, layer.transitionTo, Math.max(0, Math.min(1, t)));
    }

    return layer.color;
  }

  kmToY(km) {
    return km * GAME.pxPerKm;
  }

  yToKm(y) {
    return y / GAME.pxPerKm;
  }
}
