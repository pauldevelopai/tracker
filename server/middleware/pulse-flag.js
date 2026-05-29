import config from '../config.js';

// Feature gate for the Pulse system. Mounted in front of every /api/pulse/*
// router (admin AND public). When PULSE_ENABLED is not "true", the whole
// surface is invisible: each request 404s exactly as if the routes didn't
// exist, so nothing about Pulse leaks when the flag is off.
export function requirePulse(req, res, next) {
  if (!config.pulseEnabled) {
    return res.status(404).json({ message: 'Not found' });
  }
  next();
}
