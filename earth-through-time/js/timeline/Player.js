// Playback and animated jumps of geological time (store.timeMa).

import { store } from '../core/store.js';
import { advance, ageToS, sToAge, clampAge, FUTURE_LIMIT_MA, EARTH_AGE_MA } from './timeScale.js';
import { reducedMotion } from '../core/settings.js';

export const SPEEDS = [0.05, 0.1, 0.25, 0.5, 1, 2, 4];

export class Player {
  /** @param getSpan returns the visible timeline window width (s-units). */
  constructor(getSpan = () => undefined) {
    this.getSpan = getSpan;
    this.tween = null;
    this.direction = 1; // +1 toward the future, −1 toward the past
  }

  play() {
    const t = store.state.timeMa;
    // Restart from the beginning if parked at an end.
    if (this.direction > 0 && t <= FUTURE_LIMIT_MA + 1e-9) store.set({ timeMa: EARTH_AGE_MA });
    if (this.direction < 0 && t >= EARTH_AGE_MA - 1e-9) store.set({ timeMa: 0 });
    this.tween = null;
    store.set({ playing: true });
  }

  pause() {
    store.set({ playing: false });
  }

  toggle() {
    if (store.state.playing) this.pause();
    else this.play();
  }

  setSpeed(speed) {
    store.set({ speed });
  }

  /** Jump to an age, animated in timeline space unless reduced motion is on. */
  jumpTo(ageMa, duration = 1.4) {
    ageMa = clampAge(ageMa);
    this.cancel(); // a new jump replaces (and settles) any jump in progress
    if (reducedMotion() || duration <= 0) {
      store.set({ timeMa: ageMa });
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.tween = { s0: ageToS(store.state.timeMa), s1: ageToS(ageMa), t: 0, duration, resolve };
    });
  }

  /** Stop an animated jump where it is (its promise resolves). */
  cancel() {
    const tw = this.tween;
    this.tween = null;
    tw?.resolve();
  }

  /** Step by a fraction of the visible timeline window (keyboard , and .). */
  step(sign, windowWidth) {
    const s = ageToS(store.state.timeMa) + sign * windowWidth * 0.01;
    store.set({ timeMa: clampAge(sToAge(s)) });
  }

  update(dt) {
    if (this.tween) {
      const tw = this.tween;
      tw.t = Math.min(1, tw.t + dt / tw.duration);
      const e = tw.t < 0.5 ? 4 * tw.t ** 3 : 1 - (-2 * tw.t + 2) ** 3 / 2;
      store.set({ timeMa: clampAge(sToAge(tw.s0 + (tw.s1 - tw.s0) * e)) });
      if (tw.t >= 1) {
        this.tween = null;
        tw.resolve();
      }
      return;
    }
    if (!store.state.playing) return;
    const prev = store.state.timeMa;
    let next = advance(prev, dt, store.state.speed * this.direction, this.getSpan());
    // Stop at "Today" when arriving from the past; pressing play again continues into the future.
    if (this.direction > 0 && prev > 0 && next <= 0) {
      store.set({ timeMa: 0 });
      this.pause();
      return;
    }
    store.set({ timeMa: next });
    if ((this.direction > 0 && next <= FUTURE_LIMIT_MA) || (this.direction < 0 && next >= EARTH_AGE_MA)) this.pause();
  }
}
