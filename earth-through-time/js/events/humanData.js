// Human dispersal routes, early farming centres and first cities.
// Routes: present-day [lat, lon] waypoints with the age (Ma) at which people reached each one.
// Dates are rounded from the archaeological and genetic literature and carry real uncertainty.

export const ROUTES = [
  {
    id: 'erectus', label: 'Homo erectus leaves Africa', species: 'Homo erectus', color: '#ffb36b',
    sources: ['Lordkipanidze et al. (2013) Science 342, 326 (Dmanisi)', 'Zhu et al. (2018) Nature 559, 608 (Shangchen, 2.1 Ma)'],
    points: [[3.0, 36.0, 2.0], [12.0, 40.0, 1.95], [31.0, 35.5, 1.9], [41.3, 44.3, 1.8], [35.0, 70.0, 1.75], [34.0, 109.0, 1.65], [-7.4, 110.8, 1.5]],
  },
  {
    id: 'sapiens-south', label: 'Homo sapiens along the southern route', species: 'Homo sapiens', color: '#ffd166',
    sources: ['Nielsen et al. (2017) Nature 541, 302', 'Clarkson et al. (2017) Nature 547, 306', 'O’Connell et al. (2018) PNAS 115, 8482'],
    points: [[9.0, 38.7, 0.075], [12.6, 43.4, 0.07], [17.0, 54.0, 0.065], [25.0, 62.0, 0.062], [20.0, 73.0, 0.06], [13.0, 80.0, 0.058], [16.0, 97.0, 0.055], [3.0, 101.0, 0.053], [-6.0, 106.0, 0.052], [-8.5, 116.0, 0.051], [-8.0, 125.0, 0.05], [-12.3, 132.9, 0.048]],
  },
  {
    id: 'sapiens-europe', label: 'Into Europe', species: 'Homo sapiens', color: '#ffd166',
    sources: ['Hublin et al. (2020) Nature 581, 299 (Bacho Kiro, ~45 ka)', 'Fewlass et al. (2020) Nat. Ecol. Evol. 4, 794'],
    points: [[31.5, 35.0, 0.055], [37.0, 37.0, 0.05], [41.0, 29.0, 0.047], [42.8, 25.3, 0.045], [47.0, 16.0, 0.043], [48.5, 2.0, 0.041], [42.5, -4.0, 0.04]],
  },
  {
    id: 'sapiens-north', label: 'Across Asia to Siberia and Japan', species: 'Homo sapiens', color: '#ffd166',
    sources: ['Fu et al. (2014) Nature 514, 445 (Ust’-Ishim, 45 ka)', 'Pitulko et al. (2004) Science 303, 52 (Yana RHS, 32 ka)'],
    points: [[37.0, 37.0, 0.05], [39.0, 60.0, 0.047], [57.0, 71.0, 0.045], [52.0, 104.0, 0.042], [40.0, 116.0, 0.04], [36.0, 138.0, 0.038], [70.7, 135.4, 0.032]],
  },
  {
    id: 'americas', label: 'Across Beringia into the Americas', species: 'Homo sapiens', color: '#ffd166',
    sources: ['Bennett et al. (2021) Science 373, 1528 (White Sands, 23–21 ka)', 'Dillehay et al. (2015) PLoS ONE 10, e0141923 (Monte Verde)', 'Braje et al. (2017) Science 357, 759'],
    points: [[70.7, 135.4, 0.03], [66.0, -170.0, 0.024], [60.0, -150.0, 0.019], [55.0, -133.0, 0.017], [32.8, -106.3, 0.016], [19.0, -99.0, 0.015], [8.5, -79.0, 0.0148], [-10.0, -77.0, 0.0146], [-41.5, -73.2, 0.0145], [-53.0, -70.0, 0.012]],
  },
  {
    id: 'pacific', label: 'Voyaging into Remote Oceania', species: 'Homo sapiens', color: '#9be7ff',
    sources: ['Kirch (2017) On the Road of the Winds (2nd ed.)', 'Wilmshurst et al. (2011) PNAS 108, 1815'],
    points: [[-5.0, 150.0, 0.0035], [-17.7, 168.3, 0.003], [-18.0, 178.0, 0.0029], [-13.8, -172.0, 0.0028], [-17.5, -149.8, 0.0011], [21.0, -157.0, 0.001], [-27.1, -109.4, 0.0009], [-41.0, 174.0, 0.00075]],
  },
];

