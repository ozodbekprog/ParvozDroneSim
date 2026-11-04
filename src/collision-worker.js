import {prepareCollisionPayload} from '../shared/collision-preparation.js';

self.onmessage=({data})=>{
 try{const {payload,transfer}=prepareCollisionPayload(data);self.postMessage({ok:true,...payload},transfer);}
 catch(error){self.postMessage({ok:false,message:error.message});}
};
