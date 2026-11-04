// Pure decisions shared by the runner and regression tests.
export const browserChecks = ['chrome-control', 'diagnostics-outside-flight', 'setup-guide-navigation', 'guide-return-preserves-screen'];
export const machineChecks = ['focused-tests', 'content', 'build', 'server-smoke'];

export function quotaDecision(snapshot, threshold = 5, now = Date.now() / 1000) {
  if (!Number.isFinite(threshold) || threshold < 1 || threshold > 5) throw new Error('Quota threshold must be between 1 and 5 percent.');
  if (!snapshot || typeof snapshot.accountKey !== 'string' || !snapshot.accountKey ||
      !Number.isFinite(snapshot.observedAt) || now - snapshot.observedAt > 120 || snapshot.observedAt > now + 5) {
    return {status: 'quota_unknown', reason: 'Fresh account quota is unavailable.'};
  }
  const windows = Array.isArray(snapshot.windows) ? snapshot.windows.filter(w => w?.bucket === 'codex') : [];
  for (const duration of [300, 10080]) {
    const matches = windows.filter(item => item.windowDurationMins === duration), w = matches[0];
    if (matches.length !== 1 || !Number.isFinite(w.remainingPercent) || w.remainingPercent < 0 || w.remainingPercent > 100 ||
        !Number.isFinite(w.resetsAt) || w.resetsAt <= now) {
      return {status: 'quota_unknown', reason: 'Both quota windows need valid, fresh readings.'};
    }
  }
  const minimum = Math.min(...windows.filter(w => [300, 10080].includes(w.windowDurationMins)).map(w => w.remainingPercent));
  return {status: minimum <= threshold ? 'waiting_for_quota' : 'available', minimumRemainingPercent: minimum,
    reason: minimum <= threshold ? 'Checkpoint saved. Resume after a supported account change or quota reset.' : 'Both quota windows are above threshold.'};
}

export function observeAccount(state, key) {
  const changed = Boolean(state.accountKey && state.accountKey !== key);
  if (changed) {
    state.browser = null;
    state.events.push({at: new Date().toISOString(), type: 'account_changed', action: 'recheck_browser'});
  }
  state.accountKey = key;
  return changed;
}

export function validateBrowserProof(proof, state, now = Date.now()) {
  if (!proof || proof.runId !== state.runId || proof.sourceDigest !== state.sourceDigest || proof.accountKey !== state.accountKey) {
    throw new Error('Browser proof belongs to another run, source snapshot, or account.');
  }
  const time = Date.parse(proof.observedAt);
  if (!Number.isFinite(time) || time < Date.parse(state.createdAt) || time > now + 5000 || now - time > 30 * 60_000) {
    throw new Error('Browser proof is stale or has an invalid timestamp.');
  }
  if (proof.browser !== 'Chrome' || proof.verifiedBy !== 'cua_repl' || proof.baseUrl !== state.baseUrl) {
    throw new Error('Proof must come from Chrome through the supported browser tool on this isolated server.');
  }
  if (!Array.isArray(proof.checks) || proof.checks.length !== browserChecks.length) throw new Error('Incomplete browser checklist.');
  for (const name of browserChecks) {
    const rows = proof.checks.filter(item => item.name === name);
    if (rows.length !== 1 || !['passed', 'failed', 'not_run'].includes(rows[0].status) || !rows[0].evidence) {
      throw new Error('Missing or ambiguous browser check: ' + name);
    }
  }
  return proof;
}

export function acceptanceStatus(state) {
  if (state.sourceCurrent === false) return 'source_changed';
  if (machineChecks.some(name => state.checks[name]?.status === 'failed')) return 'failed';
  if (!machineChecks.every(name => state.checks[name]?.status === 'passed')) return 'incomplete';
  if (state.browser?.checks.some(row => row.status === 'failed')) return 'failed';
  return browserChecks.every(name => state.browser?.checks.find(row => row.name === name)?.status === 'passed') ? 'passed' : 'awaiting_browser';
}