export const FARMING = [
  { name: 'Fertile Crescent', crops: 'wheat, barley, lentils; sheep, goats', at: [36.5, 40.0], ageMa: 0.0115 },
  { name: 'Yangtze & Yellow River valleys', crops: 'rice, millet; pigs', at: [32.0, 114.0], ageMa: 0.0095 },
  { name: 'Mehrgarh, Indus region', crops: 'barley, wheat; zebu cattle', at: [29.4, 67.6], ageMa: 0.009 },
  { name: 'Mesoamerica', crops: 'squash, maize, beans', at: [17.0, -97.0], ageMa: 0.0099 },
  { name: 'New Guinea highlands', crops: 'taro, banana', at: [-5.8, 144.0], ageMa: 0.0075 },
  { name: 'Andes', crops: 'potato, quinoa; llama', at: [-13.5, -72.0], ageMa: 0.008 },
  { name: 'Sahel', crops: 'sorghum, pearl millet', at: [13.0, 15.0], ageMa: 0.0055 },
  { name: 'Eastern North America', crops: 'sunflower, squash, goosefoot', at: [37.5, -87.0], ageMa: 0.005 },
];

export const CITIES = [
  { name: 'Jericho (early town)', at: [31.87, 35.44], ageMa: 0.0105 },
  { name: 'Çatalhöyük', at: [37.67, 32.83], ageMa: 0.0094 },
  { name: 'Uruk', at: [31.32, 45.64], ageMa: 0.0059 },
  { name: 'Memphis', at: [29.85, 31.25], ageMa: 0.0051 },
  { name: 'Mohenjo-daro', at: [27.33, 68.14], ageMa: 0.0046 },
  { name: 'Erlitou', at: [34.7, 112.7], ageMa: 0.0038 },
  { name: 'Teotihuacan', at: [19.69, -98.84], ageMa: 0.0021 },
  { name: 'Rome', at: [41.9, 12.5], ageMa: 0.0028 },
];

export const HUMAN_SOURCES = {
  farming: ['Larson et al. (2014) PNAS 111, 6139', 'Zeder (2011) Curr. Anthropol. 52, S221'],
  cities: ['Smith (2019) Ancient Cities (Oxford Handbooks)', 'Algaze (2008) Ancient Mesopotamia at the Dawn of Civilization'],
};

// ---- Other humans, symbols, writing ---------------------------------------------------------
// Shown as globe markers while `range` [older, younger] (Ma) contains the current time.
// `conf` uses the app's confidence levels; dates are rounded and carry real uncertainty.

/** Other human species that shared the planet with Homo sapiens. */
export const OTHER_HUMANS = [
  {
    id: 'neanderthals', name: 'Neanderthals', sci: 'Homo neanderthalensis', at: [45.0, 1.7], range: [0.4, 0.04], conf: 'well',
    summary: 'Stocky, large-brained humans of Europe and western Asia who made sophisticated stone tools, controlled fire, buried some of their dead and may have made simple ornaments and cave markings.',
    evidence: 'Hundreds of fossils (e.g. La Chapelle-aux-Saints, Shanidar), full genomes from bones. They disappeared about 41,000–39,000 years ago, after modern humans arrived. Most people with non-African ancestry carry about 1–2 % Neanderthal DNA.',
    sources: ['Higham et al. (2014) Nature 512, 306', 'Green et al. (2010) Science 328, 710', 'Prüfer et al. (2014) Nature 505, 43'],
  },
  {
    id: 'denisovans', name: 'Denisovans', sci: 'Denisovan hominins', at: [51.4, 84.7], range: [0.2, 0.03], conf: 'modeled',
    summary: 'A sister group of the Neanderthals known mostly from DNA: a finger bone, teeth and a jaw from Siberia and the Tibetan Plateau.',
    evidence: 'Genome from Denisova Cave (Altai); the Xiahe jaw from Baishiya Karst Cave, Tibet (~160,000 years). Up to ~4–6 % of the DNA of people in New Guinea and Australia is Denisovan; Tibetans inherited a high-altitude gene variant from them.',
    sources: ['Reich et al. (2010) Nature 468, 1053', 'Chen et al. (2019) Nature 569, 409', 'Huerta-Sánchez et al. (2014) Nature 512, 194'],
  },
  {
    id: 'floresiensis', name: 'Homo floresiensis', sci: 'Homo floresiensis', at: [-8.53, 120.46], range: [0.1, 0.05], conf: 'well',
    summary: 'A small human, about a metre tall, on the island of Flores, Indonesia.',
    evidence: 'Skeletons from Liang Bua cave dated to about 100,000–60,000 years ago, with stone tools until about 50,000 years ago.',
    sources: ['Brown et al. (2004) Nature 431, 1055', 'Sutikna et al. (2016) Nature 532, 366'],
  },
  {
    id: 'luzonensis', name: 'Homo luzonensis', sci: 'Homo luzonensis', at: [17.7, 121.8], range: [0.067, 0.05], conf: 'modeled',
    summary: 'A small-bodied human from Luzon in the Philippines with a surprising mix of ancient and modern features.',
    evidence: 'Teeth and bones from Callao Cave, at least 50,000–67,000 years old.',
    sources: ['Détroit et al. (2019) Nature 568, 181'],
  },
  {
    id: 'naledi', name: 'Homo naledi', sci: 'Homo naledi', at: [-26.02, 27.73], range: [0.335, 0.236], conf: 'well',
    summary: 'A small-brained human living in southern Africa at the same time as the earliest Homo sapiens.',
    evidence: 'More than 1,500 bones from the Rising Star cave system, dated to about 335,000–236,000 years ago.',
    sources: ['Berger et al. (2015) eLife 4, e09560', 'Dirks et al. (2017) eLife 6, e24231'],
  },
  {
    id: 'erectus-last', name: 'The last Homo erectus', sci: 'Homo erectus', at: [-7.1, 111.6], range: [0.117, 0.108], conf: 'modeled',
    summary: 'Homo erectus, the long-lived species that first left Africa, survived on Java until well over 100,000 years ago.',
    evidence: 'Skull caps from Ngandong on the Solo River, dated to about 117,000–108,000 years ago.',
    sources: ['Rizal et al. (2020) Nature 577, 381'],
  },
];

