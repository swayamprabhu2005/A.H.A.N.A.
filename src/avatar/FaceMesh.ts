import * as THREE from 'three';

export type FaceRegion =
  | 'forehead'
  | 'eyebrowL'
  | 'eyebrowR'
  | 'eyeL'
  | 'eyeR'
  | 'noseBridge'
  | 'noseTip'
  | 'lipUpper'
  | 'lipLower'
  | 'lipInner'
  | 'cheekL'
  | 'cheekR'
  | 'jaw'
  | 'chin'
  | 'general';

export interface FaceVertex {
  index: number;
  row: number; // procedural only, -1 for OBJ
  col: number; // procedural only, -1 for OBJ
  basePos: THREE.Vector3;
  currentPos: THREE.Vector3;
  region: FaceRegion;
  sizeModifier: number;
}

export class FaceMesh {
  public geometry!: THREE.BufferGeometry;
  public vertices: FaceVertex[] = [];
  public isOBJLoaded = false;
  public downsampledLineIndices: number[] = [];
  
  private ROWS = 65; // Procedural fallback grid resolution
  private COLS = 60; // 3900 vertices total
  
  private basePositionsFlat!: Float32Array;
  private currentPositionsFlat!: Float32Array;
  private colorsFlat!: Float32Array;
  private sizeModifiersFlat!: Float32Array;

  constructor() {
    // 1. Immediately boot up with procedural geometry so we have a valid head mesh
    // before the OBJ is asynchronously fetched and loaded.
    this.initProceduralGeometry();
  }

