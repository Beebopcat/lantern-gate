// HD-2D presentation pass for the 2.5D JRPG look.
// The scene renders into a low-resolution nearest-neighbour target (chunky pixels), then a composite pass adds
// ink outlines from depth edges, a tilt-shift blur band, gentle colour grading and a vignette.
import * as THREE from './vendor/three.js';

const VERT = `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const FRAG = `
precision highp float;
uniform sampler2D tColor;uniform sampler2D tDepth;uniform vec2 texel;uniform float near;uniform float far;uniform float ortho;
uniform float focus;uniform float blur;uniform float outline;uniform float vignette;uniform float grade;
varying vec2 vUv;
float lin(vec2 uv){float d=texture2D(tDepth,uv).x;
  if(ortho>.5)return near+d*(far-near);
  float z=d*2.-1.;return 2.*near*far/(far+near-z*(far-near));}
void main(){
  vec2 uv=vUv;
  float band=smoothstep(focus,.5,abs(uv.y-.5)*1.0)*blur;
  vec3 c=texture2D(tColor,uv).rgb;
  if(band>.02){
    vec3 a=vec3(0.);float w=0.;
    for(int i=-3;i<=3;i++){for(int j=-3;j<=3;j++){
      float k=exp(-float(i*i+j*j)/6.);
      a+=texture2D(tColor,uv+vec2(float(i),float(j))*texel*band*1.6).rgb*k;w+=k;}}
    c=mix(c,a/w,min(1.,band*1.4));
  }
  float d0=lin(uv);
  float e=0.;
  vec2 o[4];o[0]=vec2(texel.x,0.);o[1]=vec2(-texel.x,0.);o[2]=vec2(0.,texel.y);o[3]=vec2(0.,-texel.y);
  for(int i=0;i<4;i++){float d1=lin(uv+o[i]);e=max(e,abs(d1-d0)/(0.06*d0+.35));}
  float ink=smoothstep(.55,1.2,e)*outline;
  c=mix(c,c*vec3(.30,.27,.34),ink*(1.-band*.7));
  float l=dot(c,vec3(.299,.587,.114));
  c=mix(vec3(l),c,1.+grade*.28);
  c*=mix(vec3(1.),vec3(1.03,1.0,.95),grade);
  vec2 q=uv-.5;c*=1.-vignette*smoothstep(.25,.85,dot(q,q)*2.);
  gl_FragColor=vec4(c,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Hd2dPass {
  constructor(gl) {
    this.gl = gl;
    this.scene = new THREE.Scene();
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false,
      uniforms: {
        tColor: { value: null }, tDepth: { value: null }, texel: { value: new THREE.Vector2(1, 1) },
        near: { value: .1 }, far: { value: 130 }, ortho: { value: 0 },
        focus: { value: .16 }, blur: { value: 1 }, outline: { value: .85 }, vignette: { value: .42 }, grade: { value: .55 }
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    const quad = new THREE.Mesh(geo, this.material);
    quad.frustumCulled = false;
    this.scene.add(quad);
    this.target = null;
    this.scale = 3;
    this.size = '';
  }

  // Pixel size in CSS pixels: aim for roughly 300 rows on screen, never below 2.
  pixelScale(h) { return Math.max(2, Math.round(h / 300)); }

  resize(w, h) {
    const ps = this.pixelScale(h), lw = Math.max(64, Math.round(w / ps)), lh = Math.max(48, Math.round(h / ps));
    const key = lw + 'x' + lh;
    if (key === this.size) return;
    this.size = key;
    this.scale = ps;
    this.target?.dispose();
    this.target?.depthTexture?.dispose();
    const depth = new THREE.DepthTexture(lw, lh);
    depth.type = THREE.UnsignedIntType;
    depth.minFilter = depth.magFilter = THREE.NearestFilter;
    this.target = new THREE.WebGLRenderTarget(lw, lh, {
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, type: THREE.HalfFloatType,
      depthBuffer: true, depthTexture: depth, samples: 0
    });
    this.target.texture.colorSpace = THREE.LinearSRGBColorSpace;
    this.material.uniforms.tColor.value = this.target.texture;
    this.material.uniforms.tDepth.value = depth;
    this.material.uniforms.texel.value.set(1 / lw, 1 / lh);
  }

  render(scene, camera, w, h) {
    this.resize(w, h);
    const u = this.material.uniforms, gl = this.gl;
    u.near.value = camera.near; u.far.value = camera.far; u.ortho.value = camera.isOrthographicCamera ? 1 : 0;
    const prior = gl.getRenderTarget();
    gl.setRenderTarget(this.target);
    gl.clear();
    gl.render(scene, camera);
    gl.setRenderTarget(prior);
    gl.render(this.scene, this.cam);
  }

  dispose() { this.target?.dispose(); this.material.dispose(); }
}