/** Early evidence of symbols, art and music. */
export const SYMBOL_SITES = [
  {
    id: 'blombos', name: 'Blombos Cave', at: [-34.41, 21.22], ageMa: 0.073, range: [0.1, 0.06], conf: 'well',
    summary: 'Engraved pieces of ochre and the oldest known drawing — a cross-hatched pattern in ochre crayon on stone — along with shell beads.',
    evidence: 'Engraved ochre ~100,000–73,000 years old; the drawing about 73,000 years old.',
    sources: ['Henshilwood et al. (2009) J. Hum. Evol. 57, 27', 'Henshilwood et al. (2018) Nature 562, 115'],
  },
  {
    id: 'taforalt', name: 'Grotte des Pigeons, Taforalt', at: [34.81, -2.41], ageMa: 0.082, range: [0.085, 0.06], conf: 'well',
    summary: 'Perforated sea-shell beads coloured with ochre — personal ornaments, a sign of symbolic communication.',
    evidence: 'Nassarius shell beads dated to about 82,000 years ago.',
    sources: ['Bouzouggar et al. (2007) PNAS 104, 9964'],
  },
  {
    id: 'sulawesi', name: 'Leang Karampuang, Sulawesi', at: [-4.95, 119.65], ageMa: 0.0512, range: [0.052, 0.03], conf: 'modeled',
    summary: 'A painted scene of people and a wild pig: the oldest known figurative art and the oldest evidence of storytelling in pictures.',
    evidence: 'Mineral crusts over the painting dated to at least 51,200 years ago.',
    sources: ['Oktaviana et al. (2024) Nature 631, 814'],
  },
  {
    id: 'flutes', name: 'Geissenklösterle and Hohle Fels', at: [48.4, 9.77], ageMa: 0.042, range: [0.043, 0.03], conf: 'well',
    summary: 'Flutes of bird bone and mammoth ivory — the oldest known musical instruments — and ivory figurines such as the Lion-man.',
    evidence: 'Flutes about 42,000–43,000 years old; the Lion-man from Hohlenstein-Stadel about 40,000 years old.',
    sources: ['Higham et al. (2012) J. Hum. Evol. 62, 664', 'Conard et al. (2009) Nature 460, 737'],
  },
  {
    id: 'chauvet', name: 'Chauvet Cave', at: [44.39, 4.42], ageMa: 0.036, range: [0.037, 0.02], conf: 'well',
    summary: 'Hundreds of paintings of lions, horses, rhinos and mammoths drawn with charcoal and ochre.',
    evidence: 'Radiocarbon dating of charcoal places the main phases about 36,000 and 31,000 years ago.',
    sources: ['Quiles et al. (2016) PNAS 113, 4670'],
  },
  {
    id: 'pottery', name: 'Xianrendong Cave', at: [28.72, 117.17], ageMa: 0.02, range: [0.02, 0.012], conf: 'well',
    summary: 'The oldest known pottery, made by hunter-gatherers during the last ice age, long before farming.',
    evidence: 'Sherds dated to about 20,000–19,000 years ago.',
    sources: ['Wu et al. (2012) Science 336, 1696'],
  },
  {
    id: 'gobekli', name: 'Göbekli Tepe', at: [37.22, 38.92], ageMa: 0.0116, range: [0.0117, 0.009], conf: 'well',
    summary: 'Monumental stone enclosures with carved animals, built by people at the very beginning of farming in the Fertile Crescent.',
    evidence: 'Construction from about 11,600 years ago (Pre-Pottery Neolithic A).',
    sources: ['Dietrich et al. (2012) Antiquity 86, 674', 'Schmidt (2000) Paléorient 26, 45'],
  },
];

