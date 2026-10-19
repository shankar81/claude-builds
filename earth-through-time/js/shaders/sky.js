// Sky shell: a back-faced sphere at the top of the atmosphere. Each fragment marches the view
// ray through the air (stopping at the planet), adds the Sun disc, clouds seen against the
// sky (limb / from the ground), and multiplies whatever is behind (stars, Moon) by the
// transmittance via blending: dst = src.rgb + dst · src.a.

import { commonGLSL } from './common.js';
import { atmosphereGLSL } from './atmosphere.js';
import { cloudsGLSL } from './clouds.js';

export const skyVertex = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vRel;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vRel = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}
`;

export const skyFragment = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
${commonGLSL}
${atmosphereGLSL}
${cloudsGLSL}
uniform float uSunAngularRadius;
uniform float uSunDiscRadiance;
varying vec3 vRel;

void main() {
  #include <logdepthbuf_fragment>
  vec3 rd = normalize(vRel);
  vec3 ro = uCamPos;
  vec2 tp = raySphere(ro, rd, uPlanetR);
  bool hitsPlanet = tp.x > 0.0;
  // Where the ray meets the planet, the surface (drawn first) already carries the aerial
  // perspective. The log-depth write disables early-z, so leave before the expensive march —
  // except for rays that only graze the planet (closest approach < 3 km below sea level), where
  // the surface meshes may stop a pixel short of the analytic horizon.
  float b = dot(ro, rd);
  float closest = sqrt(max(0.0, dot(ro, ro) - b * b));
  if (hitsPlanet && closest < uPlanetR - 3000.0) discard;
  // Grazing rays: shade them like the horizon sky they border (the far sea mirrors it).
  float tMax = 1e30;

  vec3 T;
  vec3 color = scatter(ro, rd, tMax, T);

  if (!hitsPlanet) {
    // Sun disc with limb darkening.
    float cosA = dot(rd, uSunDir);
    float cosR = cos(uSunAngularRadius);
    if (cosA > cosR) {
      float r = sqrt(max(0.0, 1.0 - cosA * cosA)) / sin(uSunAngularRadius);
      float limb = 1.0 - 0.6 * (1.0 - sqrt(max(0.0, 1.0 - r * r)));
      color += uSunRadiance * uSunDiscRadiance * limb * T;
    }
    // Clouds seen against the sky (from the ground or just above the limb).
    vec2 tc = raySphere(ro, rd, uPlanetR + uCloudAlt);
    float tCloud = tc.x > 0.0 ? tc.x : tc.y;
    if (tCloud > 0.0 && uCloudOpacity > 0.0) {
      vec3 cp = ro + rd * tCloud;
      vec3 cd = normalize(cp);
      vec2 uv = dirToUv(cd);
      vec2 dx, dy;
      seamlessGrad(uv, dx, dy);
      float c = cloudCoverage(cd, dx, dy);
      // Fade clouds at grazing distance so the horizon stays hazy.
      c *= exp(-tCloud / 250000.0);
      float mu = dot(cd, uSunDir);
      vec3 cSun = uSunRadiance * sunTransmittance(uCloudAlt, mu);
      float lit = max(mu + 0.15, 0.0);
      vec3 cloudColor = vec3(0.9) / PI * (cSun * lit + uSunRadiance * vec3(0.06, 0.08, 0.11) * smoothstep(-0.12, 0.25, mu) * PI);
      vec3 Tc;
      vec3 insC = scatter(ro, rd, tCloud, Tc);
      color = mix(color, cloudColor * Tc + insC, c);
      T *= 1.0 - c;
    }
  }
  // Eye adaptation: a bright sky hides the stars and Moon detail behind it.
  float tAvg = dot(T, vec3(0.3333)) * exp(-dot(color, vec3(0.2126, 0.7152, 0.0722)) * 25.0);
  gl_FragColor = vec4(color, tAvg);
}
`;
