// Starfield points: size and brightness from a pseudo-magnitude, colour from temperature.

export const starsVertex = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute float aMag;
attribute vec3 aColor;
uniform float uPixelRatio;
uniform float uBrightness;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float flux = pow(10.0, -0.4 * (aMag - 1.0));
  gl_PointSize = clamp(1.2 + 2.2 * sqrt(flux), 1.0, 5.0) * uPixelRatio;
  vColor = aColor * min(flux * 2.0, 6.0) * uBrightness;
  vAlpha = 1.0;
  #include <logdepthbuf_vertex>
}
`;

export const starsFragment = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
varying vec3 vColor;
varying float vAlpha;
void main() {
  #include <logdepthbuf_fragment>
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d = dot(p, p);
  if (d > 1.0) discard;
  float a = exp(-d * 4.0);
  gl_FragColor = vec4(vColor * a, 1.0);
}
`;
