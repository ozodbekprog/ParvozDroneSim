/** Downloads occupy 80%; model and GPU preparation must finish before 100%. */
export function loadingPercent(phase, {loaded=0,total=0,done=false}={}) {
  if (/^Ready/.test(phase)) return 100;
  if (/graphics/i.test(phase)) return 95;
  if (/aircraft|opponents/i.test(phase)) return 90;
  if (/Processing/i.test(phase)) return 85;
  if (/Connecting/i.test(phase)) return 0;
  return Math.floor(80 * (done ? 1 : total > 0 ? Math.min(1,Math.max(0,loaded / total)) : 0));
}

export function loadingStage(phase) {
  if (/^Ready/.test(phase)) return 'Ready';
  if (/Connecting/i.test(phase)) return 'Connecting';
  if (/Downloading|cached/i.test(phase)) return 'Loading';
  return 'Preparing';
}

/** Real byte/file counts and elapsed time; never invent a remaining-time estimate. */
export function loadingDetail(phase,{loaded=0,total=0,filesDone=0,files=0}={},elapsedMs=0) {
  if(/^Ready/.test(phase))return '';
  const seconds=Math.max(0,Math.floor(elapsedMs/1000));
  const elapsed=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  if(!/Downloading|cached/i.test(phase)||!files)return elapsed;
  const mib=value=>(Math.max(0,value)/1048576).toFixed(1);
  return `${mib(loaded)} / ${mib(total)} MiB · ${filesDone} / ${files} · ${elapsed}`;
}
