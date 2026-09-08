// Sample a tiny copy of the completed hero locally. No API or extra image
// generation is required. Quantised colour groups identify the main surface,
// while near-black lettering/shadows and blown highlights get less influence.
const HeroPalette = {
  async fromImage(source) {
    const image = new Image();
    image.src = source;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 80;
    canvas.height = 45;
    const context = canvas.getContext('2d', {willReadFrequently:true});
    context.drawImage(image,0,0,80,45);
    const pixels = context.getImageData(0,0,80,45).data;
    const groups = new Map();
    for (let i=0;i<pixels.length;i+=4) {
      if (pixels[i+3]<128) continue;
      const r=pixels[i],g=pixels[i+1],b=pixels[i+2];
      const light=(.2126*r+.7152*g+.0722*b)/255;
      const weight=light<.08 || light>.94 ? .12 : 1;
      const key=`${r>>5},${g>>5},${b>>5}`;
      const group=groups.get(key)||{weight:0,r:0,g:0,b:0};
      group.weight+=weight;group.r+=r*weight;group.g+=g*weight;group.b+=b*weight;
      groups.set(key,group);
    }
    const dominant=[...groups.values()].sort((a,b)=>b.weight-a.weight)[0];
    if (!dominant) throw new Error('No usable hero pixels');
    const rgb=['r','g','b'].map(key=>Math.round(dominant[key]/dominant.weight));
    const hex='#'+rgb.map(value=>value.toString(16).padStart(2,'0')).join('');
    const luminance=(.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2])/255;
    return {...tonesFromHex(hex),mode:luminance<.28?'dark':'light'};
  }
};
