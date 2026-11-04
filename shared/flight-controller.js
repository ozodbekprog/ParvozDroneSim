const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const number = (value, fallback, min, max) => Number.isFinite(Number(value)) ? clamp(Number(value), min, max) : fallback;

export const DEFAULT_FLIGHT_CONTROLLER = Object.freeze({
  rates: {
    roll: { rcRate: 1, superRate: 0.7, expo: 0 },
    pitch: { rcRate: 1, superRate: 0.6, expo: 0 },
    yaw: { rcRate: 1, superRate: 0.52, expo: 0 }
  },
  pid: {
    roll: { p: 34, i: 28, d: 29 },
    pitch: { p: 29, i: 25, d: 22 },
    yaw: { p: 30, i: 32, d: 0 }
  },
  level: { angleLimit: 60, angleStrength: 30, horizonStrength: 100 },
  throttle: { start: 0, end: 100, mid: 50, expo: 0, idle: 4 },
  launchControl: false
});

export function validateFlightController(value = {}) {
  const result = { rates: {}, pid: {}, level: {}, throttle: {}, launchControl: value?.launchControl === true };
  for (const axis of ['roll', 'pitch', 'yaw']) {
    const rate = value?.rates?.[axis] || {};
    const baseRate = DEFAULT_FLIGHT_CONTROLLER.rates[axis];
    result.rates[axis] = {
      rcRate: number(rate.rcRate, baseRate.rcRate, 0.1, 2.5),
      superRate: number(rate.superRate, baseRate.superRate, 0, 0.95),
      expo: number(rate.expo, baseRate.expo, 0, 1)
    };
    const pid = value?.pid?.[axis] || {};
    const basePid = DEFAULT_FLIGHT_CONTROLLER.pid[axis];
    result.pid[axis] = {
      p: number(pid.p, basePid.p, 0, 100),
      i: number(pid.i, basePid.i, 0, 100),
      d: axis === 'yaw' ? 0 : number(pid.d, basePid.d, 0, 100)
    };
  }
  const level = value?.level || {};
  result.level = {
    angleLimit: number(level.angleLimit, 60, 10, 85),
    angleStrength: number(level.angleStrength, 30, 0, 100),
    horizonStrength: number(level.horizonStrength, 100, 0, 100)
  };
  const throttle = value?.throttle || {};
  result.throttle = {
    start: number(throttle.start, 0, 0, 50),
    end: number(throttle.end, 100, 50, 100),
    mid: number(throttle.mid, 50, 10, 90),
    expo: number(throttle.expo, 0, 0, 100),
    idle: number(throttle.idle, 4, 0, 15)
  };
  return result;
}

export function rateDegrees(stick, rate) {
  const x = clamp(Number(stick) || 0, -1, 1);
  const shaped = x * (1 - rate.expo) + x * x * x * rate.expo;
  const rc = rate.rcRate > 2 ? rate.rcRate + 14.54 * (rate.rcRate - 2) : rate.rcRate;
  return 200 * rc * shaped / Math.max(0.05, 1 - Math.abs(shaped) * rate.superRate);
}

export function throttleOutput(stick, config) {
  const x = clamp(Number(stick) || 0, 0, 1);
  const shifted = clamp(x + (config.mid / 100 - 0.5) * 4 * x * (1 - x), 0, 1);
  const curved = shifted * (1 - config.expo / 100) + (shifted * shifted * (3 - 2 * shifted)) * config.expo / 100;
  return config.start / 100 + curved * (config.end - config.start) / 100;
}
