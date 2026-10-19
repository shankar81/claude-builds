# Anatomy Explorer: modesty pass

Edits the Anatomy Explorer model files in place so the body suits a general audience:

- The external genitalia ("urogenital region" skin and its fat layer) are replaced by a smooth surface
  fitted to the skin around them.
- Pubic hair, the penis, testes and epididymides, and the arteries and veins of the penis are removed.
- Vessels, ducts and nerves that ran into them are trimmed where they would cross the new surface.
- The manifest drops the removed parts and gets updated bounds and triangle counts.

`patch-app.mjs` makes two matching edits to the app code (both already made in this repo):

- The Female body type no longer reshapes the genital area, which rebuilt a bulge on the new surface.
- Groin vertices blend smoothly between the left and right thigh instead of switching sides 5 mm from
  the midline. The hard switch tore the new surface on the Elderly and other reshaped body types.

Run the model step only on the original, unmodified models (for example after re-exporting the app);
the code step is safe to repeat:

```
npm install
npm run dry-run   # prints what would change in the models
npm run apply     # writes the model files and manifest, then patches the app code
```