  /**
   * Initializes the procedural grid-based head mesh.
   * Serves as immediate fallback if OBJ load fails or is missing.
   */
  private initProceduralGeometry() {
    this.geometry = new THREE.BufferGeometry();
    const count = this.ROWS * this.COLS;
    this.vertices = [];
    
    this.basePositionsFlat = new Float32Array(count * 3);
    this.currentPositionsFlat = new Float32Array(count * 3);
    this.colorsFlat = new Float32Array(count * 3);
    this.sizeModifiersFlat = new Float32Array(count);
    
    let index = 0;
    
    for (let r = 0; r < this.ROWS; r++) {
      const v = r / (this.ROWS - 1);
      
      for (let c = 0; c < this.COLS; c++) {
        const u = c / this.COLS;
        const theta = u * Math.PI * 2 - Math.PI; // -PI to PI
        
        let x = 0;
        let y = 0;
        let z = 0;
        
        if (v <= 0.6) {
          // Skull base radius
          const tHead = v / 0.6;
          const psi = tHead * Math.PI;
          y = 0.95 * Math.cos(psi) + 0.15;
          
          let rHead = 0.8 * Math.sin(psi);
          let zBackFactor = Math.cos(theta) < 0.0 ? 1.15 : 1.0;
          
          let taperX = 1.0;
          let taperZ = 1.0;
          if (psi > Math.PI / 2) {
            const tJaw = (psi - Math.PI / 2) / (Math.PI / 2);
            if (Math.cos(theta) > 0.0) {
              taperX = 1.0 - 0.44 * tJaw;
              taperZ = 1.0 - 0.22 * tJaw;
            } else {
              taperX = 1.0 - 0.22 * tJaw;
            }
          }
          
          x = rHead * 0.85 * Math.sin(theta) * taperX;
          z = rHead * 1.05 * Math.cos(theta) * zBackFactor * taperZ;
          
          const faceFront = Math.pow(Math.max(0, Math.cos(theta)), 2.5);
          
          if (faceFront > 0.001) {
            // Nose
            const noseTipY = -0.05;
            const distNoseTip = Math.pow(theta / 0.14, 2) + Math.pow((y - noseTipY) / 0.12, 2);
            const noseTip = 0.28 * Math.exp(-distNoseTip);
            const distNoseBridge = Math.pow(theta / 0.10, 2) + Math.pow((y - 0.18) / 0.26, 2);
            const noseBridge = 0.22 * Math.exp(-distNoseBridge) * (1.0 - Math.pow((y - 0.18) / 0.26, 4.0));
            z += (noseTip + noseBridge) * faceFront;
            
            // Eye socket
            const eyeTheta = 0.32;
            const eyeY = 0.20;
            const distEyeL = Math.pow((theta - eyeTheta) / 0.18, 2) + Math.pow((y - eyeY) / 0.12, 2);
            const distEyeR = Math.pow((theta + eyeTheta) / 0.18, 2) + Math.pow((y - eyeY) / 0.12, 2);
            const eyeDepression = -0.15 * Math.exp(-distEyeL) - 0.15 * Math.exp(-distEyeR);
            z += eyeDepression * faceFront;
            
            // Lips
            const mouthY = -0.32;
            const distUpperLip = Math.pow(theta / 0.3, 2) + Math.pow((y - (mouthY + 0.04)) / 0.06, 2);
            const upperLip = 0.045 * Math.exp(-distUpperLip);
            const distLowerLip = Math.pow(theta / 0.32, 2) + Math.pow((y - (mouthY - 0.04)) / 0.07, 2);
            const lowerLip = 0.055 * Math.exp(-distLowerLip);
            z += (upperLip + lowerLip) * faceFront;
          }
        } else if (v <= 0.82) {
          const tNeck = (v - 0.65) / 0.17;
          y = -0.85 - tNeck * 0.45;
          const rNeck = 0.38 * (1.0 - tNeck * 0.05);
          x = rNeck * 0.9 * Math.sin(theta);
          z = rNeck * Math.cos(theta) - 0.08 * tNeck;
        } else {
          const tChest = (v - 0.82) / 0.18;
          y = -1.3 - tChest * 0.45;
          const xFlare = 0.36 + tChest * 1.1;
          const zFlare = 0.36 + tChest * 0.35;
          x = xFlare * Math.sin(theta);
          z = zFlare * Math.cos(theta) - 0.08;
        }
        
        this.basePositionsFlat[index * 3] = x;
        this.basePositionsFlat[index * 3 + 1] = y;
        this.basePositionsFlat[index * 3 + 2] = z;
        
        this.currentPositionsFlat[index * 3] = x;
        this.currentPositionsFlat[index * 3 + 1] = y;
        this.currentPositionsFlat[index * 3 + 2] = z;
        
        this.colorsFlat[index * 3] = 0.0;
        this.colorsFlat[index * 3 + 1] = 0.95;
        this.colorsFlat[index * 3 + 2] = 1.0;
        
        const sizeModifier = 0.5 + Math.random() * 0.7;
        this.sizeModifiersFlat[index] = sizeModifier;
        
        let region: FaceRegion = 'general';
        if (v <= 0.6 && Math.cos(theta) > 0) {
          if (y >= 0.48) region = 'forehead';
          else if (y >= 0.32) {
            region = theta > 0.1 ? 'eyebrowL' : (theta < -0.1 ? 'eyebrowR' : 'forehead');
          } else if (y >= 0.12) {
            if (theta >= 0.14 && theta <= 0.52) region = 'eyeL';
            else if (theta <= -0.14 && theta >= -0.52) region = 'eyeR';
            else if (theta > -0.14 && theta < 0.14) region = 'noseBridge';
          } else if (y >= -0.1) {
            region = (theta > -0.14 && theta < 0.14) ? 'noseTip' : 'general';
          } else if (y >= -0.48) {
            if (theta >= -0.48 && theta <= 0.48) {
              region = y > -0.28 ? 'lipUpper' : (y < -0.36 ? 'lipLower' : 'lipInner');
            } else {
              region = theta > 0.48 ? 'cheekL' : 'cheekR';
            }
          } else {
            region = (theta >= -0.28 && theta <= 0.28) ? 'chin' : 'jaw';
          }
        } else {
          region = v > 0.6 ? 'jaw' : 'general';
        }
        
        this.vertices.push({
          index,
          row: r,
          col: c,
          basePos: new THREE.Vector3(x, y, z),
          currentPos: new THREE.Vector3(x, y, z),
          region,
          sizeModifier
        });
        
        index++;
      }
    }
    
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.currentPositionsFlat, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colorsFlat, 3));
    this.geometry.setAttribute('sizeModifier', new THREE.BufferAttribute(this.sizeModifiersFlat, 1));
    
    // Connect procedural grid lines
    const lineIndices: number[] = [];
    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) {
        const i = r * this.COLS + c;
        const nextC = (c + 1) % this.COLS;
        const iNextHoriz = r * this.COLS + nextC;
        
        lineIndices.push(i, iNextHoriz);
        
        if (r < this.ROWS - 1) {
          const iNextVert = (r + 1) * this.COLS + c;
          lineIndices.push(i, iNextVert);
        }
        
        if (r < this.ROWS - 1) {
          const iNextDiag1 = (r + 1) * this.COLS + nextC;
          const iNextDiag2 = (r + 1) * this.COLS + c;
          if ((r + c) % 2 === 0) {
            lineIndices.push(i, iNextDiag1);
          } else {
            lineIndices.push(iNextHoriz, iNextDiag2);
          }
        }
      }
    }
    
    this.geometry.setIndex(lineIndices);
    
    // Downsampled fallback lines (every 2nd segment for procedural)
    this.downsampledLineIndices = [];
    for (let i = 0; i < lineIndices.length; i += 4) {
      if (i + 1 < lineIndices.length) {
        this.downsampledLineIndices.push(lineIndices[i], lineIndices[i + 1]);
      }
    }
  }

  /**
   * Fetches and parses OBJ file from Vite server, scaling and classifying
   * vertices onto dynamic regions. Calibrates left and right eye centers.
   */
  public async loadOBJModel(url: string): Promise<{ eyeCenterL: THREE.Vector3; eyeCenterR: THREE.Vector3 }> {
    try {
      console.log(`FaceMesh: Fetching 3D object from ${url}...`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }
      const text = await response.text();
      console.log(`FaceMesh: Successfully read OBJ content (${(text.length / 1024 / 1024).toFixed(2)} MB). Parsing...`);
      
      const parsedVertices: THREE.Vector3[] = [];
      const parsedFaces: number[][] = [];
      
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('v ')) {
          // Parse vertex coordinates: v x y z
          const parts = line.split(/\s+/).slice(1);
          const x = parseFloat(parts[0]);
          const y = parseFloat(parts[1]);
          const z = parseFloat(parts[2]);
          if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
            parsedVertices.push(new THREE.Vector3(x, y, z));
          }
        } else if (line.startsWith('f ')) {
          // Parse faces: f v1/vt1/vn1 v2/vt2/vn2 ...
          const parts = line.split(/\s+/).slice(1);
          const faceIndices: number[] = [];
          for (let j = 0; j < parts.length; j++) {
            const idxStr = parts[j].split('/')[0];
            const idx = parseInt(idxStr, 10);
            if (!isNaN(idx)) {
              // OBJ indices are 1-based, can be negative
              const realIdx = idx > 0 ? idx - 1 : parsedVertices.length + idx;
              faceIndices.push(realIdx);
            }
          }
          if (faceIndices.length >= 3) {
            parsedFaces.push(faceIndices);
          }
        }
      }
      
      const vertexCount = parsedVertices.length;
      if (vertexCount === 0) {
        throw new Error("Parsed OBJ file contained zero vertices.");
      }
      
      console.log(`FaceMesh: Parsed ${vertexCount} vertices and ${parsedFaces.length} faces.`);
      
      // Calculate Bounding Box
      const minBounds = new THREE.Vector3(Infinity, Infinity, Infinity);
      const maxBounds = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
      
      for (const v of parsedVertices) {
        minBounds.min(v);
        maxBounds.max(v);
      }
      
      const center = new THREE.Vector3().addVectors(minBounds, maxBounds).multiplyScalar(0.5);
      const size = new THREE.Vector3().subVectors(maxBounds, minBounds);
      
      // Scale factor: scale face width (size.x) to fit exactly 1.75 units
      const scaleFactor = 1.75 / size.x;
      console.log(`FaceMesh OBJ Stats:`);
      printVector("  Raw BBox Size", size);
      printVector("  Raw BBox Center", center);
      console.log(`  Auto-Scale Factor: ${scaleFactor.toFixed(5)}`);
      
      // Setup buffers for loaded mesh
      this.vertices = [];
      this.basePositionsFlat = new Float32Array(vertexCount * 3);
      this.currentPositionsFlat = new Float32Array(vertexCount * 3);
      this.colorsFlat = new Float32Array(vertexCount * 3);
      this.sizeModifiersFlat = new Float32Array(vertexCount);
      
      // Auto-rig region categorization lists
      const eyeLVerts: THREE.Vector3[] = [];
      const eyeRVerts: THREE.Vector3[] = [];
      
      for (let i = 0; i < vertexCount; i++) {
        const rawV = parsedVertices[i];
        
        // Center, scale, and align to standard coordinate system
        // OBJ coordinates mapping:
        // - X is horizontal width (matches Three.js X)
        // - Y is vertical height (matches Three.js Y, raw Z is height, increasing upwards: Z=19.2 is top of head, Z=0 is neck base)
        // - Z is depth front-to-back (matches Three.js Z, raw Y is depth, increasing forward: Y=9.1 is nose tip, Y=-5.3 is back of skull)
        const x = (rawV.x - center.x) * scaleFactor;
        const y = (rawV.z - center.z) * scaleFactor - 0.1;
        const z = (rawV.y - center.y) * scaleFactor;
        
        const basePos = new THREE.Vector3(x, y, z);
        
        // Normalized proportions relative to bounding box [0, 1]
        const tX = (rawV.x - minBounds.x) / size.x;
        const tY = (rawV.y - minBounds.y) / size.y;
        const tZ = (rawV.z - minBounds.z) / size.z;
        
        // 2. Classify vertices based on relative anatomical layout
        // Height is raw Z (tZ), depth is raw Y (tY).
        let region: FaceRegion = 'general';
        
        if (tZ <= 0.22) {
          region = 'general'; // chest base
        } else if (tZ <= 0.33) {
          region = 'jaw'; // lower neck
        } else if (tZ >= 0.68) {
          region = 'forehead'; // skull top
        } else {
          // Face features region: tZ in (0.33, 0.68)
          if (tY >= 0.45) { // Front face
            if (tZ >= 0.62) {
              // Eyebrows
              if (tX >= 0.56) region = 'eyebrowL';
              else if (tX <= 0.44) region = 'eyebrowR';
              else region = 'forehead';
            } else if (tZ >= 0.54) {
              // Eyes
              if (tX >= 0.56) {
                region = 'eyeL';
                eyeLVerts.push(basePos);
              } else if (tX <= 0.44) {
                region = 'eyeR';
                eyeRVerts.push(basePos);
              } else {
                region = 'noseBridge';
              }
            } else if (tZ >= 0.44) {
              // Nose / Cheeks upper
              if (tX >= 0.44 && tX <= 0.56) {
                region = tY >= 0.75 ? 'noseTip' : 'noseBridge';
              } else if (tX > 0.56) {
                region = 'cheekL';
              } else if (tX < 0.44) {
                region = 'cheekR';
              } else {
                region = 'jaw';
              }
            } else if (tZ >= 0.38) {
              // Mouth / Lips
              if (tX >= 0.38 && tX <= 0.62 && tY >= 0.65) {
                if (tZ >= 0.415) region = 'lipUpper';
                else if (tZ <= 0.405) region = 'lipLower';
                else region = 'lipInner';
              } else if (tX > 0.62) {
                region = 'cheekL';
              } else if (tX < 0.38) {
                region = 'cheekR';
              } else {
                region = 'jaw';
              }
            } else {
              // Chin
              if (tX >= 0.42 && tX <= 0.58 && tY >= 0.65) {
                region = 'chin';
              } else {
                region = 'jaw';
              }
            }
          } else {
            // Back/sides of head
            region = 'general';
          }
        }
        
        // Size modifier (defines vertex scaling pulse in loops)
        const sizeModifier = 0.55 + Math.random() * 0.65;
        
        this.basePositionsFlat[i * 3] = x;
        this.basePositionsFlat[i * 3 + 1] = y;
        this.basePositionsFlat[i * 3 + 2] = z;
        
        this.currentPositionsFlat[i * 3] = x;
        this.currentPositionsFlat[i * 3 + 1] = y;
        this.currentPositionsFlat[i * 3 + 2] = z;
        
        // Initial cyan base color
        this.colorsFlat[i * 3] = 0.0;
        this.colorsFlat[i * 3 + 1] = 0.95;
        this.colorsFlat[i * 3 + 2] = 1.0;
        
        this.sizeModifiersFlat[i] = sizeModifier;
        
        this.vertices.push({
          index: i,
          row: -1,
          col: -1,
          basePos,
          currentPos: basePos.clone(),
          region,
          sizeModifier
        });
      }
      
      // Calculate eye centers dynamically
      const calcCenterL = new THREE.Vector3();
      const calcCenterR = new THREE.Vector3();
      
      if (eyeLVerts.length > 0) {
        for (const v of eyeLVerts) calcCenterL.add(v);
        calcCenterL.divideScalar(eyeLVerts.length);
      } else {
        calcCenterL.set(0.42, 0.45, 0.23); // calculated fallback
      }
      
      if (eyeRVerts.length > 0) {
        for (const v of eyeRVerts) calcCenterR.add(v);
        calcCenterR.divideScalar(eyeRVerts.length);
      } else {
        calcCenterR.set(-0.42, 0.45, 0.23); // calculated fallback
      }
      
      // Triangulate OBJ faces into line segment indices
      const lineIndices: number[] = [];
      for (const face of parsedFaces) {
        for (let j = 0; j < face.length; j++) {
          const idxA = face[j];
          const idxB = face[(j + 1) % face.length];
          // Ensure indices are within bounds
          if (idxA < vertexCount && idxB < vertexCount) {
            lineIndices.push(idxA, idxB);
          }
        }
      }
      
      // Apply parsed buffers to ThreeJS geometry
      this.geometry.dispose(); // Free GPU memory of previous geometry
      this.geometry = new THREE.BufferGeometry();
      
      this.geometry.setAttribute('position', new THREE.BufferAttribute(this.currentPositionsFlat, 3));
      this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colorsFlat, 3));
      this.geometry.setAttribute('sizeModifier', new THREE.BufferAttribute(this.sizeModifiersFlat, 1));
      this.geometry.setIndex(lineIndices);
      
      // Downsample lines for the 2D Canvas fallback (keeps CPU render loop buttery smooth)
      this.downsampledLineIndices = [];
      const downsampleStep = 10; // Draw every 5th line segment (decreases draw operations by 80%)
      for (let i = 0; i < lineIndices.length; i += downsampleStep) {
        if (i + 1 < lineIndices.length) {
          this.downsampledLineIndices.push(lineIndices[i], lineIndices[i + 1]);
        }
      }
      
      this.isOBJLoaded = true;
      console.log(`FaceMesh: OBJ mesh rigged successfully! Downsampled fallback lines: ${this.downsampledLineIndices.length / 2}`);
      
      return { eyeCenterL: calcCenterL, eyeCenterR: calcCenterR };
    } catch (e) {
      console.warn("FaceMesh: Failed to load OBJ model. Gracefully using procedural mesh fallback.", e);
      // Return default procedural eye centers
      return {
        eyeCenterL: new THREE.Vector3(0.21, 0.20, 0.65),
        eyeCenterR: new THREE.Vector3(-0.21, 0.20, 0.65)
      };
    }
  }

  /**
   * Applies offsets and colors to the buffers.
   */
  public updateGeometry(offsets: THREE.Vector3[], colors: THREE.Color[]) {
    const positionAttr = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const colorAttr = this.geometry.getAttribute('color') as THREE.BufferAttribute;
    
    if (!positionAttr || !colorAttr) return;
    
    for (let i = 0; i < this.vertices.length; i++) {
      const v = this.vertices[i];
      const offset = offsets[i] || new THREE.Vector3(0, 0, 0);
      const color = colors[i] || new THREE.Color(0x00f3ff);
      
      // Update local tracking position
      v.currentPos.copy(v.basePos).add(offset);
      
      this.currentPositionsFlat[i * 3] = v.currentPos.x;
      this.currentPositionsFlat[i * 3 + 1] = v.currentPos.y;
      this.currentPositionsFlat[i * 3 + 2] = v.currentPos.z;
      
      this.colorsFlat[i * 3] = color.r;
      this.colorsFlat[i * 3 + 1] = color.g;
      this.colorsFlat[i * 3 + 2] = color.b;
    }
    
    positionAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
  }
  
  public getVertexCount(): number {
    return this.vertices.length;
  }
}

// Helper printer functions
function printVector(label: string, v: THREE.Vector3) {
  console.log(`${label}: [x=${v.x.toFixed(3)}, y=${v.y.toFixed(3)}, z=${v.z.toFixed(3)}]`);
}
