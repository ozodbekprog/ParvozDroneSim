export const ULTRA_LOADING_SHOTS=[
 new URL('./assets/loading/pine-valley.jpg',import.meta.url).href,
 new URL('./assets/loading/the-green.jpg',import.meta.url).href,
 new URL('./assets/loading/minus-two.jpg',import.meta.url).href,
];
export function shuffledLoadingShots(random=Math.random){
 const shots=[...ULTRA_LOADING_SHOTS];
 for(let i=shots.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[shots[i],shots[j]]=[shots[j],shots[i]];}
 return shots;
}
