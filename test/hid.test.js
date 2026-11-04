import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEdgeTxClassic, parseGenericAxes } from '../src/hid.js';

test('EdgeTX classic report exposes eight normalized channels', () => {
  const report = new DataView(new ArrayBuffer(19));
  for (let index = 0; index < 8; index++) report.setUint16(3 + index * 2, index % 2 ? 2047 : 0, true);
  const axes = parseEdgeTxClassic(report);
  assert.equal(axes.length, 8);
  assert.equal(axes[0], -1);
  assert.ok(axes[1] > 0.99);
});

test('generic HID descriptor identifies axis fields after button bits', () => {
  const report = new DataView(new ArrayBuffer(5));
  report.setUint8(0, 3);
  report.setUint8(1, 0);
  report.setUint8(2, 127);
  report.setUint8(3, 255);
  report.setUint8(4, 64);
  const collections = [{
    inputReports: [{ reportId: 0, items: [
      { reportCount: 8, reportSize: 1, isConstant: false, logicalMinimum: 0, logicalMaximum: 1, usages: [] },
      { reportCount: 4, reportSize: 8, isConstant: false, logicalMinimum: 0, logicalMaximum: 255, usages: [0x30, 0x31, 0x32, 0x33] }
    ] }], children: []
  }];
  const axes = parseGenericAxes(collections, 0, report);
  assert.equal(axes.length, 4);
  assert.equal(axes[0], -1);
  assert.ok(Math.abs(axes[1]) < 0.01);
  assert.equal(axes[2], 1);
});
