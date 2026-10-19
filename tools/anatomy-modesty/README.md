# Anatomy Explorer: modesty pass

Edits the Anatomy Explorer model files in place so the body suits a general audience:

- The external genitalia ("urogenital region" skin and its fat layer) are replaced by a smooth surface
  fitted to the skin around them.
- Pubic hair, the penis, testes and epididymides, and the arteries and veins of the penis are removed.
- Vessels, ducts and nerves that ran into them are trimmed where they would cross the new surface.
- The manifest drops the removed parts and gets updated bounds and triangle counts.

It also needs one change in the app code, already made in this repo: in
`anatomy-explorer/assets/index-*.js` the genital pattern `var Fn=/urogenital|penis|scrot|prepuce|glans/i`
is replaced with `var Fn=/(?!)/`, so the Female body type no longer reshapes that area.

Run it only on the original, unmodified models (for example after re-exporting the app):

```
npm install
npm run dry-run   # prints what would change
npm run apply     # writes the model files and manifest
```
