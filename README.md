# Claude Builds

Interactive science explorers built with Claude, hosted on GitHub Pages.

**Live site:** https://shankar81.github.io/claude-builds/

| Project | Live link | What it is |
| --- | --- | --- |
| Earth Through Time | [/earth-through-time/](https://shankar81.github.io/claude-builds/earth-through-time/) | A 3D globe of 4.5 billion years of Earth history: drifting continents, climate, life and guided tours. |
| Anatomy Explorer | [/anatomy-explorer/](https://shankar81.github.io/claude-builds/anatomy-explorer/) | A 3D human body with 3,293 structures you can peel, pull apart and search. |

Each project is a static site (HTML, JavaScript, WebGL). There is no build step: GitHub Pages serves the files as they are.

## Folder layout

```
index.html            portfolio page
assets/               screenshots and the link-preview image
earth-through-time/   Earth Through Time app
anatomy-explorer/     Anatomy Explorer app
```

## Data and licences

**Earth Through Time** uses PALEOMAP PaleoDEMs and plate model (Scotese & Wright, CC BY 4.0), the MERDITH2021 plate model (CC BY 4.0), the Paleobiology Database (CC BY 4.0), NASA Blue Marble, Black Marble and LRO imagery (public domain), NOAA ETOPO1 (public domain) and the International Chronostratigraphic Chart. The app's Credits screen lists every source.

**Anatomy Explorer** model data (`anatomy-explorer/models/`) is adapted from [Z-Anatomy](https://github.com/LluisV/Z-Anatomy) (CC BY-SA 4.0), which is partly derived from BodyParts3D (© The Database Center for Life Science, CC BY-SA 2.1 JP). Body-type shapes were measured from [MakeHuman](https://github.com/makehumancommunity/makehuman) (CC0). The derived model data is shared under CC BY-SA 4.0; see `anatomy-explorer/models/LICENSE.txt`. It is for education only and is not a medical device.
