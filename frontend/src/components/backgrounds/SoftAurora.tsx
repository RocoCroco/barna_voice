import { useEffect, useRef } from 'react';
import { Mesh, Program, Renderer, Triangle } from 'ogl';

// Adapted from React Bits' SoftAurora background with a pausable 30 fps loop.
interface SoftAuroraProps {
  paused?: boolean;
  className?: string;
  color1?: string;
  color2?: string;
  speed?: number;
  brightness?: number;
}

interface AuroraRuntime {
  setPaused: (paused: boolean) => void;
}

const hexToVec3 = (hex: string): [number, number, number] => {
  const value = hex.replace('#', '');
  return [
    Number.parseInt(value.slice(0, 2), 16) / 255,
    Number.parseInt(value.slice(2, 4), 16) / 255,
    Number.parseInt(value.slice(4, 6), 16) / 255,
  ];
};

const vertexShader = `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0, 1);
}
`;

const fragmentShader = `
precision highp float;

uniform float uTime;
uniform vec3 uResolution;
uniform float uSpeed;
uniform float uBrightness;
uniform vec3 uColor1;
uniform vec3 uColor2;
varying vec2 vUv;

#define TAU 6.28318

vec3 gradientHash(vec3 p) {
  p = vec3(
    dot(p, vec3(127.1, 311.7, 234.6)),
    dot(p, vec3(269.5, 183.3, 198.3)),
    dot(p, vec3(169.5, 283.3, 156.9))
  );
  vec3 h = fract(sin(p) * 43758.5453123);
  float phi = acos(2.0 * h.x - 1.0);
  float theta = TAU * h.y;
  return vec3(cos(theta) * sin(phi), sin(theta) * cos(phi), cos(phi));
}

float quinticSmooth(float t) {
  float t2 = t * t;
  float t3 = t * t2;
  return 6.0 * t3 * t2 - 15.0 * t2 * t2 + 10.0 * t3;
}

vec3 cosineGradient(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(TAU * (c * t + d));
}

float perlin3D(float amplitude, float frequency, float px, float py, float pz) {
  float x = px * frequency;
  float y = py * frequency;
  float fx = floor(x); float fy = floor(y); float fz = floor(pz);
  float cx = ceil(x);  float cy = ceil(y);  float cz = ceil(pz);

  vec3 g000 = gradientHash(vec3(fx, fy, fz));
  vec3 g100 = gradientHash(vec3(cx, fy, fz));
  vec3 g010 = gradientHash(vec3(fx, cy, fz));
  vec3 g110 = gradientHash(vec3(cx, cy, fz));
  vec3 g001 = gradientHash(vec3(fx, fy, cz));
  vec3 g101 = gradientHash(vec3(cx, fy, cz));
  vec3 g011 = gradientHash(vec3(fx, cy, cz));
  vec3 g111 = gradientHash(vec3(cx, cy, cz));

  float d000 = dot(g000, vec3(x - fx, y - fy, pz - fz));
  float d100 = dot(g100, vec3(x - cx, y - fy, pz - fz));
  float d010 = dot(g010, vec3(x - fx, y - cy, pz - fz));
  float d110 = dot(g110, vec3(x - cx, y - cy, pz - fz));
  float d001 = dot(g001, vec3(x - fx, y - fy, pz - cz));
  float d101 = dot(g101, vec3(x - cx, y - fy, pz - cz));
  float d011 = dot(g011, vec3(x - fx, y - cy, pz - cz));
  float d111 = dot(g111, vec3(x - cx, y - cy, pz - cz));

  float sx = quinticSmooth(x - fx);
  float sy = quinticSmooth(y - fy);
  float sz = quinticSmooth(pz - fz);
  float ly0 = mix(mix(d000, d100, sx), mix(d010, d110, sx), sy);
  float ly1 = mix(mix(d001, d101, sx), mix(d011, d111, sx), sy);
  return amplitude * mix(ly0, ly1, sz);
}

float auroraGlow(float t, float phase) {
  vec2 uv = gl_FragCoord.xy / uResolution.y;
  float noiseVal = 0.0;
  float frequency = 2.15;
  float amplitude = 0.72;
  vec2 samplePos = uv * 1.2;

  for (float octave = 0.0; octave < 3.0; octave += 1.0) {
    noiseVal += perlin3D(amplitude, frequency, samplePos.x, samplePos.y, t + phase);
    amplitude *= 0.16;
    frequency *= 2.0;
  }

  float yBand = uv.y * 7.2 - 3.8;
  return 0.38 * max(exp(0.94 * (1.0 - 0.62 * abs(noiseVal + yBand))), 0.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  float time = uSpeed * 0.4 * uTime;
  float glow1 = auroraGlow(time, 0.0);
  float glow2 = auroraGlow(time, 0.82);
  vec3 gradient1 = cosineGradient(
    uv.x + uTime * uSpeed * 0.16,
    vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.3, 0.20, 0.20)
  );
  vec3 gradient2 = cosineGradient(
    uv.x + uTime * uSpeed * 0.08,
    vec3(0.5), vec3(0.5), vec3(2.0, 1.0, 0.0), vec3(0.5, 0.20, 0.25)
  );
  vec3 color = 0.99 * glow1 * gradient1 * uColor1;
  color += 0.99 * glow2 * gradient2 * uColor2;
  color *= uBrightness;
  float alpha = clamp(length(color), 0.0, 0.72);
  gl_FragColor = vec4(color, alpha);
}
`;

