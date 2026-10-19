// Map labels through time. `anchors` are present-day lat/lon points that are reconstructed
// with the PALEOMAP plate model and averaged (≤ 750 Ma); `at` gives fixed positions on the
// globe at given ages (used beyond the plate model, e.g. on the speculative slices).
// Age ranges follow common usage in the literature; the older ones are debated.

export const LABELS = [
  // Supercontinents and major continental assemblies
  { name: 'Vaalbara', kind: 'super', from: 3300, to: 2800, conf: 'speculative', at: [[3300, -20, 30]], note: 'Proposed Kaapvaal–Pilbara supercraton' },
  { name: 'Ur', kind: 'super', from: 3050, to: 2900, conf: 'speculative', at: [[3000, 0, 60]] },
  { name: 'Kenorland', kind: 'super', from: 2720, to: 2450, conf: 'speculative', at: [[2700, 20, 0], [2450, 25, -10]] },
  { name: 'Columbia (Nuna)', kind: 'super', from: 1850, to: 1450, conf: 'speculative', at: [[1750, 25, 15], [1500, 20, 15]] },
  { name: 'Rodinia', kind: 'super', from: 1050, to: 760, conf: 'modeled', at: [[1000, -15, 60], [900, -20, 70], [800, -10, 70], [760, -5, 60]] },
  { name: 'Pannotia', kind: 'super', from: 630, to: 575, conf: 'modeled', anchors: [[0, 20], [-10, -55], [55, -95]], note: 'Short-lived and debated' },
  { name: 'Gondwana', kind: 'super', from: 550, to: 180, conf: 'modeled', anchors: [[-5, 20], [-15, -55], [-25, 135], [-80, 60]] },
  { name: 'Laurentia', kind: 'continent', from: 1000, to: 420, conf: 'modeled', anchors: [[50, -95]] },
  { name: 'Baltica', kind: 'continent', from: 600, to: 420, conf: 'modeled', anchors: [[60, 30]] },
  { name: 'Siberia', kind: 'continent', from: 600, to: 260, conf: 'modeled', anchors: [[65, 105]] },
  { name: 'Euramerica', kind: 'continent', from: 420, to: 330, conf: 'modeled', anchors: [[50, -95], [60, 30]] },
  { name: 'Pangaea', kind: 'super', from: 335, to: 175, conf: 'modeled', anchors: [[0, 20], [50, 30], [-15, -55], [45, -95]] },
  { name: 'Laurasia', kind: 'continent', from: 175, to: 60, conf: 'modeled', anchors: [[50, -95], [55, 60]] },
  { name: 'India', kind: 'continent', from: 130, to: 45, conf: 'well', anchors: [[20, 78]] },
  { name: 'Novopangaea?', kind: 'super', from: -150, to: -250, conf: 'speculative', anchors: [[0, 20], [55, 80], [-25, 135]], note: 'One possible future supercontinent (extrapolated motions)' },

  // Present-day continents (recent past and near future)
  { name: 'Africa', kind: 'continent', from: 40, to: -30, conf: 'well', anchors: [[5, 20]] },
  { name: 'Eurasia', kind: 'continent', from: 40, to: -30, conf: 'well', anchors: [[55, 75]] },
  { name: 'North America', kind: 'continent', from: 40, to: -30, conf: 'well', anchors: [[45, -100]] },
  { name: 'South America', kind: 'continent', from: 40, to: -30, conf: 'well', anchors: [[-12, -58]] },
  { name: 'Australia', kind: 'continent', from: 40, to: -30, conf: 'well', anchors: [[-25, 134]] },
  { name: 'Antarctica', kind: 'continent', from: 40, to: -30, conf: 'well', anchors: [[-80, 40]] },

  // Oceans
  { name: 'Mirovia', kind: 'ocean', from: 1000, to: 760, conf: 'modeled', at: [[1000, 20, -120], [760, 15, -120]], note: 'Superocean around Rodinia' },
  { name: 'Iapetus Ocean', kind: 'ocean', from: 600, to: 420, conf: 'modeled', anchors: [[50, -95], [60, 30], [0, 20]] },
  { name: 'Rheic Ocean', kind: 'ocean', from: 480, to: 320, conf: 'modeled', anchors: [[45, -80], [10, 5]] },
  { name: 'Panthalassa', kind: 'ocean', from: 330, to: 180, conf: 'modeled', anchors: [[0, -160]] },
  { name: 'Tethys Ocean', kind: 'ocean', from: 270, to: 40, conf: 'modeled', anchors: [[30, 40], [10, 75]] },
  { name: 'Atlantic Ocean', kind: 'ocean', from: 150, to: -30, conf: 'well', anchors: [[0, 10], [-5, -40]] },
  { name: 'Indian Ocean', kind: 'ocean', from: 100, to: -30, conf: 'well', anchors: [[-15, 75]] },
  { name: 'Pacific Ocean', kind: 'ocean', from: 180, to: -30, conf: 'well', anchors: [[0, -150]] },
];