/** Writing, money, printing and science: how ideas began to spread faster than people. */
export const IDEA_SITES = [
  {
    id: 'cuneiform', name: 'Uruk — proto-cuneiform', at: [31.32, 45.64], ageMa: 0.0052, range: [0.0053, 0.0045], conf: 'well',
    summary: 'Clay tablets recording grain, livestock and labour: writing began as bookkeeping in the first cities of Mesopotamia.',
    evidence: 'Proto-cuneiform tablets from Uruk, about 3300–3100 BCE.',
    sources: ['Nissen, Damerow & Englund (1993) Archaic Bookkeeping', 'Woods (ed.) (2010) Visible Language, Oriental Institute'],
  },
  {
    id: 'hieroglyphs', name: 'Abydos — early hieroglyphs', at: [26.18, 31.92], ageMa: 0.0052, range: [0.0053, 0.0045], conf: 'well',
    summary: 'Labels with early hieroglyphic signs in a royal tomb in Egypt, roughly as old as the first Mesopotamian writing.',
    evidence: 'Bone and ivory tags from tomb U-j, about 3250 BCE.',
    sources: ['Dreyer (1998) Umm el-Qaab I', 'Baines (2004) in The First Writing, Cambridge Univ. Press'],
  },
  {
    id: 'oracle', name: 'Anyang — oracle-bone script', at: [36.1, 114.3], ageMa: 0.00325, range: [0.0033, 0.0028], conf: 'well',
    summary: 'Questions to ancestors carved on bones and shells: the earliest Chinese writing, ancestor of today’s characters.',
    evidence: 'Inscriptions from the late Shang capital, about 1250–1050 BCE.',
    sources: ['Keightley (1978) Sources of Shang History', 'Bagley (2004) in The First Writing'],
  },
  {
    id: 'mesoamerica-writing', name: 'San Andrés — Olmec signs', at: [18.2, -93.0], ageMa: 0.00268, range: [0.0028, 0.0022], conf: 'modeled',
    summary: 'Writing was invented independently in Mesoamerica too; later Maya script recorded history, astronomy and calendars.',
    evidence: 'A cylinder seal and plaque with glyphs from about 650 BCE; Maya inscriptions from the 3rd century BCE.',
    sources: ['Pohl, Pope & von Nagy (2002) Science 298, 1984', 'Saturno, Stuart & Beltrán (2006) Science 311, 1281'],
  },
  {
    id: 'coins', name: 'Sardis — first coins', at: [38.49, 28.04], ageMa: 0.00265, range: [0.0027, 0.0022], conf: 'well',
    summary: 'Lumps of electrum stamped with a lion’s head: standard-value coins made trade between strangers easier.',
    evidence: 'Lydian coins from about 630–600 BCE, found at Sardis and Ephesus.',
    sources: ['Metcalf (ed.) (2012) The Oxford Handbook of Greek and Roman Coinage'],
  },
  {
    id: 'silk-road', name: 'Silk Roads', at: [39.65, 66.96], ageMa: 0.00215, range: [0.0022, 0.0006], conf: 'well',
    summary: 'Overland and sea routes linking China, Central Asia, India, Persia and the Mediterranean carried silk, spices, paper, religions — and diseases such as plague.',
    evidence: 'Han-dynasty records of the 2nd century BCE onward; trade goods and coins found along the routes.',
    sources: ['Hansen (2012) The Silk Road: A New History', 'Frankopan (2015) The Silk Roads'],
  },
  {
    id: 'printing', name: 'Mainz — printing press', at: [49.99, 8.27], ageMa: 0.000576, range: [0.000577, 0.00035], conf: 'well',
    summary: 'Movable-type printing in Europe (building on earlier Chinese and Korean inventions) made books cheap and spread ideas quickly.',
    evidence: 'Gutenberg’s Bible, about 1455; millions of books printed in Europe by 1500.',
    sources: ['Eisenstein (1979) The Printing Press as an Agent of Change', 'Buringh & van Zanden (2009) J. Econ. Hist. 69, 409'],
  },
  {
    id: 'science', name: 'The Scientific Revolution', at: [52.2, 0.12], ageMa: 0.000339, range: [0.00048, 0.00025], conf: 'well',
    summary: 'Measurement, experiment and mathematics changed how knowledge was made — from Copernicus’s Sun-centred system (1543) to Newton’s laws of motion and gravity (1687).',
    evidence: 'Printed works such as De revolutionibus (1543) and Principia (1687); scientific societies such as the Royal Society (1660).',
    sources: ['Shapin (1996) The Scientific Revolution', 'Wootton (2015) The Invention of Science'],
  },
];

export const HUMAN_STORY_SOURCES = {
  cognition: ['McBrearty & Brooks (2000) J. Hum. Evol. 39, 453 — symbolic behaviour emerged gradually in Africa, not in a single “revolution”'],
};
