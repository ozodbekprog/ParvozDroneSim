import { requestHidRadio } from './hid.js';

const axisNames = ['throttle', 'yaw', 'pitch', 'roll'];
const neutralChannels = () => ({ throttle: 0, yaw: 0, pitch: 0, roll: 0 });
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const isRadio = pad => /EdgeTX|OpenTX|RadioMaster|FrSky|FlySky|Jumper|TBS/i.test(pad?.id || '');
export const deviceKey = pad => pad?.id || '';
const normalizeSelection = key => String(key || '').replace(/^\d+:/, '');
export function calibratedChannels(axes, profile) {
  return Object.fromEntries(axisNames.map(name => {
    const raw = axes[profile.axis[name]];
    // A radio has no channels until its first report. Missing data is not a centered throttle stick.
    if (!Number.isFinite(raw)) return [name, 0];
    if (name === 'throttle') return [name, throttleFromAxis(raw, profile)];
    const center = profile.center[name] ?? 0;
    const travel = raw >= center ? (profile.max[name] ?? 1) - center : center - (profile.min[name] ?? -1);
    const value = clamp((raw - center) / Math.max(0.01, travel), -1, 1);
    const deadzone = profile.deadzone || 0;
    const scaled = Math.sign(value) * Math.max(0, Math.abs(value) - deadzone) / (1 - deadzone);
    return [name, (profile.invert[name] ? -1 : 1) * scaled];
  }));
}

export function throttleFromAxis(raw, profile) {
  const min = profile.min.throttle ?? -1;
  const max = profile.max.throttle ?? 1;
  const center = profile.center.throttle ?? 0;
  if (profile.throttleMode === 'centered') {
    const travel = profile.invert.throttle ? center - min : max - center;
    const displacement = profile.invert.throttle ? center - raw : raw - center;
    return clamp(displacement / Math.max(0.01, travel), 0, 1);
  }
  const travel = (raw - min) / Math.max(0.01, max - min);
  return clamp(profile.invert.throttle ? 1 - travel : travel, 0, 1);
}

function defaultProfile(pad) {
  const radio = isRadio(pad);
  return {
    axis: radio ? { throttle: 2, yaw: 3, pitch: 1, roll: 0 } : { throttle: 1, yaw: 0, pitch: 3, roll: 2 },
    invert: { throttle: !radio, yaw: false, pitch: true, roll: false },
    min: { throttle: -1, yaw: -1, pitch: -1, roll: -1 },
    max: { throttle: 1, yaw: 1, pitch: 1, roll: 1 },
    center: { throttle: 0, yaw: 0, pitch: 0, roll: 0 },
    deadzone: 0.04, expo: 0, throttleMode: radio ? 'full' : 'centered'
  };
}

