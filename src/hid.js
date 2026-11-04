function readBits(data, offset, size) {
  let value = 0;
  for (let bit = 0; bit < size; bit++) {
    const position = offset + bit;
    if (position >= data.byteLength * 8) return null;
    value |= ((data.getUint8(position >> 3) >> (position & 7)) & 1) << bit;
  }
  return value >>> 0;
}

function collectReports(collection, reportId, target) {
  for (const report of collection.inputReports || []) if (report.reportId === reportId) target.push(report);
  for (const child of collection.children || []) collectReports(child, reportId, target);
}

export function parseGenericAxes(collections, reportId, data) {
  const reports = [];
  for (const collection of collections) collectReports(collection, reportId, reports);
  const report = reports.sort((a, b) => b.items.length - a.items.length)[0];
  if (!report) return [];
  const axes = [];
  let offset = 0;
  for (const item of report.items) {
    for (let index = 0; index < item.reportCount; index++) {
      const raw = readBits(data, offset, item.reportSize);
      offset += item.reportSize;
      if (raw === null || item.isConstant || item.reportSize < 8 || item.logicalMaximum - item.logicalMinimum < 64) continue;
      const usage = (item.usages?.[index] ?? (item.isRange ? item.usageMinimum + index : 0)) & 0xffff;
      if (usage && (usage < 0x30 || usage > 0x39)) continue;
      const signed = item.logicalMinimum < 0 && raw >= 2 ** (item.reportSize - 1) ? raw - 2 ** item.reportSize : raw;
      axes.push(Math.max(-1, Math.min(1, ((signed - item.logicalMinimum) / (item.logicalMaximum - item.logicalMinimum)) * 2 - 1)));
    }
  }
  return axes;
}

export function parseEdgeTxClassic(data) {
  if (data.byteLength < 19) return [];
  return Array.from({ length: 8 }, (_, index) => Math.max(-1, Math.min(1, data.getUint16(3 + index * 2, true) / 1024 - 1)));
}

export async function requestHidRadio(onReport, onDisconnect) {
  if (!navigator.hid || !window.isSecureContext) throw new Error('WebHID requires a supported browser at localhost or HTTPS.');
  const [device] = await navigator.hid.requestDevice({ filters: [{ usagePage: 1, usage: 4 }, { usagePage: 1, usage: 5 }] });
  if (!device) return null;
  await device.open();
  device.addEventListener('inputreport', event => {
    const axes = device.vendorId === 0x1209 && device.productId === 0x4f54 && event.data.byteLength === 19
      ? parseEdgeTxClassic(event.data)
      : parseGenericAxes(device.collections, event.reportId, event.data);
    if (axes.length >= 4) onReport(axes);
  });
  navigator.hid.addEventListener('disconnect', event => { if (event.device === device) onDisconnect(); });
  return device;
}
