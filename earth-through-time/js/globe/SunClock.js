// Visual day/season clock. The Earth stays fixed in the planet frame; the Sun direction
// rotates once per (visual) day and follows the seasonal declination.

import * as THREE from 'three';
import { AXIAL_TILT } from './constants.js';

export class SunClock {
  constructor() {
    this.direction = new THREE.Vector3(1, 0, 0);
    this.days = 0.42;           // days since an arbitrary epoch (fraction = time of day, UTC)
    this.daysPerYear = 365.25;  // updated from day-length history (Phase 4)
    this.secondsPerDay = 90;    // real seconds per visual day
    this.running = true;
    this.timeScale = 1;         // slowed while exploring on the ground
    this.tourScale = 1;         // slowed during the guided tour so views hold still
    this.seasonLock = 0.25;     // fraction of year to hold the season at (null = advance)
    this.hourAngle = 0;         // subsolar longitude (radians), used to rotate the starfield
  }

  update(dt) {
    if (this.running) this.days += (dt * this.timeScale * this.tourScale) / this.secondsPerDay;
    const dayFrac = this.days - Math.floor(this.days);
    const subsolarLon = (0.5 - dayFrac) * Math.PI * 2;
    const yearFrac = this.seasonLock ?? ((this.days / this.daysPerYear) % 1);
    // yearFrac 0 ≈ March equinox.
    const decl = Math.asin(Math.sin(AXIAL_TILT) * Math.sin(yearFrac * Math.PI * 2));
    const c = Math.cos(decl);
    this.direction.set(c * Math.sin(subsolarLon), Math.sin(decl), c * Math.cos(subsolarLon));
    this.hourAngle = subsolarLon;
    return this.direction;
  }

  /** Set the clock so the Sun is overhead at longitude `lon` (degrees). */
  setSubsolarLongitude(lonDeg) {
    const frac = 0.5 - lonDeg / 360;
    this.days = Math.floor(this.days) + ((frac % 1) + 1) % 1;
  }
}
