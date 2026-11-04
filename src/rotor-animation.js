import{Vector3,Quaternion}from'three';
const y=new Vector3(0,1,0),axis=new Vector3(),bodyUp=new Vector3(),rotation=new Quaternion(),delta=new Quaternion();
export function advanceRotor(rotor,body,radians){
 if(rotor.userData.spinAxisSign===undefined){
  axis.copy(y).applyQuaternion(rotor.getWorldQuaternion(rotation));bodyUp.copy(y).applyQuaternion(body.getWorldQuaternion(rotation));
  rotor.userData.spinAxisSign=axis.dot(bodyUp)<0?-1:1;
 }
 rotor.quaternion.multiply(delta.setFromAxisAngle(y,radians*rotor.userData.spinAxisSign)).normalize();
}
