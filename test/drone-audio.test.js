import test from 'node:test';
import assert from 'node:assert/strict';
import { DroneAudio } from '../src/drone-audio.js';

function fakeAudio() {
  const parameter = () => ({ calls: [], setTargetAtTime(...args) { this.calls.push(args); } });
  return {
    context: { currentTime: 12.5 },
    rotors: Array.from({ length: 4 }, () => ({
      tone: { frequency: parameter() },
      filter: { frequency: parameter() },
      gain: { gain: parameter() }
    }))
  };
}

test('cancelled or missing flights silence every rotor without dereferencing absent data', () => {
  for (const [state, spec, audible] of [
    [null, undefined, false],
    [undefined, undefined, false],
    [null, { class: 'three' }, true],
    [{ motors: [1, 1, 1, 1] }, null, true],
    [{ motors: [1, 1, 1, 1] }, undefined, false]
  ]) {
    const audio = fakeAudio();
    assert.doesNotThrow(() => DroneAudio.prototype.update.call(audio, state, spec, audible));
    for (const rotor of audio.rotors) {
      assert.deepEqual(rotor.gain.gain.calls, [[0, 12.5, 0.012]]);
      assert.equal(rotor.tone.frequency.calls.length, 0);
      assert.equal(rotor.filter.frequency.calls.length, 0);
    }
  }
});

test('active motor audio retains voltage, propeller and per-motor response', () => {
  const audio = fakeAudio();
  const speeds = [0, 0.25, 0.5, 1];
  DroneAudio.prototype.update.call(audio, { battery: 0.5, motors: speeds }, { class: 'three', propellersId: 'efficient' }, true);
  speeds.forEach((speed, index) => {
    const rotor = audio.rotors[index];
    assert.deepEqual(rotor.tone.frequency.calls, [[Math.max(20, speed * 32000 * 0.92 * 2 / 60), 12.5, 0.008]]);
    assert.deepEqual(rotor.filter.frequency.calls, [[600 + speed * 4500, 12.5, 0.015]]);
    assert.deepEqual(rotor.gain.gain.calls, [[speed ** 1.5 * 0.028, 12.5, 0.012]]);
  });
});

test('muted valid flights quiet all channels even while motors are spinning', () => {
  const audio = fakeAudio();
  DroneAudio.prototype.update.call(audio, { motors: [1, 1, 1, 1], motorRpm: [100, 200, 300, 400] }, { propellersId: 'triblade' }, false);
  for (const rotor of audio.rotors) assert.deepEqual(rotor.gain.gain.calls, [[0, 12.5, 0.012]]);
});
