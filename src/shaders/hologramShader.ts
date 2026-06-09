export const PointShader = {
  vertexShader: `
    uniform float time;
    uniform float pointScale;
    attribute float sizeModifier;
    attribute vec3 morphOffset;
    
    varying vec3 vPosition;
    varying float vGlow;

    void main() {
      // Add a tiny random breathing jitter to vertices
      vec3 pos = position + morphOffset;
      
      // Calculate depth-based scaling and positioning
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      
      // Pass variables to fragment shader
      vPosition = pos;
      vGlow = sizeModifier;
      
      // Size attenuation based on distance
      gl_PointSize = pointScale * sizeModifier * (300.0 / -mvPosition.z);
    }
  `,
  fragmentShader: `
    uniform vec3 glowColor;
    uniform float time;
    
    varying vec3 vPosition;
    varying float vGlow;

    void main() {
      // Make particles circular and glowy
      vec2 center = gl_PointCoord - vec2(0.5);
      float dist = length(center);
      
      // If outside the circle, discard to make it a perfect sphere/dot
      if (dist > 0.5) discard;
      
      // Circular soft falloff glow
      float alpha = smoothstep(0.5, 0.0, dist);
      
      // Add a dynamic neural pulsing glow to some nodes
      float pulse = sin(time * 3.0 + vPosition.y * 5.0) * 0.3 + 0.7;
      
      gl_FragColor = vec4(glowColor * pulse, alpha * (0.8 + 0.2 * vGlow));
    }
  `
};

export const LineShader = {
  vertexShader: `
    uniform float time;
    attribute vec3 morphOffset;
    varying vec3 vPosition;

    void main() {
      vec3 pos = position + morphOffset;
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      vPosition = pos;
    }
  `,
  fragmentShader: `
    uniform vec3 lineColor;
    uniform float time;
    uniform float volume;
    varying vec3 vPosition;

    void main() {
      // Neural signal pulsing vertically down the face
      float pulse = sin(vPosition.y * 8.0 - time * 4.0) * 0.5 + 0.5;
      
      // Base intensity + pulse intensity
      float intensity = 0.2 + 0.8 * pulse;
      
      // React to audio volume by brightening lines
      intensity += volume * 1.5;
      intensity = clamp(intensity, 0.1, 2.5);
      
      // Fade lines near the back of the head
      float depthFade = smoothstep(-2.5, 0.5, vPosition.z);
      
      gl_FragColor = vec4(lineColor * intensity, depthFade * 0.5);
    }
  `
};
