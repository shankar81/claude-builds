// Floating origin: the render camera always sits at (0,0,0). Every frame, objects that live
// in the planet-fixed world frame are positioned at (worldPosition − cameraWorldPosition),
// computed in float64 on the CPU, so vertex data near the camera keeps full float32 precision
// whether the camera is 40 000 km out or 2 m above the ground.

import * as THREE from 'three';

export class FloatingOrigin {
  constructor() {
    /** Camera position in the planet-fixed frame (metres, float64). */
    this.origin = new THREE.Vector3();
    this.tracked = new Set();
  }

  /**
   * Track an Object3D whose true position is `worldPosition` (a Vector3 the caller may mutate).
   * Children of a tracked object are expressed relative to it and need no tracking.
   */
  track(object, worldPosition = new THREE.Vector3()) {
    const entry = { object, worldPosition };
    this.tracked.add(entry);
    return entry;
  }

  untrack(entry) {
    this.tracked.delete(entry);
  }

  /** Call once per frame after the camera has moved. */
  update(cameraWorldPosition) {
    this.origin.copy(cameraWorldPosition);
    for (const { object, worldPosition } of this.tracked) {
      object.position.set(
        worldPosition.x - this.origin.x,
        worldPosition.y - this.origin.y,
        worldPosition.z - this.origin.z,
      );
    }
  }

  /** Convert a planet-frame position to render space. */
  toRender(world, out = new THREE.Vector3()) {
    return out.set(world.x - this.origin.x, world.y - this.origin.y, world.z - this.origin.z);
  }

  toWorld(render, out = new THREE.Vector3()) {
    return out.set(render.x + this.origin.x, render.y + this.origin.y, render.z + this.origin.z);
  }
}
