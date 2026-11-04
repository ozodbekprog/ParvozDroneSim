import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';

MeshoptDecoder.ready.then(()=>{
 self.onmessage = ({data}) => {
  const transfers = [], results = data.jobs.map(job => {
    try {
      const value = new Uint8Array(job.count * job.size);
      MeshoptDecoder.decodeGltfBuffer(value, job.count, job.size, job.source, job.mode, job.filter);
      transfers.push(value.buffer); return {id: job.id, value};
    } catch (error) { return {id: job.id, error: {name: error.name, message: error.message}}; }
  });
  self.postMessage({id: data.id, results}, transfers);
 };
 self.postMessage({ready: true});
});
