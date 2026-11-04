import { parentPort,workerData } from 'node:worker_threads';
import { syncContent } from './content-packages.js';
try {parentPort.postMessage(syncContent(workerData));}catch(error){parentPort.postMessage({error:error.message});}