export class InputManager {
  constructor() {
    this.keys = new Set();
    this.throttle = 0;
    this.focused = true;
    this.lastDeviceKey = '';
    this.selected = normalizeSelection(localStorage.getItem('liftoff-device'));
    try { this.profiles = JSON.parse(localStorage.getItem('liftoff-profiles') || '{}') || {}; } catch { this.profiles = {}; }
    for (const [key, profile] of Object.entries(this.profiles)) this.profiles[normalizeSelection(key)] ||= profile;
    this.capture = null;
    this.calibration = null;
    this.hid = null;
    window.addEventListener('keydown', event => {
      if (!this.focused || document.hidden) return;
      if (document.querySelector('dialog[open]')) return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      this.keys.add(event.code);
      if (event.code === 'Space') event.preventDefault();
    });
    window.addEventListener('keyup', event => this.keys.delete(event.code));
    window.addEventListener('blur', () => { this.focused = false; this.reset(); });
    window.addEventListener('focus', () => { this.focused = true; this.reset(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.reset(); });
    window.addEventListener('gamepadconnected', () => this.deviceChanged());
    window.addEventListener('gamepaddisconnected', () => this.deviceChanged());
  }

  reset() {
    this.keys.clear();
    this.throttle = 0;
  }

  deviceChanged() {
    this.reset();
    const capture = this.capture;
    this.capture = null;
    this.calibration = null;
    capture?.onCancelled?.('device-changed');
  }

  devices() {
    const gamepads = [...(navigator.getGamepads?.() || [])].filter(pad => pad && pad.connected !== false);
    return this.hid?.connected ? [...gamepads, this.hid] : gamepads;
  }

  async connectHid() {
    const device = await requestHidRadio(
      axes => { if (this.hid) this.hid.axes = axes; },
      () => { if (this.hid) this.hid.connected = false; this.deviceChanged(); this.onDeviceChange?.(); }
    );
    if (!device) return false;
    this.hid = { index: 999, id: `HID ${device.productName} ${device.vendorId.toString(16)}:${device.productId.toString(16)}`, axes: [], buttons: [], connected: true };
    this.selectDevice(`${this.hid.index}:${this.hid.id}`);
    return true;
  }

  selectedDevice() {
    if (this.selected === 'keyboard') return null;
    const devices = this.devices();
    // Do not switch to a different controller if the selected radio disconnects.
    if (this.selected) return devices.find(pad => deviceKey(pad) === this.selected) || null;
    return devices.find(isRadio) || devices[0] || null;
  }

  selectDevice(value) {
    this.deviceChanged();
    this.lastDeviceKey = '';
    this.selected = normalizeSelection(value);
    localStorage.setItem('liftoff-device', this.selected);
  }

  profile() {
    const pad = this.selectedDevice();
    if (!pad) return defaultProfile();
    const base = defaultProfile(pad), saved = this.profiles[deviceKey(pad)] || {};
    return { ...base, ...saved, ...Object.fromEntries(['axis', 'invert', 'min', 'max', 'center'].map(key => [key, { ...base[key], ...saved[key] }])) };
  }

  saveProfile(profile) {
    const pad = this.selectedDevice();
    if (!pad) return;
    this.profiles[deviceKey(pad)] = profile;
    localStorage.setItem('liftoff-profiles', JSON.stringify(this.profiles));
  }

  rawChannels() {
    const pad = this.selectedDevice();
    if (!pad) return null;
    const profile = this.profile();
    return Object.fromEntries(axisNames.map(name => [name, pad.axes[profile.axis[name]] ?? 0]));
  }

  beginCapture(name, onCaptured, onCancelled) {
    const pad = this.selectedDevice();
    if (!pad || this.capture || this.calibration) return false;
    this.capture = { name, before: [...pad.axes], onCaptured, onCancelled, until: performance.now() + 10000 };
    return true;
  }

  pollCapture() {
    if (!this.capture) return;
    const pad = this.selectedDevice();
    if (!pad || performance.now() > this.capture.until) {
      const capture = this.capture;
      this.capture = null;
      capture.onCancelled?.(pad ? 'timeout' : 'device-changed');
      return;
    }
    const movement = pad.axes.map((value, index) => ({ index, movement: Math.abs(value - (this.capture.before[index] || 0)) })).sort((a, b) => b.movement - a.movement)[0];
    if (movement?.movement > 0.48) {
      const capture = this.capture;
      const profile = this.profile();
      profile.axis[capture.name] = movement.index;
      this.saveProfile(profile);
      this.capture = null;
      capture.onCaptured(movement.index);
    }
  }

  beginCalibration(onDone) {
    const pad = this.selectedDevice();
    if (!pad || this.capture || this.calibration) return false;
    this.calibration = {
      until: performance.now() + 9000,
      min: [...pad.axes], max: [...pad.axes], center: [...pad.axes], onDone
    };
    return true;
  }

  pollCalibration() {
    if (!this.calibration) return;
    const pad = this.selectedDevice();
    if (!pad) { this.calibration = null; return; }
    pad.axes.forEach((value, index) => {
      this.calibration.min[index] = Math.min(this.calibration.min[index], value);
      this.calibration.max[index] = Math.max(this.calibration.max[index], value);
    });
    if (performance.now() < this.calibration.until) return;
    const profile = this.profile();
    for (const name of axisNames) {
      const index = profile.axis[name];
      if (this.calibration.max[index] - this.calibration.min[index] < 0.5) continue;
      profile.min[name] = this.calibration.min[index];
      profile.max[name] = this.calibration.max[index];
      if (name !== 'throttle' || profile.throttleMode === 'centered') profile.center[name] = (profile.min[name] + profile.max[name]) / 2;
    }
    this.saveProfile(profile);
    this.calibration.onDone();
    this.calibration = null;
  }

  read(dt = 1 / 60) {
    if (!this.focused || document.hidden) return neutralChannels();
    this.pollCapture();
    this.pollCalibration();
    const pad = this.selectedDevice();
    const currentDeviceKey = deviceKey(pad);
    if (this.lastDeviceKey && this.lastDeviceKey !== currentDeviceKey) this.reset();
    this.lastDeviceKey = currentDeviceKey;
    if (pad) {
      return calibratedChannels(pad.axes, this.profile());
    }
    // A selected radio must reconnect or be changed explicitly; losing it must not restore keyboard throttle.
    if (this.selected && this.selected !== 'keyboard') { this.reset(); return neutralChannels(); }
    const down = code => this.keys.has(code);
    if (down('ShiftLeft')) this.throttle = clamp(this.throttle + 0.72 * dt, 0, 1);
    if (down('KeyF') || down('ControlLeft')) this.throttle = clamp(this.throttle - 0.72 * dt, 0, 1);
    return {
      throttle: this.throttle,
      yaw: Number(down('KeyE')) - Number(down('KeyQ')),
      pitch: Number(down('KeyW')) - Number(down('KeyS')),
      roll: Number(down('KeyD')) - Number(down('KeyA'))
    };
  }
}
