// Which plants grow when and where. Each era lists model ids with relative weights per biome
// and a size range (m). Biomes: 'forest', 'open' (grass/shrub land), 'wet' (swamp, river
// banks), 'dry' (desert edge), 'cold' (tundra/boreal), 'shore'. Sea floor: 'reef' (shallow,
// warm), 'shelf' (shallow, cool). Follows the fossil record of plant groups (see DECISIONS.md):
// no land plants before ~470 Ma, no forests before ~385 Ma, no flowers before ~130 Ma,
// no grasslands before ~25 Ma.

const E = (from, to, land, sea) => ({ from, to, land, sea });

export const FLORA = [
  E(4600, 470, {}, {
    reef: [['stromatolite', 1, 0.5, 2]],
    shelf: [['stromatolite', 1, 0.4, 1.5]],
  }),
  E(470, 420, {
    wet: [['early-tuft', 1, 0.05, 0.12]],
    shore: [['early-tuft', 1, 0.04, 0.1]],
  }, {
    reef: [['coral-mound', 0.5, 0.5, 1.5], ['crinoid', 1, 0.4, 1], ['sponge', 0.5, 0.3, 0.8]],
    shelf: [['crinoid', 1, 0.3, 0.9], ['sponge', 0.4, 0.3, 0.7]],
  }),
  E(420, 385, {
    wet: [['early-tuft', 1, 0.15, 0.5], ['horsetail', 0.2, 0.3, 0.6]],
    forest: [['early-tuft', 1, 0.2, 0.6]],
    open: [['early-tuft', 0.6, 0.1, 0.3]],
    shore: [['early-tuft', 1, 0.1, 0.3]],
  }, {
    reef: [['coral-mound', 1, 0.5, 2], ['coral', 0.4, 0.4, 1], ['crinoid', 1, 0.4, 1.2], ['sponge', 0.4, 0.3, 0.8]],
    shelf: [['crinoid', 1, 0.3, 1], ['sponge', 0.5, 0.3, 0.7]],
  }),
  E(385, 359, {
    forest: [['archaeopteris', 1, 8, 22], ['fern', 0.6, 0.6, 1.2], ['early-tuft', 0.5, 0.3, 0.7]],
    wet: [['archaeopteris', 0.6, 6, 18], ['horsetail', 0.6, 0.6, 1.5], ['fern', 0.6, 0.5, 1]],
    open: [['early-tuft', 1, 0.2, 0.5], ['fern', 0.3, 0.4, 0.9]],
    shore: [['early-tuft', 1, 0.2, 0.4]],
  }, {
    reef: [['coral-mound', 1, 0.6, 2], ['coral', 0.6, 0.4, 1.2], ['crinoid', 1, 0.4, 1.2], ['sponge', 0.5, 0.3, 0.9]],
    shelf: [['crinoid', 1, 0.3, 1]],
  }),
  E(359, 299, {
    wet: [['lycopsid', 1, 15, 38], ['calamites', 0.8, 5, 14], ['tree-fern', 0.5, 4, 9], ['fern', 0.8, 0.6, 1.4]],
    forest: [['lycopsid', 0.5, 12, 30], ['tree-fern', 0.7, 4, 9], ['seed-fern', 0.7, 2, 5], ['fern', 0.8, 0.6, 1.4]],
    open: [['seed-fern', 0.6, 1.5, 4], ['fern', 1, 0.5, 1.2]],
    cold: [['seed-fern', 0.5, 1, 3], ['fern', 0.5, 0.4, 1]],
    shore: [['calamites', 0.6, 3, 8], ['fern', 1, 0.4, 1]],
  }, {
    reef: [['crinoid', 1, 0.4, 1.3], ['coral', 0.5, 0.3, 1], ['sponge', 0.4, 0.3, 0.9]],
    shelf: [['crinoid', 1, 0.3, 1]],
  }),
  E(299, 252, {
    forest: [['conifer-early', 1, 6, 18], ['glossopteris', 0.8, 5, 14], ['seed-fern', 0.5, 2, 5], ['fern', 0.6, 0.5, 1.2]],
    wet: [['calamites', 0.6, 3, 9], ['tree-fern', 0.5, 3, 8], ['fern', 1, 0.5, 1.2]],
    open: [['seed-fern', 0.6, 1.5, 3.5], ['cycad', 0.4, 1, 2.5], ['fern', 0.3, 0.4, 0.9]],
    dry: [['conifer-early', 0.3, 2, 6]],
    cold: [['glossopteris', 1, 3, 10]],
    shore: [['calamites', 0.5, 2, 6], ['fern', 1, 0.4, 0.9]],
  }, {
    reef: [['crinoid', 0.7, 0.4, 1.2], ['coral', 0.6, 0.3, 1], ['sponge', 0.7, 0.3, 1]],
    shelf: [['crinoid', 1, 0.3, 1]],
  }),
  E(252, 201, {
    forest: [['conifer', 1, 8, 25], ['ginkgo', 0.4, 5, 15], ['tree-fern', 0.5, 3, 8], ['cycad', 0.5, 1, 3], ['fern', 0.8, 0.5, 1.3]],
    wet: [['horsetail', 0.8, 0.8, 2.5], ['tree-fern', 0.6, 3, 8], ['fern', 1, 0.5, 1.3]],
    open: [['cycad', 0.8, 1, 3], ['fern', 0.6, 0.4, 1]],
    dry: [['conifer', 0.2, 2, 6], ['cycad', 0.3, 0.8, 2]],
    cold: [['conifer', 1, 5, 15]],
    shore: [['horsetail', 0.6, 0.6, 1.8], ['fern', 1, 0.4, 1]],
  }, {
    reef: [['coral', 1, 0.4, 1.4], ['sponge', 0.5, 0.3, 1], ['crinoid', 0.3, 0.3, 0.8]],
    shelf: [['sponge', 0.4, 0.3, 0.8]],
  }),
  E(201, 130, {
    forest: [['araucaria', 1, 15, 40], ['conifer', 0.8, 10, 30], ['ginkgo', 0.4, 6, 18], ['tree-fern', 0.6, 3, 9], ['cycad', 0.6, 1, 3.5], ['fern', 1, 0.5, 1.4]],
    wet: [['horsetail', 0.8, 0.8, 2.5], ['tree-fern', 0.6, 3, 8], ['fern', 1, 0.5, 1.3]],
    open: [['cycad', 0.8, 1, 3.5], ['fern', 1, 0.4, 1.1]],
    dry: [['araucaria', 0.2, 6, 15], ['cycad', 0.3, 0.8, 2]],
    cold: [['conifer', 1, 8, 25], ['ginkgo', 0.5, 6, 15]],
    shore: [['horsetail', 0.5, 0.6, 1.8], ['fern', 1, 0.4, 1]],
  }, {
    reef: [['coral', 1, 0.4, 1.6], ['coral-mound', 0.6, 0.5, 1.5], ['sponge', 0.4, 0.3, 1]],
    shelf: [['sponge', 0.4, 0.3, 0.8]],
  }),
  E(130, 66, {
    forest: [['broadleaf', 1, 10, 28], ['conifer', 0.7, 12, 35], ['araucaria', 0.4, 15, 35], ['cycad', 0.4, 1, 3], ['fern', 0.8, 0.5, 1.3], ['flowers', 0.3, 0.3, 0.6]],
    wet: [['palm', 0.6, 5, 14], ['tree-fern', 0.5, 3, 8], ['horsetail', 0.5, 0.6, 1.8], ['fern', 1, 0.5, 1.3]],
    open: [['shrub', 0.8, 0.6, 2], ['cycad', 0.5, 1, 3], ['fern', 0.8, 0.4, 1], ['flowers', 0.5, 0.3, 0.6]],
    dry: [['shrub-dry', 1, 0.4, 1.4], ['cycad', 0.3, 0.8, 2]],
    cold: [['conifer', 1, 10, 30], ['ginkgo', 0.4, 6, 15], ['fern', 0.5, 0.4, 1]],
    shore: [['palm', 0.4, 4, 12], ['fern', 1, 0.4, 1]],
  }, {
    reef: [['coral', 1, 0.4, 1.6], ['coral-mound', 0.6, 0.5, 1.5], ['seagrass', 0.5, 0.3, 0.8], ['sponge', 0.3, 0.3, 0.9]],
    shelf: [['seagrass', 0.6, 0.3, 0.7], ['sponge', 0.3, 0.3, 0.8]],
  }),
  E(66, 23, {
    forest: [['broadleaf', 1, 12, 32], ['broadleaf-light', 0.6, 8, 20], ['palm', 0.4, 6, 15], ['conifer', 0.4, 10, 30], ['fern', 0.6, 0.5, 1.2], ['shrub', 0.5, 0.6, 2]],
    wet: [['palm', 0.8, 6, 16], ['broadleaf', 0.6, 10, 25], ['fern', 1, 0.5, 1.3]],
    open: [['shrub', 1, 0.6, 2.2], ['broadleaf-light', 0.3, 5, 12], ['flowers', 0.6, 0.3, 0.6], ['grass', 0.3, 0.3, 0.6]],
    dry: [['shrub-dry', 1, 0.4, 1.4]],
    cold: [['conifer', 1, 10, 30], ['broadleaf-light', 0.5, 6, 15]],
    shore: [['palm', 0.6, 5, 14], ['shrub', 0.5, 0.5, 1.5]],
  }, {
    reef: [['coral', 1, 0.4, 1.6], ['coral-mound', 0.6, 0.5, 1.5], ['seagrass', 0.6, 0.3, 0.8]],
    shelf: [['seagrass', 0.6, 0.3, 0.7]],
  }),
  E(23, 0.0117, {
    forest: [['broadleaf', 1, 12, 30], ['broadleaf-light', 0.7, 8, 20], ['conifer', 0.5, 10, 30], ['shrub', 0.5, 0.6, 2], ['fern', 0.4, 0.5, 1.1]],
    wet: [['broadleaf', 0.6, 10, 25], ['palm', 0.5, 6, 15], ['grass', 0.8, 0.5, 1.2]],
    open: [['grass', 1.6, 0.35, 0.9], ['grass-dry', 0.6, 0.35, 0.9], ['savanna-tree', 0.15, 5, 10], ['shrub', 0.3, 0.6, 1.8], ['flowers', 0.4, 0.3, 0.6]],
    meadow: [['grass', 1.8, 0.3, 0.8], ['flowers', 0.5, 0.3, 0.6], ['shrub', 0.4, 0.6, 1.8], ['broadleaf-light', 0.2, 8, 18], ['conifer', 0.05, 10, 25]],
    dry: [['grass-dry', 1, 0.3, 0.7], ['shrub-dry', 0.6, 0.4, 1.3]],
    cold: [['spruce', 1, 8, 25], ['grass', 0.8, 0.2, 0.5], ['shrub-dry', 0.4, 0.3, 0.8]],
    shore: [['grass', 1, 0.3, 0.8], ['palm', 0.2, 5, 12]],
  }, {
    reef: [['coral', 1, 0.4, 1.8], ['coral-mound', 0.6, 0.5, 1.8], ['seagrass', 0.6, 0.3, 0.8], ['sponge', 0.2, 0.3, 0.8]],
    shelf: [['seagrass', 0.6, 0.3, 0.7], ['kelp', 0.6, 4, 12]],
  }),
  E(0.0117, -250, {
    forest: [['broadleaf', 1, 12, 30], ['broadleaf-light', 0.7, 8, 20], ['conifer', 0.5, 10, 30], ['shrub', 0.5, 0.6, 2], ['fern', 0.4, 0.5, 1.1], ['flowers', 0.2, 0.3, 0.5]],
    wet: [['broadleaf', 0.6, 10, 25], ['palm', 0.5, 6, 15], ['grass', 0.8, 0.5, 1.2]],
    open: [['grass', 1.6, 0.35, 0.9], ['grass-dry', 0.5, 0.35, 0.9], ['savanna-tree', 0.12, 5, 10], ['shrub', 0.3, 0.6, 1.8], ['flowers', 0.5, 0.3, 0.6]],
    meadow: [['grass', 1.8, 0.3, 0.8], ['flowers', 0.6, 0.3, 0.6], ['shrub', 0.4, 0.6, 1.8], ['broadleaf-light', 0.2, 8, 18], ['conifer', 0.05, 10, 25]],
    dry: [['grass-dry', 1, 0.3, 0.7], ['shrub-dry', 0.6, 0.4, 1.3]],
    cold: [['spruce', 1, 8, 25], ['grass', 0.8, 0.2, 0.5], ['shrub-dry', 0.4, 0.3, 0.8]],
    shore: [['grass', 1, 0.3, 0.8], ['palm', 0.2, 5, 12]],
  }, {
    reef: [['coral', 1, 0.4, 1.8], ['coral-mound', 0.6, 0.5, 1.8], ['seagrass', 0.6, 0.3, 0.8]],
    shelf: [['seagrass', 0.6, 0.3, 0.7], ['kelp', 0.6, 4, 12]],
  }),
];

