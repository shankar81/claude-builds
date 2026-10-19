// Datasets, models and software credited on the Credits & Data Sources screen. Mirrors
// DECISIONS.md §2; climate-curve references are read from data/climate.json at runtime.

export const DATASETS = [
  {
    name: 'PALEOMAP PaleoDEMs (1° × 1°, 0–540 Ma every 5 Myr)',
    by: 'Scotese, C.R. & Wright, N.M. (2018)',
    url: 'https://doi.org/10.5281/zenodo.5460860',
    licence: 'CC BY 4.0',
    use: 'Ancient land and sea-floor heights, coastlines',
  },
  {
    name: 'PALEOMAP plate model (rotations, plate IDs, coastlines)',
    by: 'Scotese, C.R. (2016) PALEOMAP PaleoAtlas for GPlates, served by the GPlates Web Service (EarthByte Group, University of Sydney)',
    url: 'https://gws.gplates.org',
    licence: 'CC BY (model files); free web service for research and education',
    use: 'Continental drift between slices, “Where was my place?”, 545–750 Ma coastlines',
  },
  {
    name: 'MERDITH2021 full-plate model',
    by: 'Merdith, A.S. et al. (2021) Earth-Science Reviews 214, 103477, via the GPlates Web Service',
    url: 'https://doi.org/10.1016/j.earscirev.2020.103477',
    licence: 'CC BY 4.0',
    use: 'Rodinia-era coastlines, 750–1000 Ma',
  },
  {
    name: 'Paleobiology Database (data API v1.2)',
    by: 'The Paleobiology Database community',
    url: 'https://paleobiodb.org',
    licence: 'CC BY 4.0',
    use: 'Fossil-site markers, live site details, which creatures appear where',
  },
  {
    name: 'International Chronostratigraphic Chart (names, ages, colours)',
    by: 'International Commission on Stratigraphy, retrieved through the PBDB intervals service',
    url: 'https://stratigraphy.org/chart',
    licence: 'Free to use with citation',
    use: 'Timeline eons, eras, periods, epochs and ages',
  },
  {
    name: 'Blue Marble Next Generation (July 2004)',
    by: 'NASA Earth Observatory — Stöckli, R. et al. (2005)',
    url: 'https://visibleearth.nasa.gov/images/74092',
    licence: 'Public domain (NASA)',
    use: 'Present-day surface colour',
  },
  {
    name: 'Black Marble 2016 night lights',
    by: 'NASA Earth Observatory — Román, M.O. et al. (2018)',
    url: 'https://visibleearth.nasa.gov/images/144898',
    licence: 'Public domain (NASA)',
    use: 'City lights on the night side',
  },
  {
    name: 'Blue Marble cloud composite',
    by: 'NASA Visible Earth',
    url: 'https://visibleearth.nasa.gov/images/57747',
    licence: 'Public domain (NASA)',
    use: 'Present-day clouds',
  },
  {
    name: 'ETOPO1 global relief (ice surface)',
    by: 'NOAA National Centers for Environmental Information — Amante, C. & Eakins, B.W. (2009)',
    url: 'https://www.ncei.noaa.gov/products/etopo-global-relief-model',
    licence: 'Public domain (U.S. Government)',
    use: 'Present-day heights and depths, ice-age shorelines, Deep Dive terrain base',
  },
  {
    name: 'CGI Moon Kit (LRO LROC WAC colour mosaic)',
    by: 'NASA Scientific Visualization Studio',
    url: 'https://svs.gsfc.nasa.gov/4720',
    licence: 'Public domain (NASA)',
    use: 'The Moon',
  },
  {
    name: 'LR04 benthic δ¹⁸O stack',
    by: 'Lisiecki, L.E. & Raymo, M.E. (2005) Paleoceanography 20, PA1003',
    url: 'https://lorraine-lisiecki.com/stack.html',
    licence: 'Free for research and education with citation',
    use: 'Ice-age temperature and ice-sheet driver',
  },
  {
    name: 'Late Pleistocene sea-level stack',
    by: 'Spratt, R.M. & Lisiecki, L.E. (2016) Climate of the Past 12, 1079 (NOAA NCEI Paleoclimatology)',
    url: 'https://www.ncei.noaa.gov/products/paleoclimatology',
    licence: 'Public (NOAA World Data Service for Paleoclimatology)',
    use: 'Sea level over the last 800,000 years',
  },
  {
    name: 'Antarctic ice-core CO₂ composite',
    by: 'Bereiter, B. et al. (2015) Geophysical Research Letters 42, 542 (NOAA NCEI Paleoclimatology)',
    url: 'https://www.ncei.noaa.gov/products/paleoclimatology',
    licence: 'Public (NOAA World Data Service for Paleoclimatology)',
    use: 'CO₂ over the last 800,000 years',
  },
];

export const MODELS = [
  ['Faint young Sun', 'Gough, D.O. (1981) Solar interior structure and luminosity variations. Solar Physics 74, 21'],
  ['Sky and aerial perspective', 'Single scattering after Bruneton & Neyret (2008) and Hillaire (2020); optical depth via Schüler (2012) Chapman approximation'],
  ['Atmosphere composition', 'Pressure, CO₂, O₂/ozone and Archean organic haze from the curves below (Catling & Zahnle 2020; Lyons et al. 2014)'],
  ['Chicxulub impact', 'Steep impact from the north-east after Collins, G.S. et al. (2020) Nature Communications 11, 1480'],
  ['Moon-forming impact', 'Canup (2004); Ćuk & Stewart (2012) — shown as a reconstruction'],
  ['Snowball Earth', 'Hoffman, P.F. et al. (2017) Science Advances 3, e1600983'],
  ['Era sounds', 'Biophony limited by the fossil record (e.g. bird vocal organ: Clarke, J.A. et al. 2016, Nature 538, 502)'],
  ['Human population', 'HYDE 3.2 (Klein Goldewijk et al. 2017, Earth Syst. Sci. Data 9, 927); McEvedy & Jones (1978); UN World Population Prospects 2024; pre-farming values are order-of-magnitude ranges'],
  ['Human story', 'Dispersal, other human species, symbols, writing and science from primary archaeological and genetic studies cited on each card (e.g. Hublin et al. 2017; Higham et al. 2014; Reich et al. 2010; Henshilwood et al. 2018; Oktaviana et al. 2024; McBrearty & Brooks 2000)'],
];

export const SOFTWARE = [
  ['three.js r170', 'MIT licence', 'https://threejs.org'],
  ['GPlates (pipeline, via web service)', 'GPL; web service by EarthByte', 'https://www.gplates.org'],
  ['sharp (pipeline image processing)', 'Apache 2.0', 'https://sharp.pixelplumbing.com'],
];
