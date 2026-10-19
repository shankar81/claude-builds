// Sun shadows near the camera (js/dive/SunShadows.js): one orthographic depth map rendered from
// the Sun, sampled with a small PCF kernel of hardware-filtered depth comparisons by the
// terrain, plants and animals.

export const shadowGLSL = /* glsl */ `
uniform highp sampler2DShadow uShadowMap;
uniform mat4 uShadowMatrix;  // world (camera-relative) → shadow map uv + depth
uniform float uShadowOn;
uniform vec2 uShadowTexel;   // 1 / map size
uniform float uShadowTexelM; // one shadow texel in metres

// 1 = fully lit, 0 = in shadow. N is the surface normal facing the viewer side being lit.
float sunShadow(vec3 worldPos, vec3 N, vec3 L) {
  if (uShadowOn < 0.5) return 1.0;
  float ndl = clamp(dot(N, L), 0.0, 1.0);
  // Normal offset (in texels) against acne on grazing surfaces.
  vec3 p = worldPos + N * uShadowTexelM * (0.6 + 1.6 * (1.0 - ndl));
  vec4 sc = uShadowMatrix * vec4(p, 1.0);
  vec3 s = sc.xyz;
  if (s.x <= 0.0 || s.y <= 0.0 || s.x >= 1.0 || s.y >= 1.0 || s.z >= 1.0) return 1.0;
  float bias = 0.00012;
  float sum = 0.0;
  // 12-tap rotated grid: soft edges at about two texels.
  vec2 off[12];
  off[0] = vec2(-1.5, -0.5); off[1] = vec2(-0.5, -1.5); off[2] = vec2(0.5, -1.5); off[3] = vec2(1.5, -0.5);
  off[4] = vec2(1.5, 0.5); off[5] = vec2(0.5, 1.5); off[6] = vec2(-0.5, 1.5); off[7] = vec2(-1.5, 0.5);
  off[8] = vec2(-0.5, -0.5); off[9] = vec2(0.5, -0.5); off[10] = vec2(0.5, 0.5); off[11] = vec2(-0.5, 0.5);
  for (int i = 0; i < 12; i++) sum += texture(uShadowMap, vec3(s.xy + off[i] * uShadowTexel, s.z - bias));
  float sh = sum / 12.0;
  // Fade out toward the edge of the map so its border never shows.
  vec2 e = min(s.xy, 1.0 - s.xy);
  return mix(1.0, sh, smoothstep(0.0, 0.1, min(e.x, e.y)));
}
`;
