// Simple, believable behaviours in a group's local tangent frame (x east, y north, metres;
// z = height above ground for walkers/fliers, depth below the surface for swimmers).
// No hunting or violence: predators wander and may shadow a herd at a distance.

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);

function steerTo(m, tx, ty, speed, dt, turn = 1.5) {
  const want = Math.atan2(tx - m.x, ty - m.y);
  let d = want - m.heading;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  m.heading += Math.max(-turn * dt, Math.min(turn * dt, d));
  m.speed += (speed - m.speed) * Math.min(1, dt * 2);
}

function advance(m, dt) {
  m.x += Math.sin(m.heading) * m.speed * dt;
  m.y += Math.cos(m.heading) * m.speed * dt;
}

export const BEHAVIOURS = {
  herd(g, m, dt) {
    m.timer -= dt;
    if (m.timer <= 0 || m.tx === undefined) {
      m.state = Math.random() < 0.6 ? 'graze' : 'walk';
      m.timer = rand(3, 9);
      m.tx = g.cx + m.ox + rand(-6, 6) * g.size;
      m.ty = g.cy + m.oy + rand(-6, 6) * g.size;
    }
    if (g.flee) {
      m.state = 'walk';
      steerTo(m, m.x + g.fleeX * 50, m.y + g.fleeY * 50, g.speed * 2.2, dt, 2.5);
    } else if (m.state === 'walk') steerTo(m, m.tx, m.ty, g.speed, dt);
    else m.speed *= Math.max(0, 1 - dt * 2);
    advance(m, dt);
    m.mode = m.speed < 0.15 * g.speed ? 3 : 0;
  },
  pack(g, m, dt) {
    BEHAVIOURS.herd(g, m, dt);
    if (m.state === 'graze') m.mode = 3;
  },
  troop(g, m, dt) {
    m.timer -= dt;
    if (m.timer <= 0) {
      m.state = Math.random() < 0.5 ? 'rest' : 'walk';
      m.timer = rand(4, 12);
    }
    const leader = g.members[0];
    if (m === leader) {
      if (m.state === 'walk') {
        if (!m.tx || Math.hypot(m.tx - m.x, m.ty - m.y) < 3) {
          m.tx = g.cx + rand(-40, 40);
          m.ty = g.cy + rand(-40, 40);
        }
        steerTo(m, m.tx, m.ty, g.speed, dt);
      } else m.speed *= Math.max(0, 1 - dt * 2);
    } else {
      const k = g.members.indexOf(m);
      const bx = leader.x - Math.sin(leader.heading) * 1.6 * k + Math.cos(leader.heading) * (k % 2 ? 0.8 : -0.8);
      const by = leader.y - Math.cos(leader.heading) * 1.6 * k - Math.sin(leader.heading) * (k % 2 ? 0.8 : -0.8);
      const d = Math.hypot(bx - m.x, by - m.y);
      if (d > 0.6) steerTo(m, bx, by, Math.min(g.speed * 1.3, d), dt, 3);
      else m.speed *= Math.max(0, 1 - dt * 3);
    }
    advance(m, dt);
    m.mode = m.speed < 0.1 ? 3 : 0;
  },
  solitary(g, m, dt) {
    m.timer -= dt;
    if (m.timer <= 0 || !m.tx) {
      m.timer = rand(6, 16);
      m.state = Math.random() < 0.35 ? 'rest' : 'walk';
      const r = 60 * g.size;
      m.tx = g.cx + rand(-r, r);
      m.ty = g.cy + rand(-r, r);
      // Predators sometimes shadow a herd from a respectful distance.
      if (g.target && Math.random() < 0.5) {
        const a = Math.atan2(m.x - g.target.x, m.y - g.target.y);
        m.tx = g.target.x + Math.sin(a) * 45;
        m.ty = g.target.y + Math.cos(a) * 45;
      }
    }
    if (m.state === 'walk' && Math.hypot(m.tx - m.x, m.ty - m.y) > 2) steerTo(m, m.tx, m.ty, g.speed, dt, 0.8);
    else m.speed *= Math.max(0, 1 - dt * 1.5);
    advance(m, dt);
    m.mode = m.speed < 0.1 * g.speed ? 3 : 0;
  },
  crawler(g, m, dt) {
    m.timer -= dt;
    if (m.timer <= 0) {
      m.timer = rand(2, 6);
      m.heading += rand(-1.2, 1.2);
      m.state = Math.random() < 0.3 ? 'rest' : 'walk';
    }
    m.speed += ((m.state === 'walk' ? g.speed : 0) - m.speed) * Math.min(1, dt * 2);
    // Stay near the group centre.
    if (Math.hypot(m.x - g.cx, m.y - g.cy) > 12 * g.size + 4) steerTo(m, g.cx, g.cy, g.speed, dt, 2);
    advance(m, dt);
    m.mode = m.speed < 0.02 ? 3 : 0;
  },
  // 3D swimmers: z is depth below the sea surface (positive), clamped by the caller.
  school(g, m, dt) {
    let ax = 0, ay = 0, az = 0, cx = 0, cy = 0, cz = 0, hx = 0, hy = 0, n = 0;
    for (const o of g.members) {
      if (o === m) continue;
      const dx = o.x - m.x, dy = o.y - m.y, dz = o.z - m.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > 100 * g.size * g.size) continue;
      n++;
      cx += o.x; cy += o.y; cz += o.z;
      hx += Math.sin(o.heading); hy += Math.cos(o.heading);
      const sep = g.size * 1.2;
      if (d2 < sep * sep) {
        const inv = 1 / Math.max(0.01, Math.sqrt(d2));
        ax -= dx * inv; ay -= dy * inv; az -= dz * inv;
      }
    }
    // Wander goal for the whole school.
    if (!g.goal || Math.hypot(g.goal[0] - g.cx, g.goal[1] - g.cy) < 4) g.goal = [g.cx + rand(-60, 60), g.cy + rand(-60, 60), rand(0.2, 0.8)];
    let tx = g.goal[0], ty = g.goal[1];
    if (n) {
      tx = tx * 0.4 + (cx / n) * 0.6 + ax * 2;
      ty = ty * 0.4 + (cy / n) * 0.6 + ay * 2;
      m.heading += Math.atan2(Math.sin(Math.atan2(hx, hy) - m.heading), Math.cos(Math.atan2(hx, hy) - m.heading)) * Math.min(1, dt * 1.5);
    }
    if (g.flee) {
      tx = m.x + g.fleeX * 30;
      ty = m.y + g.fleeY * 30;
    }
    steerTo(m, tx, ty, g.speed * (g.flee ? 2 : 1), dt, 2.5);
    advance(m, dt);
    const zt = n ? (cz / n) * 0.7 + g.goal[2] * g.depthRange * 0.3 : g.goal[2] * g.depthRange;
    m.vz = (m.vz ?? 0) + ((zt - m.z) * 0.5 + az - (m.vz ?? 0)) * Math.min(1, dt * 2);
    m.z += m.vz * dt;
    m.pitch = Math.atan2(-m.vz, Math.max(0.1, m.speed)) * 0.6;
    m.mode = 1;
  },
  pod(g, m, dt) {
    BEHAVIOURS.cruise(g, m, dt, 0.6);
  },
  cruise(g, m, dt, followK = 0) {
    m.timer -= dt;
    if (m.timer <= 0 || !m.tx) {
      m.timer = rand(8, 20);
      const r = 80 * Math.max(1, g.size * 0.3);
      m.tx = g.cx + rand(-r, r);
      m.ty = g.cy + rand(-r, r);
      m.tz = rand(0.15, 0.85) * g.depthRange;
      // Curious animals sometimes pass by the diver.
      if (g.camLocal && Math.random() < 0.35) {
        m.tx = g.camLocal[0] + rand(-15, 15) * g.size * 0.2;
        m.ty = g.camLocal[1] + rand(-15, 15) * g.size * 0.2;
      }
    }
    if (followK && g.members[0] !== m) {
      const l = g.members[0];
      const k = g.members.indexOf(m);
      m.tx = l.x - Math.sin(l.heading + k) * g.size * 1.5;
      m.ty = l.y - Math.cos(l.heading + k) * g.size * 1.5;
      m.tz = l.z + Math.sin(k) * g.size * 0.5;
    }
    steerTo(m, m.tx, m.ty, g.speed, dt, 0.7);
    advance(m, dt);
    const dz = (m.tz ?? 0) - m.z;
    m.vz = (m.vz ?? 0) + (Math.max(-0.5, Math.min(0.5, dz * 0.2)) - (m.vz ?? 0)) * Math.min(1, dt);
    m.z += m.vz * dt;
    m.pitch = Math.atan2(-m.vz, Math.max(0.2, m.speed)) * 0.7;
    m.mode = 1;
  },
  drifter(g, m, dt) {
    m.timer -= dt;
    if (m.timer <= 0) {
      m.timer = rand(3, 8);
      m.heading += rand(-0.8, 0.8);
    }
    m.speed += (g.speed * 0.6 - m.speed) * Math.min(1, dt);
    if (Math.hypot(m.x - g.cx, m.y - g.cy) > 15) steerTo(m, g.cx, g.cy, g.speed, dt, 1);
    advance(m, dt);
    m.z += Math.sin(performance.now() * 0.0005 + m.phase) * dt * 0.1;
    m.pitch = Math.sin(performance.now() * 0.0004 + m.phase) * 0.1;
    m.mode = 1;
  },
  // Fliers: z is height above the ground.
  flock(g, m, dt) {
    const k = g.members.indexOf(m);
    m.orbitA = (m.orbitA ?? rand(0, TAU)) + dt * (g.speed / Math.max(10, g.orbitR)) * (k % 2 ? 1 : 0.92);
    const tx = g.cx + Math.sin(m.orbitA) * g.orbitR;
    const ty = g.cy + Math.cos(m.orbitA) * g.orbitR;
    steerTo(m, tx, ty, g.speed, dt, 1.8);
    advance(m, dt);
    const zt = g.altitude + Math.sin(m.orbitA * 2 + k) * g.altitude * 0.2;
    m.z += (zt - m.z) * Math.min(1, dt * 0.5);
    m.bank = Math.max(-0.6, Math.min(0.6, (m.headingPrev !== undefined ? Math.atan2(Math.sin(m.heading - m.headingPrev), Math.cos(m.heading - m.headingPrev)) / Math.max(dt, 1e-3) : 0) * 0.5));
    m.headingPrev = m.heading;
    m.pitch = 0;
    m.mode = Math.sin(m.orbitA * 3 + k) > 0.2 ? 4 : 2; // alternate gliding and flapping
  },
  darter(g, m, dt) {
    m.timer -= dt;
    if (m.timer <= 0 || !m.tx) {
      m.timer = rand(0.8, 2.5);
      m.tx = g.cx + rand(-15, 15);
      m.ty = g.cy + rand(-15, 15);
      m.tz = rand(1, 6);
    }
    steerTo(m, m.tx, m.ty, g.speed * (Math.hypot(m.tx - m.x, m.ty - m.y) > 1 ? 1 : 0.1), dt, 5);
    advance(m, dt);
    m.z += ((m.tz ?? 2) - m.z) * Math.min(1, dt * 2);
    m.pitch = 0;
    m.mode = 2;
  },
};
