// The narrated guided tour. Each stop:
//   ma        geological time (Ma; negative = future)
//   view      orbit camera: { at: [lat, lon] present-day place (moved with its plate to `ma`),
//             or paleo: [lat, lon] used as-is, distance (m), tilt, heading }
//   dive      Deep Dive instead of orbit: { at: [lat, lon] present-day place, heading, spawn: [[id, metres]],
//             water: true | [deepest, shallowest] m to start in the sea (else on dry land) }
//   compare   open split-screen compare with this second time
//   event     trigger an event effect (js/events/eventData.js id)
//   night     put the view on the night side
//   text      narration; {co2} {o2} {temp} {sea} {day} {moon} are filled from the planet model
// Wording is original; numbers come from the cited sources in DECISIONS.md / the model.

export const TOUR = [
  {
    id: 'giant-impact',
    title: 'A violent beginning',
    ma: 4528,
    view: { paleo: [12, 30], distance: 42000e3, tilt: 0 },
    event: 'moon-impact',
    text: 'About 4.5 billion years ago the young Earth was still partly molten. Most scientists think a Mars-sized body, often called Theia, struck it a glancing blow, and the debris thrown into orbit gathered into the Moon. The details are still debated, so this scene is a reconstruction.',
  },
  {
    id: 'first-oceans',
    title: 'Oceans and impacts',
    ma: 3950,
    view: { paleo: [10, 40], distance: 16000e3, tilt: 0 },
    text: 'Within a few hundred million years the crust had cooled and rain had filled the first oceans; tiny zircon crystals show liquid water existed very early. The Moon was much closer, about {moon} away, and a day lasted only about {day}. Many lunar craters date from frequent impacts around 4.1 to 3.8 billion years ago.',
  },
  {
    id: 'archean',
    title: 'A planet of microbes',
    ma: 3500,
    view: { paleo: [0, 60], distance: 9000e3, tilt: 0.75 },
    text: 'By 3.5 billion years ago microbes were building layered mounds called stromatolites in shallow seas. The air held almost no free oxygen; it was rich in carbon dioxide and methane, and the oceans were full of dissolved iron. Some researchers think a thin organic haze tinted the sky orange at times.',
  },
  {
    id: 'oxygen',
    title: 'The Great Oxidation',
    ma: 2400,
    view: { paleo: [-20, 10], distance: 16000e3, tilt: 0 },
    text: 'Around 2.4 billion years ago oxygen made by cyanobacteria began to build up in the air for the first time. Iron in the oceans rusted out into banded rock, and the loss of methane, a strong greenhouse gas, may have helped plunge the planet into some of its earliest known ice ages.',
  },
  {
    id: 'snowball',
    title: 'Snowball Earth',
    ma: 700,
    view: { at: [0, 20], distance: 16000e3, tilt: 0 },
    text: 'Between about 717 and 635 million years ago ice reached the tropics at least twice. Glacial rocks that formed near the old equator are the key evidence. Life survived in refuges such as thin ice, open patches of sea and hot springs, and complex life appeared soon after the thaw.',
  },
  {
    id: 'cambrian',
    title: 'The Cambrian explosion',
    ma: 508,
    dive: { at: [51.43, -116.47], heading: 0.6, spawn: [['anomalocaris', 4.5], ['marrella', 2.5], ['opabinia', 3.5]], water: [-45, -10] },
    text: 'In a geologically short time after about 538 million years ago, animals with eyes, shells, legs and guts appeared in the sea. This is the world of the Burgess Shale: Anomalocaris, a swimming predator up to about a metre long, cruises over the sea floor among small arthropods such as Marrella.',
  },
  {
    id: 'devonian',
    title: 'Fins become limbs',
    ma: 375,
    dive: { at: [77.15, -86.4], heading: 2.2, spawn: [['tiktaalik', 4], ['dunkleosteus', 14]], water: [-10, -1.5] },
    text: 'By 375 million years ago lobe-finned fish such as Tiktaalik had sturdy fins with wrist-like bones, a flexible neck and probably lungs, and could prop themselves up in shallow water. Nearby swam armoured fish like Dunkleosteus. On land the first true forests were spreading.',
  },
  {
    id: 'carboniferous',
    title: 'Coal swamps',
    ma: 305,
    dive: { at: [41.25, -88.2], heading: 1.2, spawn: [['meganeura', 9], ['arthropleura', 7]] },
    text: 'Swamp forests of tree-sized club mosses covered the tropics; their buried remains became much of the coal mined today. Oxygen made up about {o2} of the air, more than today, and Meganeura, a griffinfly with wings about 70 centimetres across, hunted over the swamps.',
  },
  {
    id: 'pangaea',
    title: 'Pangaea',
    ma: 252,
    view: { at: [5, 15], distance: 15000e3, tilt: 0 },
    compare: 0,
    text: 'By 300 to 200 million years ago almost all land was joined in one supercontinent, Pangaea, shown here beside today. About 252 million years ago vast eruptions in Siberia released carbon dioxide and triggered the worst mass extinction known: most species in the sea disappeared.',
  },
  {
    id: 'jurassic',
    title: 'Giants of the Jurassic',
    ma: 152,
    dive: { at: [39.5, -108.5], heading: 0.4, spawn: [['brachiosaurus', 50], ['stegosaurus', 17], ['allosaurus', 38]] },
    text: 'In the Late Jurassic, long-necked sauropods such as Brachiosaurus browsed the seasonally dry floodplains of western North America. Plated Stegosaurus fed on low plants, and Allosaurus was one of the top predators.',
  },
  {
    id: 'hell-creek',
    title: 'The last dinosaurs',
    ma: 67,
    dive: { at: [47.5, -106.9], heading: 1.0, spawn: [['triceratops', 18], ['tyrannosaurus', 42]] },
    text: 'Near the very end of the Cretaceous, Tyrannosaurus and Triceratops lived on a warm, wet coastal plain in what is now Montana. Flowering plants had spread across the land, and a shallow sea had only recently retreated from the middle of the continent.',
  },
  {
    id: 'kpg',
    title: 'The impact',
    ma: 66.04,
    view: { at: [21.3, -89.5], distance: 9000e3, tilt: 0.2 },
    event: 'kpg',
    text: '66 million years ago an asteroid roughly 10 kilometres wide struck near today’s Yucatán Peninsula. Dust and soot darkened the sky for years, and about three-quarters of species died out, including all dinosaurs except birds.',
  },
  {
    id: 'eocene',
    title: 'Hothouse Earth',
    ma: 52,
    view: { at: [65, 0], distance: 14000e3, tilt: 0 },
    text: 'About 50 million years ago the planet was far warmer than today, about {temp} on average in this model. There were no large ice sheets, forests grew near the poles, and relatives of crocodiles lived in the Arctic.',
  },
  {
    id: 'lgm',
    title: 'The last ice age',
    ma: 0.021,
    view: { at: [55, -40], distance: 13000e3, tilt: 0 },
    text: 'Just 21,000 years ago ice sheets up to three or four kilometres thick covered much of North America and northern Europe. So much water was locked up that sea level was about {sea} compared with today, and mammoths roamed the dry grasslands of the mammoth steppe.',
  },
  {
    id: 'today',
    title: 'Today',
    ma: 0,
    view: { at: [30, 20], distance: 13000e3, tilt: 0 },
    night: true,
    text: 'Today people have reshaped the surface of the planet, and cities glow on the night side. Carbon dioxide in the air, now about {co2}, is higher than at any time in at least 800,000 years, and global temperatures are rising.',
  },
  {
    id: 'future',
    title: 'The next supercontinent',
    ma: -250,
    view: { paleo: [0, 0], distance: 16000e3, tilt: 0 },
    text: 'Plate motions will keep rearranging the continents. Several models expect them to gather into a new supercontinent within about 250 million years. This view extrapolates today’s plate motions, so treat it as one possible future.',
  },
];

