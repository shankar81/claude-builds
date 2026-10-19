// Planet surface shader, used by the orbit globe mesh and (Phase 9) the terrain chunks.
// Everything is derived per fragment from the planet-frame direction, so the same material
// works on any tessellation of the sphere.

import { commonGLSL } from './common.js';
import { atmosphereGLSL } from './atmosphere.js';
import { surfaceGLSL, oceanAlbedoGLSL } from './surface.js';
import { paleoGLSL } from './paleo.js';
import { logDepthParsVertex, logDepthVertex } from './logDepth.js';

export const planetVertex = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform vec3 uCamPos;
varying vec3 vPlanetPos;
varying vec3 vRel;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0); // render space = camera-relative
  vRel = wp.xyz;
  vPlanetPos = wp.xyz + uCamPos;
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}
`;

// Terrain chunks (js/terrain): sphere position + height displacement, geometric normals and
// periodic detail coordinates. The fragment shader is planetFragment compiled with TERRAIN.
export const terrainVertex = /* glsl */ `
#define IS_VERTEX
#include <common>
#ifdef EXACT_DEPTH
#include <logdepthbuf_pars_vertex>
#else
${logDepthParsVertex}
#endif
${commonGLSL}
uniform float uPlanetR;
uniform float uRelief;
uniform float uTimeSec;
${oceanAlbedoGLSL}
${paleoGLSL}
uniform vec3 uCamPos;
uniform float uDisplace;
uniform float uUnderwater;
varying vec3 vPaleoAlbedo;
varying vec3 vPaleoNormal;
varying vec3 vPaleoEmission;
varying vec3 vPaleoMisc;
attribute vec3 aDir;
attribute float aHeight;
attribute vec3 aNormalG;
attribute vec3 aDetail;
varying vec3 vPlanetPos;
varying vec3 vRel;
varying float vHeight;
varying vec3 vNormalG;
varying vec3 vDetail;
varying vec3 vDetailFlat;
void main() {
  vec3 p = position + aDir * (aHeight * uDisplace);
  vec4 wp = modelMatrix * vec4(p, 1.0);
  // Seen from above the water, the sea floor a few km away is hidden by the (opaque) sea.
  // Sink it further so the interpolated log depth of large distant tiles can never place it in
  // front of the sea surface.
  if (uUnderwater < 0.5 && aHeight < -0.5) {
    float sink = smoothstep(1500.0, 4000.0, length(wp.xyz));
    p += aDir * (aHeight * 40.0 - 400.0) * sink * uDisplace;
    wp = modelMatrix * vec4(p, 1.0);
  }
  vRel = wp.xyz;
  vPlanetPos = wp.xyz + uCamPos;
  vHeight = aHeight;
  vNormalG = aNormalG;
  // Deep-time surface (albedo, ice, relief normal …) varies over kilometres: per vertex.
  vPaleoAlbedo = vec3(0.0);
  vPaleoNormal = aDir;
  vPaleoEmission = vec3(0.0);
  vPaleoMisc = vec3(0.0);
#ifndef SHADOW_DEPTH
  if (uPaleoWeight > 0.0) {
    PaleoSurface ps = paleoSurface(aDir, dirToUv(aDir), asin(clamp(aDir.y, -1.0, 1.0)), uRelief);
    vPaleoAlbedo = ps.albedo;
    vPaleoNormal = ps.normal;
    vPaleoEmission = ps.emission;
    vPaleoMisc = vec3(ps.water, ps.height, ps.ice);
  }
#endif
  vDetail = aDetail; // follows the displaced surface (used on steep slopes)
  vDetailFlat = aDetail - aDir * aHeight; // projected onto the sea-level sphere
  gl_Position = projectionMatrix * viewMatrix * wp;
#if defined(EXACT_DEPTH)
  #include <logdepthbuf_vertex>
#elif !defined(SHADOW_DEPTH)
${logDepthVertex}
#endif
}
`;

export const planetFragment = /* glsl */ `
#include <common>
#if !defined(TERRAIN) || defined(EXACT_DEPTH)
#include <logdepthbuf_pars_fragment>
#endif
${commonGLSL}
${atmosphereGLSL}
${surfaceGLSL}

varying vec3 vPlanetPos;
varying vec3 vRel;

void main() {
#if !defined(TERRAIN) || defined(EXACT_DEPTH)
  #include <logdepthbuf_fragment>
#endif
  vec3 n0 = normalize(vPlanetPos);
  float tSurf = length(vRel);
  vec3 rd = vRel / tSurf;
  vec3 V = -rd;
  // Under water, anything beyond ~160 m is lost in the fog: skip shading it.
  if (uUnderwater > 0.5 && tSurf > 160.0) {
    gl_FragColor = vec4(waterFogColor(rd, uCamDepth), 1.0);
    return;
  }

  vec3 color = shadeSurface(n0, V, rd, tSurf);

#ifdef TERRAIN
  if (vHeight < 0.0 && uTerrainBlend > 0.0) {
    // Sunlight reaching the sea floor: red is absorbed first; caustics in shallow water.
    float d = -vHeight;
    vec3 absorb = exp(-vec3(0.35, 0.07, 0.05) * d * 0.5);
    float c1 = 1.0 - abs(detailNoise(vDetail + vec3(uTimeSec * 0.4, 0.0, uTimeSec * 0.3), 3.0));
    float c2 = 1.0 - abs(detailNoise(vDetail + vec3(-uTimeSec * 0.3, uTimeSec * 0.2, 0.0) + 11.0, 2.0));
    float ca = pow(c1, 8.0) + pow(c2, 8.0);
    color *= mix(vec3(1.0), absorb * (1.0 + 2.5 * ca * exp(-d / 10.0)), uTerrainBlend);
  }
#endif
  if (uUnderwater > 0.5) {
    // Camera under water: no air between us and the sea floor, only water fog.
    gl_FragColor = vec4(mix(color, waterFogColor(rd, uCamDepth), 1.0 - exp(-tSurf * 0.035)), 1.0);
    return;
  }
  vec3 T;
  // Near the camera the air path is short: a few samples are enough (2 at 1 km, all by ~30 km).
  int steps = int(clamp(2.0 + tSurf / 3000.0, 2.0, 32.0));
  vec3 inscatter = scatterN(uCamPos, rd, tSurf, T, steps);
  gl_FragColor = vec4(color * T + inscatter, 1.0);
}
`;