export function SoftAurora({
  paused = false,
  className = '',
  color1 = '#23d7ff',
  color2 = '#557cff',
  speed = 0.62,
  brightness = 1.08,
}: SoftAuroraProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<AuroraRuntime | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: Renderer;
    try {
      renderer = new Renderer({
        alpha: true,
        premultipliedAlpha: false,
        antialias: false,
        dpr: 1,
      });
    } catch {
      container.dataset.webglFallback = 'true';
      return;
    }

    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    const canvas = gl.canvas;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    container.appendChild(canvas);

    const program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new Float32Array([1, 1, 1]) },
        uSpeed: { value: speed },
        uBrightness: { value: brightness },
        uColor1: { value: new Float32Array(hexToVec3(color1)) },
        uColor2: { value: new Float32Array(hexToVec3(color2)) },
      },
    });
    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      renderer.setSize(Math.max(1, Math.floor(width)), Math.max(1, Math.floor(height)));
      const resolution = program.uniforms.uResolution.value as Float32Array;
      resolution[0] = gl.drawingBufferWidth;
      resolution[1] = gl.drawingBufferHeight;
      resolution[2] = gl.drawingBufferWidth / Math.max(gl.drawingBufferHeight, 1);
      renderer.render({ scene: mesh });
    };

    let raf = 0;
    let lastFrame = 0;
    let elapsed = 0;
    let isPaused = paused;
    let isVisible = true;
    let isPageVisible = !document.hidden;

    const stop = () => {
      if (!raf) return;
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const frame = (time: number) => {
      if (!lastFrame) lastFrame = time;
      const delta = time - lastFrame;
      if (delta >= 1000 / 30) {
        elapsed += delta * 0.001;
        lastFrame = time;
        program.uniforms.uTime.value = elapsed;
        renderer.render({ scene: mesh });
      }
      raf = requestAnimationFrame(frame);
    };

    const sync = () => {
      if (!isPaused && isVisible && isPageVisible && !raf) {
        lastFrame = performance.now();
        raf = requestAnimationFrame(frame);
      } else if ((isPaused || !isVisible || !isPageVisible) && raf) {
        stop();
      }
    };

    runtimeRef.current = {
      setPaused(nextPaused) {
        isPaused = nextPaused;
        sync();
      },
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
      sync();
    });
    intersectionObserver.observe(container);
    const handleVisibility = () => {
      isPageVisible = !document.hidden;
      sync();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    resize();
    sync();

    return () => {
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
      runtimeRef.current = null;
      if (canvas.parentNode === container) container.removeChild(canvas);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [brightness, color1, color2, speed]);

  useEffect(() => {
    runtimeRef.current?.setPaused(paused);
  }, [paused]);

  return (
    <div
      ref={containerRef}
      className={`soft-aurora-container ${className}`.trim()}
      aria-hidden="true"
    />
  );
}
