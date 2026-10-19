// The "true" camera: position (float64, planet-fixed frame, metres) and orientation.
// The THREE.PerspectiveCamera it drives always stays at the render origin (floating origin).

import * as THREE from 'three';
import { PLANET_RADIUS } from './constants.js';

const _m = new THREE.Matrix4();
const _zero = new THREE.Vector3();

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.position = new THREE.Vector3(0, 0, PLANET_RADIUS * 3.2);
    this.quaternion = new THREE.Quaternion();
    this.fov = camera.fov;
  }

  /** Orient the camera to look from `this.position` at a planet-frame point. */
  lookAt(target, up) {
    const dir = new THREE.Vector3().subVectors(target, this.position);
    _m.lookAt(_zero, dir, up); // Matrix4.lookAt(eye, target, up): camera −Z points from eye to target
    this.quaternion.setFromRotationMatrix(_m);
  }

  get altitude() {
    return this.position.length() - PLANET_RADIUS;
  }

  /** Unit vector from the planet centre through the camera. */
  get up() {
    return this.position.clone().normalize();
  }

  forward(out = new THREE.Vector3()) {
    return out.set(0, 0, -1).applyQuaternion(this.quaternion);
  }

  /** Push position/orientation into the render camera (which stays at the origin). */
  sync() {
    const cam = this.camera;
    cam.position.set(0, 0, 0);
    cam.quaternion.copy(this.quaternion);
    if (cam.fov !== this.fov) {
      cam.fov = this.fov;
      cam.updateProjectionMatrix();
    }
    cam.updateMatrixWorld(true);
  }
}