// The human journey: from the first Homo sapiens to today. {people} is the population estimate
// for the stop's time (js/events/population.js).
export const HUMAN_TOUR = [
  {
    id: 'hj-origins',
    title: 'Our species appears',
    ma: 0.3,
    view: { at: [31.85, -8.87], distance: 11000e3, tilt: 0 },
    text: 'About 300,000 years ago early Homo sapiens lived across Africa; the oldest known fossils come from Jebel Irhoud in Morocco. We were a fairly rare species then — perhaps {people} people — and one of several kinds of humans alive at the time.',
  },
  {
    id: 'hj-many',
    title: 'Not alone',
    ma: 0.1,
    view: { at: [15, 95], distance: 16000e3, tilt: 0 },
    text: 'A hundred thousand years ago the world held several human species: Neanderthals in Europe and western Asia, Denisovans in Asia, small-bodied humans on the islands of Flores and Luzon, and late Homo erectus on Java. Tap the purple markers to meet them.',
  },
  {
    id: 'hj-symbols',
    title: 'Thinking in symbols',
    ma: 0.073,
    view: { at: [-34.41, 21.22], distance: 9000e3, tilt: 0 },
    text: 'On the southern tip of Africa people engraved patterns on ochre and drew with an ochre crayon about 73,000 years ago. Popular histories sometimes call this a sudden "cognitive revolution"; the archaeological record suggests symbolic thinking built up gradually over a long time.',
  },
  {
    id: 'hj-out',
    title: 'Out of Africa',
    ma: 0.052,
    view: { at: [12, 80], distance: 16000e3, tilt: 0 },
    text: 'Between about 70,000 and 50,000 years ago small groups left Africa and spread along the coasts of southern Asia. Crossing open sea in boats or rafts, they reached Australia at least 50,000 years ago, and painted the oldest known story-scene on Sulawesi.',
  },
  {
    id: 'hj-neanderthals',
    title: 'Meeting the Neanderthals',
    ma: 0.045,
    dive: { at: [45.0, 1.7], heading: 1.2, spawn: [['neanderthal', 12], ['homo-sapiens', 22]] },
    text: 'Modern humans reached Europe about 45,000 years ago, where Neanderthals had lived for hundreds of thousands of years. The two groups interbred — most people outside Africa carry about 1–2 % Neanderthal DNA — and by about 40,000 years ago the Neanderthals were gone.',
  },
  {
    id: 'hj-ice',
    title: 'Life in the ice age',
    ma: 0.026,
    dive: { at: [48.88, 16.65], heading: 0.5, spawn: [['mammoth', 45], ['homo-sapiens', 14]] },
    text: 'In the coldest part of the last ice age people lived on the open grasslands of Europe and Asia, hunting mammoths, reindeer and horses. They sewed fitted clothes with bone needles, made figurines of fired clay and, a little later, built shelters from mammoth bones.',
  },
  {
    id: 'hj-americas',
    title: 'Into the Americas',
    ma: 0.016,
    view: { at: [35, -105], distance: 13000e3, tilt: 0 },
    text: 'People crossed from Siberia into the Americas when sea level was low. Footprints at White Sands in New Mexico suggest people were there 23,000–21,000 years ago, and by 14,500 years ago they had reached Monte Verde in southern Chile.',
  },
  {
    id: 'hj-farming',
    title: 'The first farmers',
    ma: 0.0116,
    view: { at: [36.5, 40], distance: 9000e3, tilt: 0 },
    text: 'As the ice age ended, people in the Fertile Crescent began growing wheat and barley and herding sheep and goats, and raised the stone pillars of Göbekli Tepe. Farming began independently in several other regions. It fed more people — about {people} by now — but skeletons show many early farmers were shorter and less healthy than the foragers before them.',
  },
  {
    id: 'hj-writing',
    title: 'Cities, writing and money',
    ma: 0.0052,
    view: { at: [31.32, 45.64], distance: 7000e3, tilt: 0 },
    text: 'In the first cities of Mesopotamia writing began as bookkeeping for grain, animals and labour; it was invented separately in Egypt, China and Mesoamerica too. Writing, coins and written laws let thousands of strangers trust and cooperate with one another.',
  },
  {
    id: 'hj-empires',
    title: 'Empires and the Silk Roads',
    ma: 0.002,
    view: { at: [35, 65], distance: 15000e3, tilt: 0 },
    text: 'Two thousand years ago the Roman and Han empires each ruled roughly 50–60 million people, linked by the Silk Roads that carried silk, spices, paper, religions and diseases across Eurasia. The whole world held about {people} people.',
  },
  {
    id: 'hj-science',
    title: 'Science and industry',
    ma: 0.00034,
    view: { at: [50, 5], distance: 9000e3, tilt: 0 },
    text: 'From the 1500s printing and the Scientific Revolution changed how knowledge grew: careful measurement and experiment began to replace ancient authority. From around 1800, coal-powered industry started the fastest growth in human numbers and energy use in history.',
  },
  {
    id: 'hj-today',
    title: 'Eight billion',
    ma: 0,
    view: { at: [25, 40], distance: 13000e3, tilt: 0 },
    night: true,
    text: 'Today about {people} people share the planet. In a few hundred years our species has become a force that changes the climate, the oceans and the rest of life on Earth — and the only one able to study that story.',
  },
];

export const TOURS = [
  { id: 'earth', title: 'The story of Earth', blurb: '4.5 billion years in 16 stops', stops: TOUR },
  { id: 'humans', title: 'The human journey', blurb: 'From the first Homo sapiens to today, 12 stops', stops: HUMAN_TOUR },
];
