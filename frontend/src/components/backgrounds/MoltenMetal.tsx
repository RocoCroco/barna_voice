import { useEffect, useRef } from 'react';
import { Mesh, Program, Renderer, Triangle } from 'ogl';

// Adapted from React Bits' MoltenMetal background for a low-power TV canvas.
interface MoltenMetalProps {
  paused?: boolean;
  className?: string;
  color1?: string;
  color2?: string;
  color3?: string;
  speed?: number;
  opacity?: number;
}

interface MoltenRuntime {
  setPaused: (paused: boolean) => void;
}

const hexToRgb = (hex: string): [number, number, number] => {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return [1, 1, 1];
  return [
    Number.parseInt(match[1], 16) / 255,
    Number.parseInt(match[2], 16) / 255,
    Number.parseInt(match[3], 16) / 255,
  ];
};

const vertexShader = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShader = `#version 300 es
precision highp float;

uniform vec2 iResolution;
uniform float iTime;
uniform float uSpeed;
uniform float uOpacity;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;

out vec4 fragColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  float time = iTime * uSpeed;
  vec2 p = 3.4 * ((gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y) - 0.5;
  vec2 i = p;
  float c = 0.0;
  float r = length(p + vec2(sin(time), sin(time * 0.3 + 5.0)) * 0.5);
  float d = length(p);
  float rot = d + time + p.x * 0.72;
  float cosRot = cos(rot);
  mat2 warp = mat2(
    cos(rot - sin(time / 5.0)),
    sin(rot),
    -sin(cosRot - time),
    cosRot
  ) * -0.18;

  for (float n = 0.0; n < 4.0; n++) {
    p *= warp;
    float t = r - time / (n + 3.0);
    i -= p + vec2(
      cos(t - i.x - r) + sin(t + i.y),
      sin(t - i.y) + cos(t + i.x) + r
    );
    c += 0.105 / length(vec2(sin(i.x + t), cos(i.y + t)));
  }

  c /= 6.0;
  float intensity = max(c - 0.075, 0.0) * 1.18;
  float glow = clamp(intensity, 0.0, 1.0);
  vec3 color = mix(uColor1, uColor2, smoothstep(0.0, 0.58, glow));
  color = mix(color, uColor3, smoothstep(0.58, 1.0, glow));

  float grain = (hash(gl_FragCoord.xy + iTime) - 0.5) * 0.025;
  float alpha = clamp(glow + grain, 0.0, 1.0) * uOpacity;
  fragColor = vec4(color * alpha, alpha);
}
`;

export function MoltenMetal({
  paused = false,
  className = '',
  color1 = '#071426',
  color2 = '#0b4664',
  color3 = '#2c9cbc',
  speed = 0.18,
  opacity = 0.54,
}: MoltenMetalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<MoltenRuntime | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: Renderer;
    try {
      renderer = new Renderer({
        webgl: 2,
        alpha: true,
        premultipliedAlpha: true,
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

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new Float32Array([1, 1]) },
        uSpeed: { value: speed },
        uOpacity: { value: opacity },
        uColor1: { value: new Float32Array(hexToRgb(color1)) },
        uColor2: { value: new Float32Array(hexToRgb(color2)) },
        uColor3: { value: new Float32Array(hexToRgb(color3)) },
      },
    });
    const mesh = new Mesh(gl, { geometry, program });

    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      renderer.setSize(Math.max(1, Math.floor(width)), Math.max(1, Math.floor(height)));
      const resolution = program.uniforms.iResolution.value as Float32Array;
      resolution[0] = gl.drawingBufferWidth;
      resolution[1] = gl.drawingBufferHeight;
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
        program.uniforms.iTime.value = elapsed;
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
  }, [color1, color2, color3, opacity, speed]);

  useEffect(() => {
    runtimeRef.current?.setPaused(paused);
  }, [paused]);

  return (
    <div
      ref={containerRef}
      className={`molten-metal-container ${className}`.trim()}
      aria-hidden="true"
    />
  );
}