// Biomes missing from an era's table fall back to these.
export const BIOME_FALLBACK = { meadow: 'open', shore: 'open', wet: 'forest', cold: 'forest', dry: 'open' };

export function floraAt(ageMa) {
  return FLORA.find((e) => ageMa <= e.from && ageMa > e.to) ?? FLORA[FLORA.length - 1];
}

// Plants per m² for each biome at full vegetation cover (scaled by quality and cover).
export const DENSITY = {
  forest: { tree: 0.012, ground: 0.25 },
  wet: { tree: 0.01, ground: 0.35 },
  open: { tree: 0.0008, ground: 0.6 },
  meadow: { tree: 0.0006, ground: 0.7 },
  dry: { tree: 0.0002, ground: 0.05 },
  cold: { tree: 0.004, ground: 0.25 },
  shore: { tree: 0.001, ground: 0.3 },
  reef: { tree: 0, ground: 0.25 },
  shelf: { tree: 0, ground: 0.08 },
};

// Models that count as trees (tall, sparse) vs ground cover.
export const TREE_MODELS = new Set(['archaeopteris', 'lycopsid', 'calamites', 'tree-fern', 'glossopteris', 'conifer-early', 'conifer', 'spruce', 'araucaria', 'ginkgo', 'broadleaf', 'broadleaf-light', 'palm', 'savanna-tree', 'kelp']);
