// Vertex-side logarithmic depth. Same mapping as three.js's logarithmicDepthBuffer
// (depth = log2(1 + w) · logDepthBufFC / 2) but without writing gl_FragDepth, which would turn
// off early depth rejection. Used for the terrain surface, ocean, plants and animals so hidden
// fragments are rejected before shading; their triangles are small enough that linear
// interpolation of the log depth is accurate. Terrain skirts (tall, thin triangles), the sky,
// globe and Moon keep three's exact per-fragment depth.

export const logDepthParsVertex = /* glsl */ `
uniform float logDepthBufFC;
`;

export const logDepthVertex = /* glsl */ `
  gl_Position.z = (log2(max(1e-6, 1.0 + gl_Position.w)) * logDepthBufFC - 1.0) * gl_Position.w;
`;
