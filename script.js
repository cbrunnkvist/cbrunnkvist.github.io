/* ═══════════════════════════════════════════════════════════════
   FRONTIER: ELITE II Interactive Elements
   WebGL2 Low-Poly Scene + UI Effects
   ═══════════════════════════════════════════════════════════════ */

// ── Clock ──
function updateClock() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    const clockEl = document.getElementById('clock');
    if (clockEl) clockEl.textContent = timeStr;
}
setInterval(updateClock, 1000);
updateClock();

// ── Typing Effect ──
const typingTexts = [
    'Platform engineering leader...',
    'Team coach & technical mentor...',
    'Infrastructure & systems builder...',
    'Nano ecosystem developer...',
    'AI-augmented creator...',
    'Long-range OSINT analyst...'
];
let textIndex = 0;
let charIndex = 0;
let isDeleting = false;
const typingElement = document.querySelector('.typing-text');

function typeEffect() {
    if (!typingElement) return;
    const currentText = typingTexts[textIndex];
    if (isDeleting) {
        typingElement.textContent = currentText.substring(0, charIndex - 1);
        charIndex--;
    } else {
        typingElement.textContent = currentText.substring(0, charIndex + 1);
        charIndex++;
    }
    let typeSpeed = isDeleting ? 50 : 100;
    if (!isDeleting && charIndex === currentText.length) {
        typeSpeed = 2000;
        isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        textIndex = (textIndex + 1) % typingTexts.length;
        typeSpeed = 500;
    }
    setTimeout(typeEffect, typeSpeed);
}
typeEffect();

// ═══════════════════════════════════════════════════════════════
// ── WebGL2 FE2-Style Low-Poly Space Scene ──
// ═══════════════════════════════════════════════════════════════
(function () {
    const canvas = document.getElementById('spaceCanvas');
    if (!canvas) return;
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
    if (!gl) return;

    let W, H;
    let resizeObserver = null;

    function resize() {
        const newW = Math.max(1, Math.floor(window.innerWidth));
        const newH = Math.max(1, Math.floor(window.innerHeight));
        if (newW === W && newH === H) return;
        W = canvas.width = newW;
        H = canvas.height = newH;
        gl.viewport(0, 0, W, H);
    }

    resize();
    window.addEventListener('resize', resize);

    // Use ResizeObserver so we react to *any* size change of the hero container,
    // including those caused by async font loading, flex settling, or sidebar content.
    // This is the main fix for "wrong on load, correct after any manual resize".
    if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => resize());
        resizeObserver.observe(canvas.parentElement);
    }

    // Fonts (Press Start 2P + VT323 + Share Tech Mono) are the most common cause
    // of late reflow in the hero. Re-measure once they are ready.
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
            resize();
            requestAnimationFrame(resize);
        });
    }

    // Extra safety nets for first-load timing (layout passes, other async resources).
    window.addEventListener('load', () => {
        resize();
        requestAnimationFrame(resize);
    });
    setTimeout(resize, 50);
    setTimeout(resize, 250);

    gl.clearColor(0.0, 0.0, 0.015, 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // ── Shaders ──
    const SOLID_VS = `#version 300 es
        layout(location=0) in vec3 aPos;
        layout(location=1) in vec3 aNorm;
        layout(location=2) in vec3 aColor;
        uniform mat4 uMVP;
        uniform mat4 uModel;
        out vec3 vNorm;
        out vec3 vColor;
        void main() {
            gl_Position = uMVP * uModel * vec4(aPos, 1.0);
            vNorm = mat3(uModel) * aNorm;
            vColor = aColor;
        }
    `;

    const SOLID_FS = `#version 300 es
        precision highp float;
        in vec3 vNorm;
        in vec3 vColor;
        uniform vec3 uLightDir;
        out vec4 fragColor;
        void main() {
            vec3 n = normalize(vNorm);
            float diff = max(dot(n, normalize(uLightDir)), 0.0);
            vec3 color = vColor * (0.12 + diff * 0.88);
            fragColor = vec4(color, 1.0);
        }
    `;

    const STAR_VS = `#version 300 es
        layout(location=0) in vec3 aPos;
        layout(location=1) in float aSize;
        uniform mat4 uMVP;
        uniform float uTime;
        out float vBright;
        void main() {
            gl_Position = uMVP * vec4(aPos, 1.0);
            gl_PointSize = aSize * 2.0 + 0.5;
            vBright = 0.6 + 0.4 * sin(uTime * 1.5 + aSize * 25.0);
        }
    `;

    const STAR_FS = `#version 300 es
        precision mediump float;
        in float vBright;
        out vec4 fragColor;
        void main() {
            vec2 p = gl_PointCoord * 2.0 - 1.0;
            float d = dot(p, p);
            float a = smoothstep(1.0, 0.2, d) * vBright;
            fragColor = vec4(0.85, 0.9, 1.0, a);
        }
    `;

    const ATMO_VS = `#version 300 es
        layout(location=0) in vec3 aPos;
        uniform mat4 uMVP;
        uniform mat4 uModelView;
        uniform float uScale;
        out vec3 vViewNorm;
        void main() {
            gl_Position = uMVP * vec4(aPos * uScale, 1.0);
            vViewNorm = mat3(uModelView) * aPos;
        }
    `;

    const ATMO_FS = `#version 300 es
        precision highp float;
        in vec3 vViewNorm;
        uniform vec3 uColor;
        uniform float uIntensity;
        out vec4 fragColor;
        void main() {
            vec3 n = normalize(vViewNorm);
            float rim = 1.0 - abs(n.z);
            float outerBand = smoothstep(0.08, 0.78, rim);
            float brightEdge = smoothstep(0.70, 0.98, rim);
            float band = max(outerBand * 0.72, brightEdge);
            fragColor = vec4(uColor, band * uIntensity);
        }
    `;

    const WIRE_VS = `#version 300 es
        layout(location=0) in vec3 aPos;
        uniform mat4 uMVP;
        void main() {
            gl_Position = uMVP * vec4(aPos, 1.0);
        }
    `;

    const WIRE_FS = `#version 300 es
        precision mediump float;
        uniform vec4 uColor;
        out vec4 fragColor;
        void main() {
            fragColor = uColor;
        }
    `;

    const PLANET_VS = `#version 300 es
        layout(location=0) in vec3 aPos;
        uniform mat4 uMVP;
        uniform mat4 uModel;
        out vec3 vWorldPos;
        void main() {
            gl_Position = uMVP * uModel * vec4(aPos, 1.0);
            vWorldPos = (uModel * vec4(aPos, 1.0)).xyz;
        }
    `;

    const PLANET_FS = `#version 300 es
        precision highp float;
        in vec3 vWorldPos;
        uniform vec3 uCamPos;
        uniform vec3 uLightDir;
        uniform float uRadius;
        out vec4 fragColor;

        float hash(vec3 p) {
            return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
        }

        float steppedNoise(vec3 p) {
            return floor(hash(floor(p)) * 5.0) / 5.0;
        }

        float continentCap(vec3 n, vec3 axis, float radius) {
            return dot(n, normalize(axis)) - radius;
        }

        float landMass(vec3 n) {
            // Multi-octave stepped noise for coastlines
            float coast = (steppedNoise(n * 5.0) - 0.5) * 0.15;
            coast += (steppedNoise(n * 9.0 + vec3(5.0, 11.0, 7.0)) - 0.5) * 0.09;
            coast += (steppedNoise(n * 17.0 + vec3(19.0, 3.0, 13.0)) - 0.5) * 0.05;

            float score = -0.48;

            // Major continents (original 5)
            score = max(score, continentCap(n, vec3(-0.78, 0.10, 0.62), 0.50));
            score = max(score, continentCap(n, vec3(-0.22,-0.55, 0.80), 0.58));
            score = max(score, continentCap(n, vec3( 0.58, 0.18, 0.70), 0.66));
            score = max(score, continentCap(n, vec3( 0.20,-0.82, 0.35), 0.60));
            score = max(score, continentCap(n, vec3(-0.60,-0.10,-0.68), 0.64));

            // Small island archipelagos
            score = max(score, continentCap(n, vec3( 0.82, 0.30,-0.30), 0.26));
            score = max(score, continentCap(n, vec3(-0.68, 0.48,-0.22), 0.24));

            return score + coast;
        }

        void main() {
            vec3 n = normalize(vWorldPos);
            vec3 rd = normalize(vWorldPos - uCamPos);

            // Polar ice caps - tiny bit of noise for natural irregularity (retro stepped look)
            float absY = abs(n.y);
            float capNoise = (steppedNoise(n * 5.0 + vec3(1.3, 4.7, 2.9)) - 0.5) * 0.03;
            float capEdge = 0.838 + capNoise;
            if (absY > capEdge) {
                vec3 iceColor = vec3(0.82, 0.86, 0.92);
                float light = dot(n, normalize(uLightDir));
                float shade = light > 0.1 ? 1.0 : light > -0.3 ? 0.6 : 0.3;
                fragColor = vec4(iceColor * shade, 1.0);
                return;
            }

            float land = landMass(n);
            vec3 baseColor;
            if (land < -0.05) {
                baseColor = vec3(0.18, 0.30, 0.56); // ocean
            } else if (land < 0.04) {
                baseColor = vec3(0.42, 0.50, 0.72); // shallow water
            } else if (land < 0.14) {
                baseColor = vec3(0.28, 0.56, 0.22); // green lowlands
            } else if (land < 0.26) {
                baseColor = vec3(0.48, 0.42, 0.26); // dry highlands
            } else {
                baseColor = vec3(0.18, 0.30, 0.56); // deep ocean (noise peaks)
            }

            float rim = 1.0 - max(dot(n, -rd), 0.0);
            float atmos = smoothstep(0.50, 0.90, rim);
            vec3 atmosColor = vec3(0.55, 0.60, 0.90);
            baseColor = mix(baseColor, atmosColor, atmos * 0.34);

            // FE2-style stepped shading (not smooth gradient)
            float lightDot = dot(n, normalize(uLightDir));
            float shade;
            if (lightDot > 0.15) shade = 1.0;
            else if (lightDot > -0.15) shade = 0.65;
            else if (lightDot > -0.45) shade = 0.38;
            else shade = 0.18;

            fragColor = vec4(baseColor * shade, 1.0);
        }
    `;

    // ── Helpers ──
    function compile(type, src) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
            console.error(gl.getShaderInfoLog(s));
        return s;
    }

    function link(vs, fs) {
        const p = gl.createProgram();
        gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
        gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS))
            console.error(gl.getProgramInfoLog(p));
        return p;
    }

    const solidProg = link(SOLID_VS, SOLID_FS);
    const starProg = link(STAR_VS, STAR_FS);
    const atmoProg = link(ATMO_VS, ATMO_FS);
    const wireProg = link(WIRE_VS, WIRE_FS);
    const planetProg = link(PLANET_VS, PLANET_FS);

    const U = (prog, names) => {
        const u = {};
        for (const n of names) u[n] = gl.getUniformLocation(prog, n);
        return u;
    };
    const solidU = U(solidProg, ['uMVP', 'uModel', 'uLightDir']);
    const starU = U(starProg, ['uMVP', 'uTime']);
    const atmoU = U(atmoProg, ['uMVP', 'uModelView', 'uScale', 'uColor', 'uIntensity']);
    const wireU = U(wireProg, ['uMVP', 'uColor']);
    const planetU = U(planetProg, ['uMVP', 'uModel', 'uCamPos', 'uLightDir', 'uRadius']);

    // ── Matrix Math ──
    const I = () => { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; };

    const perspective = (fov, asp, near, far) => {
        const m = new Float32Array(16);
        const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
        m[0] = f / asp; m[5] = f; m[10] = (far + near) * nf; m[11] = -1; m[14] = 2 * far * near * nf;
        return m;
    };

    const lookAt = (eye, center, up) => {
        let zx = eye[0] - center[0], zy = eye[1] - center[1], zz = eye[2] - center[2];
        let zl = Math.sqrt(zx * zx + zy * zy + zz * zz); zx /= zl; zy /= zl; zz /= zl;
        let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
        let xl = Math.sqrt(xx * xx + xy * xy + xz * xz); xx /= xl; xy /= xl; xz /= xl;
        let yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
        const m = new Float32Array(16);
        m[0] = xx; m[1] = yx; m[2] = zx; m[4] = xy; m[5] = yy; m[6] = zy;
        m[8] = xz; m[9] = yz; m[10] = zz; m[15] = 1;
        m[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
        m[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
        m[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
        return m;
    };

    const mul = (a, b) => {
        const m = new Float32Array(16);
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
            let v = 0; for (let k = 0; k < 4; k++) v += a[i + k * 4] * b[k + j * 4];
            m[i + j * 4] = v;
        }
        return m;
    };

    const rotY = (m, a) => {
        const r = I(); const c = Math.cos(a), s = Math.sin(a);
        r[0] = c; r[2] = s; r[8] = -s; r[10] = c;
        return mul(m, r);
    };

    const rotX = (m, a) => {
        const r = I(); const c = Math.cos(a), s = Math.sin(a);
        r[5] = c; r[6] = s; r[9] = -s; r[10] = c;
        return mul(m, r);
    };

    const translate = (m, x, y, z) => {
        const t = I(); t[12] = x; t[13] = y; t[14] = z;
        return mul(m, t);
    };

    const scale3 = (m, s) => {
        const t = I(); t[0] = s; t[5] = s; t[10] = s;
        return mul(m, t);
    };

    const scaleXYZ = (m, sx, sy, sz) => {
        const t = I(); t[0] = sx; t[5] = sy; t[10] = sz;
        return mul(m, t);
    };

    const rotZ = (m, a) => {
        const r = I(); const c = Math.cos(a), s = Math.sin(a);
        r[0] = c; r[1] = s; r[4] = -s; r[5] = c;
        return mul(m, r);
    };

    // ── Noise for procedural planet textures ──
    function noise3D(x, y, z) {
        const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
        return n - Math.floor(n);
    }

    function smoothNoise(x, y, z) {
        const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
        const fx = x - ix, fy = y - iy, fz = z - iz;
        const ux = fx * fx * (3 - 2 * fx);
        const uy = fy * fy * (3 - 2 * fy);
        const uz = fz * fz * (3 - 2 * fz);
        const n = (a, b, c) => noise3D(a, b, c);
        const nx00 = n(ix,iy,iz) + (n(ix+1,iy,iz) - n(ix,iy,iz)) * ux;
        const nx10 = n(ix,iy+1,iz) + (n(ix+1,iy+1,iz) - n(ix,iy+1,iz)) * ux;
        const nx01 = n(ix,iy,iz+1) + (n(ix+1,iy,iz+1) - n(ix,iy,iz+1)) * ux;
        const nx11 = n(ix,iy+1,iz+1) + (n(ix+1,iy+1,iz+1) - n(ix,iy+1,iz+1)) * ux;
        const nxy0 = nx00 + (nx10 - nx00) * uy;
        const nxy1 = nx01 + (nx11 - nx01) * uy;
        return nxy0 + (nxy1 - nxy0) * uz;
    }

    function fbm(x, y, z, octaves) {
        let val = 0, amp = 0.5, freq = 1;
        for (let i = 0; i < octaves; i++) {
            val += amp * smoothNoise(x * freq, y * freq, z * freq);
            amp *= 0.5;
            freq *= 2;
        }
        return val;
    }

    // ── Geometry: Icosphere ──
    function createIcosphere(subdivs) {
        const phi = (1 + Math.sqrt(5)) / 2;
        let v = [
            -1, phi, 0, 1, phi, 0, -1, -phi, 0, 1, -phi, 0,
            0, -1, phi, 0, 1, phi, 0, -1, -phi, 0, 1, -phi,
            phi, 0, -1, phi, 0, 1, -phi, 0, -1, -phi, 0, 1
        ];
        for (let i = 0; i < v.length; i += 3) {
            const l = Math.sqrt(v[i] ** 2 + v[i + 1] ** 2 + v[i + 2] ** 2);
            v[i] /= l; v[i + 1] /= l; v[i + 2] /= l;
        }
        let f = [0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11,
            1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8,
            3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9,
            4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1];

        const midCache = {};
        const getMid = (a, b) => {
            const k = a < b ? a + '_' + b : b + '_' + a;
            if (midCache[k] !== undefined) return midCache[k];
            const i = v.length / 3;
            const mx = (v[a * 3] + v[b * 3]) / 2, my = (v[a * 3 + 1] + v[b * 3 + 1]) / 2, mz = (v[a * 3 + 2] + v[b * 3 + 2]) / 2;
            const l = Math.sqrt(mx * mx + my * my + mz * mz);
            v.push(mx / l, my / l, mz / l);
            return midCache[k] = i;
        };

        for (let s = 0; s < subdivs; s++) {
            const nf = [];
            for (let i = 0; i < f.length; i += 3) {
                const a = f[i], b = f[i + 1], c = f[i + 2];
                const ab = getMid(a, b), bc = getMid(b, c), ca = getMid(c, a);
                nf.push(a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca);
            }
            f = nf;
        }

        const pos = [], nrm = [], col = [];
        const edgeSet = new Set(), edgePos = [];

        for (let i = 0; i < f.length; i += 3) {
            const ai = f[i] * 3, bi = f[i + 1] * 3, ci = f[i + 2] * 3;
            const ax = v[ai], ay = v[ai + 1], az = v[ai + 2];
            const bx = v[bi], by = v[bi + 1], bz = v[bi + 2];
            const cx = v[ci], cy = v[ci + 1], cz = v[ci + 2];

            const nal = Math.sqrt(ax*ax + ay*ay + az*az) || 1;
            const nbl = Math.sqrt(bx*bx + by*by + bz*bz) || 1;
            const ncl = Math.sqrt(cx*cx + cy*cy + cz*cz) || 1;
            const nax = ax/nal, nay = ay/nal, naz = az/nal;
            const nbx = bx/nbl, nby = by/nbl, nbz = bz/nbl;
            const ncx = cx/ncl, ncy = cy/ncl, ncz = cz/ncl;

            pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
            nrm.push(nax, nay, naz, nbx, nby, nbz, ncx, ncy, ncz);

            // Earth-like procedural coloring
            // Sample noise at face center for consistent color per face
            const fcx = (ax + bx + cx) / 3;
            const fcy = (ay + by + cy) / 3;
            const fcz = (az + bz + cz) / 3;

            const continent = fbm(fcx * 2 + 50, fcy * 2 + 50, fcz * 2 + 50, 3);
            const detail = fbm(fcx * 6 + 100, fcy * 6 + 100, fcz * 6 + 100, 2);
            const absY = Math.abs(fcy);

            let r, g, b;
            if (absY > 0.838) {
                // Polar ice caps (hard threshold here; shader adds irregularity for rendered planet)
                r = 0.82 + detail * 0.1; g = 0.85 + detail * 0.08; b = 0.9 + detail * 0.05;
            } else if (continent < 0.40) {
                // Deep ocean
                r = 0.04; g = 0.10 + detail * 0.05; b = 0.28 + detail * 0.08;
            } else if (continent < 0.48) {
                // Shallow water
                r = 0.06; g = 0.18 + detail * 0.06; b = 0.38 + detail * 0.06;
            } else if (continent < 0.52) {
                // Coastal sand
                r = 0.58; g = 0.52; b = 0.32;
            } else if (continent < 0.70) {
                // Green land
                r = 0.12 + detail * 0.08; g = 0.30 + detail * 0.12; b = 0.08 + detail * 0.04;
            } else if (continent < 0.82) {
                // Brown highlands
                r = 0.30 + detail * 0.08; g = 0.22 + detail * 0.06; b = 0.12;
            } else {
                // Mountain peaks (grey)
                const snow = (continent - 0.82) * 4;
                r = 0.42 + snow * 0.35; g = 0.40 + snow * 0.35; b = 0.38 + snow * 0.35;
            }

            col.push(r, g, b, r, g, b, r, g, b);

            for (const [e1, e2] of [[f[i], f[i + 1]], [f[i + 1], f[i + 2]], [f[i + 2], f[i]]]) {
                const k = e1 < e2 ? e1 + '_' + e2 : e2 + '_' + e1;
                if (!edgeSet.has(k)) {
                    edgeSet.add(k);
                    edgePos.push(v[e1 * 3], v[e1 * 3 + 1], v[e1 * 3 + 2], v[e2 * 3], v[e2 * 3 + 1], v[e2 * 3 + 2]);
                }
            }
        }

        return {
            positions: new Float32Array(pos),
            normals: new Float32Array(nrm),
            colors: new Float32Array(col),
            edges: new Float32Array(edgePos),
            vertexCount: pos.length / 3,
            edgeCount: edgePos.length / 3
        };
    }

    // ── Geometry: Cobra MKIII (from Oolite: oolite/Resources/Models/cobra3_redux.dat) ──
    // 12 vertices, 20 faces, 130x30x65 model-units, CCW winding, licensed GPLv2+
    function createCobraMk3() {
        const pos = [], nrm = [], col = [];
        const s = 0.01; // scale factor: 130 wide → 1.3 world-units

        const verts = [
            0.00*s,  15.00*s,   0.00*s,   // 0  top-center nose
           16.00*s,  -0.50*s,  32.50*s,   // 1  right nose tip
          -16.00*s,  -0.50*s,  32.50*s,   // 2  left nose tip
           16.00*s, -15.00*s, -32.50*s,   // 3  right tail
          -16.00*s, -15.00*s, -32.50*s,   // 4  left tail
          -44.00*s,  10.00*s, -32.50*s,   // 5  left wing top
          -60.00*s,  -3.00*s, -13.00*s,   // 6  left wing mid
          -65.00*s,  -3.00*s, -32.50*s,   // 7  left wing tip
           44.00*s,  10.00*s, -32.50*s,   // 8  right wing top
           60.00*s,  -3.00*s, -13.00*s,   // 9  right wing mid
           65.00*s,  -3.00*s, -32.50*s,   // 10 right wing tip
            0.00*s,  15.00*s, -32.50*s,   // 11 top-center tail
        ];

        // faces: [vi0, vi1, vi2, nx, ny, nz]
        const faces = [
            [1,0,8,    0.31034, 0.90832, 0.28042],
            [2,0,1,    0.00000, 0.90260, 0.43047],
            [3,1,9,    0.16730,-0.96225, 0.21466],
            [4,2,1,    0.00000,-0.97601, 0.21773],
            [4,1,3,    0.00000,-0.97601, 0.21773],
            [4,7,6,   -0.23743,-0.96950, 0.06088],
            [5,0,2,   -0.31034, 0.90832, 0.28042],
            [5,2,6,   -0.35745, 0.88545, 0.29701],
            [6,2,4,   -0.16730,-0.96225, 0.21466],
            [7,5,6,   -0.52163, 0.84263, 0.13375],
            [8,0,11,   0.11291, 0.99361, 0.00000],
            [8,11,5,   0.00000, 0.00000,-1.00000],
            [8,5,7,    0.00000, 0.00000,-1.00000],
            [8,7,4,    0.00000, 0.00000,-1.00000],
            [8,4,3,    0.00000, 0.00000,-1.00000],
            [8,3,10,   0.00000, 0.00000,-1.00000],
            [9,1,8,    0.35745, 0.88545, 0.29701],
            [9,8,10,   0.52163, 0.84263, 0.13375],
            [9,10,3,   0.23743,-0.96950, 0.06088],
            [11,0,5,  -0.11291, 0.99361, 0.00000],
        ];

        for (const f of faces) {
            const [i0,i1,i2] = f;
            const ax=verts[i0*3], ay=verts[i0*3+1], az=verts[i0*3+2];
            const bx=verts[i1*3], by=verts[i1*3+1], bz=verts[i1*3+2];
            const cx=verts[i2*3], cy=verts[i2*3+1], cz=verts[i2*3+2];
            const nx=f[3], ny=f[4], nz=f[5];

            // Color by face orientation
            const top = ny;
            let r, g, b;
            if (top > 0.8) {
                // Top surfaces: lighter metallic
                r = 0.62; g = 0.64; b = 0.70;
            } else if (top > 0.3) {
                // Upper-angled faces
                r = 0.52; g = 0.54; b = 0.58;
            } else if (top > -0.3) {
                // Side faces: medium
                r = 0.42; g = 0.44; b = 0.48;
            } else if (top > -0.8) {
                // Lower-angled faces
                r = 0.35; g = 0.37; b = 0.40;
            } else {
                // Bottom: dark
                r = 0.28; g = 0.30; b = 0.33;
            }

            pos.push(ax,ay,az, bx,by,bz, cx,cy,cz);
            nrm.push(nx,ny,nz, nx,ny,nz, nx,ny,nz);
            col.push(r,g,b, r,g,b, r,g,b);
        }

        return {
            positions: new Float32Array(pos),
            normals: new Float32Array(nrm),
            colors: new Float32Array(col),
            vertexCount: pos.length / 3
        };
    }

    // ── Geometry: Engine Flame ──
    function createFlameGeometry() {
        // Diamond cross-section flame: base at z=0, tip at z=-1
        // Scale Z at render time to animate length
        const bx = 0.14, by = 0.09; // base half-spreads
        const pos = [
            // 4 triangles from base edges to tip
            -bx, 0, 0,    0,  by, 0,    0, 0, -1,
             0,  by, 0,    bx, 0, 0,    0, 0, -1,
             bx, 0, 0,    0, -by*0.7,0, 0, 0, -1,
             0, -by*0.7,0,-bx, 0, 0,    0, 0, -1,
        ];
        const nrm = [];
        for (let i = 0; i < pos.length; i += 3) nrm.push(0, 1, 0);
        return {
            positions: new Float32Array(pos),
            normals: new Float32Array(nrm),
            vertexCount: pos.length / 3,
        };
    }

    // ── Geometry: Trim Thruster Puff ──
    function createThrusterGeometry() {
        // Small single triangle for a thruster puff
        const s = 0.06;
        return {
            positions: new Float32Array([
                -s, 0, 0,   s, 0, 0,   0, 0, -s*2.5,
            ]),
            normals: new Float32Array([0,1,0, 0,1,0, 0,1,0]),
            vertexCount: 3,
        };
    }

    // ── Geometry: Starfield ──
    function createStars(count) {
        const pos = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = 80 + Math.random() * 120;
            pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            pos[i * 3 + 2] = r * Math.cos(phi);
            sizes[i] = 0.5 + Math.random() * 2.0;
        }
        return { positions: pos, sizes, count };
    }

    // ── Create Geometry & Buffers ──
    const planet = createIcosphere(3);
    const shipGeom = createCobraMk3();
    const stars = createStars(600);

    function makeBuf(data, target) {
        const b = gl.createBuffer();
        gl.bindBuffer(target || gl.ARRAY_BUFFER, b);
        gl.bufferData(target || gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        return b;
    }

    const planetPosBuf = makeBuf(planet.positions);
    const planetNormBuf = makeBuf(planet.normals);
    const planetColorBuf = makeBuf(planet.colors);
    const planetEdgeBuf = makeBuf(planet.edges);

    const shipPosBuf = makeBuf(shipGeom.positions);
    const shipNormBuf = makeBuf(shipGeom.normals);
    const shipColorBuf = makeBuf(shipGeom.colors);

    const starPosBuf = makeBuf(stars.positions);
    const starSizeBuf = makeBuf(stars.sizes);

    const flameGeom = createFlameGeometry();
    const flamePosBuf = makeBuf(flameGeom.positions);
    const flameNormBuf = makeBuf(flameGeom.normals);

    const thrusterGeom = createThrusterGeometry();
    const thrusterPosBuf = makeBuf(thrusterGeom.positions);
    const thrusterNormBuf = makeBuf(thrusterGeom.normals);

    // ── Elite II: Frontier style "starfield-lite" / travel particles ──
    // Tiny particles occasionally flying past in the ship's travel direction.
    // Spawned relative to the current ship position + heading so the effect
    // feels attached to an external camera "with" the ship. Particles are
    // given velocity along the nose (+Z in the Cobra model) so they travel
    // the same way the ship is heading (thrusters = back).
    const maxTravelParticles = 48;
    const travelParticles = []; // { pos: [x,y,z], vel: [x,y,z], life: number }[]
    const travelPosBuf = makeBuf(new Float32Array(maxTravelParticles * 3));
    const travelSizeBuf = makeBuf(new Float32Array(maxTravelParticles));

    // ── Render ──
    let time = 0;
    const lightDir = new Float32Array([0.6, 0.8, 0.5]);

    // Reusable VAO-like binding helpers
    function bindSolid(posBuf, normBuf, colorBuf, vertCount) {
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, normBuf);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuf);
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0);
        return vertCount;
    }

    function disableAttribs() {
        gl.disableVertexAttribArray(0);
        gl.disableVertexAttribArray(1);
        gl.disableVertexAttribArray(2);
    }

    function render() {
        time += 0.016;

        gl.viewport(0, 0, W, H);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const aspect = W / H;
        const proj = perspective(0.7, aspect, 0.1, 500);
        const view = lookAt([0, 1.8, 7.2], [0, 0, 0], [0, 1, 0]);
        const vp = mul(proj, view);

        // ── Update & spawn Elite II-style travel particles (relative to ship) ──
        // These give a sense of motion in the direction the ship is travelling.
        // The external camera feels "with" the ship because particles are spawned
        // using its current world position + orientation (nose = forward).
        {
            const DT = 0.016;
            const TRAVEL_SPEED = 4.2; // artistic relative speed (not the real slow orbital speed)

            // Compute current ship position + forward from the same rules used for rendering the Cobra.
            // (Duplicated math is small and keeps the draw site untouched.)
            const orbitA = time * 0.035;
            const orbitR = 3.0;
            const sx = Math.cos(orbitA) * orbitR;
            const sz = Math.sin(orbitA) * orbitR;
            const sy = Math.sin(time * 0.25) * 0.15 + 0.3;
            const theta = -orbitA + Math.PI / 2;
            const phi = Math.sin(time * 0.2) * 0.04;

            const shipPos = [sx, sy, sz];

            // Build the rotation part that orients the ship (Ry * Rx applied to model dirs).
            // This matches how shipModel is later constructed for drawing.
            let rx = rotX(I(), phi);
            let ry = rotY(I(), theta);
            let shipRotM = mul(ry, rx);

            // Local +Z in the Cobra model is the nose (front). Thrusters are on the -Z back.
            const localFwd = [0, 0, 1];
            let shipFwd = [
                shipRotM[0] * localFwd[0] + shipRotM[4] * localFwd[1] + shipRotM[8] * localFwd[2],
                shipRotM[1] * localFwd[0] + shipRotM[5] * localFwd[1] + shipRotM[9] * localFwd[2],
                shipRotM[2] * localFwd[0] + shipRotM[6] * localFwd[1] + shipRotM[10] * localFwd[2]
            ];
            const fl = Math.hypot(shipFwd[0], shipFwd[1], shipFwd[2]) || 1;
            shipFwd[0] /= fl; shipFwd[1] /= fl; shipFwd[2] /= fl;

            // Update living particles (they move in world space)
            for (let i = travelParticles.length - 1; i >= 0; i--) {
                const p = travelParticles[i];
                p.pos[0] += p.vel[0] * DT;
                p.pos[1] += p.vel[1] * DT;
                p.pos[2] += p.vel[2] * DT;
                p.life -= DT;
                if (p.life <= 0) {
                    travelParticles.splice(i, 1);
                }
            }

            // Occasionally spawn new ones *ahead* of the ship (positive local Z) with velocity
            // opposite to the current heading. They will fly backward and visibly stream past
            // as the ship speeds forward through space.
            if (travelParticles.length < maxTravelParticles && Math.random() < 0.13) {
                const spawnCount = (Math.random() < 0.25) ? 2 : 1;
                for (let k = 0; k < spawnCount; k++) {
                    // Local offset: ahead of the nose + some sideways/up jitter.
                    // Positive local Z = nose direction in the Cobra model.
                    const localZ = (2.8 + Math.random() * 3.2); // ahead
                    const localX = (Math.random() - 0.5) * 2.4;
                    const localY = (Math.random() - 0.5) * 1.7;
                    const localOff = [localX, localY, localZ];

                    // Transform local offset by the ship's current orientation into world
                    const off = [
                        shipRotM[0]*localOff[0] + shipRotM[4]*localOff[1] + shipRotM[8]*localOff[2],
                        shipRotM[1]*localOff[0] + shipRotM[5]*localOff[1] + shipRotM[9]*localOff[2],
                        shipRotM[2]*localOff[0] + shipRotM[6]*localOff[1] + shipRotM[10]*localOff[2]
                    ];

                    const pos = [
                        shipPos[0] + off[0],
                        shipPos[1] + off[1],
                        shipPos[2] + off[2]
                    ];

                    // Velocity opposite to ship's heading — particles stream past as ship flies forward.
                    const spd = TRAVEL_SPEED + (Math.random() - 0.5) * 2.2;
                    const vel = [
                        -shipFwd[0] * spd + (Math.random() - 0.5) * 1.8,
                        -shipFwd[1] * spd + (Math.random() - 0.5) * 1.4,
                        -shipFwd[2] * spd + (Math.random() - 0.5) * 1.8
                    ];

                    travelParticles.push({
                        pos: pos,
                        vel: vel,
                        life: 1.8 + Math.random() * 2.2
                    });
                }
            }

            // Upload current particles to the GPU buffers (dynamic, small count)
            if (travelParticles.length > 0) {
                const ppos = new Float32Array(maxTravelParticles * 3);
                const psize = new Float32Array(maxTravelParticles);
                for (let i = 0; i < travelParticles.length; i++) {
                    const p = travelParticles[i];
                    const b = i * 3;
                    ppos[b + 0] = p.pos[0];
                    ppos[b + 1] = p.pos[1];
                    ppos[b + 2] = p.pos[2];
                    // Slightly boosted size vs distant stars for better (but still subtle) visibility
                    // as motion particles streak past the ship/camera viewpoint.
                    const lifeFade = Math.max(0.35, Math.min(1.0, p.life / 2.6));
                    psize[i] = (0.65 + Math.random() * 0.75) * lifeFade;
                }
                gl.bindBuffer(gl.ARRAY_BUFFER, travelPosBuf);
                gl.bufferData(gl.ARRAY_BUFFER, ppos, gl.DYNAMIC_DRAW);
                gl.bindBuffer(gl.ARRAY_BUFFER, travelSizeBuf);
                gl.bufferData(gl.ARRAY_BUFFER, psize, gl.DYNAMIC_DRAW);
            }
        }

        // === Stars ===
        gl.useProgram(starProg);
        gl.uniformMatrix4fv(starU.uMVP, false, vp);
        gl.uniform1f(starU.uTime, time);
        gl.bindBuffer(gl.ARRAY_BUFFER, starPosBuf);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, starSizeBuf);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 0, 0);
        gl.depthMask(false);
        gl.drawArrays(gl.POINTS, 0, stars.count);
        gl.depthMask(true);
        gl.disableVertexAttribArray(1);

        // === Planet (FE2-style fragment shader sphere) ===
        const planetRot = rotY(I(), time * 0.06);
        const planetModel = mul(translate(I(), 0, 0.25, 0), planetRot);  // small +Y world offset to shift cap vertically up relative to 2D hero text
        const planetMvp = mul(vp, planetModel);
        gl.useProgram(planetProg);
        gl.uniformMatrix4fv(planetU.uMVP, false, vp);
        gl.uniformMatrix4fv(planetU.uModel, false, planetModel);
        gl.uniform3f(planetU.uCamPos, 0, 1.55, 7.2);  // adjusted to keep relative cam-to-planet-center the same for shading
        gl.uniform3fv(planetU.uLightDir, lightDir);
        gl.uniform1f(planetU.uRadius, 1.0);
        gl.bindBuffer(gl.ARRAY_BUFFER, planetPosBuf);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.disableVertexAttribArray(1);
        gl.disableVertexAttribArray(2);
        gl.drawArrays(gl.TRIANGLES, 0, planet.vertexCount);

        // === Planet atmosphere bands ===
        gl.useProgram(atmoProg);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        gl.depthMask(false);
        gl.uniformMatrix4fv(atmoU.uMVP, false, planetMvp);
        gl.uniformMatrix4fv(atmoU.uModelView, false, mul(view, planetModel));
        gl.uniform1f(atmoU.uScale, 1.11);
        gl.uniform3f(atmoU.uColor, 0.34, 0.55, 0.92);
        gl.uniform1f(atmoU.uIntensity, 0.34);
        gl.bindBuffer(gl.ARRAY_BUFFER, planetPosBuf);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, planet.vertexCount);
        gl.depthMask(true);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // === Travel particles (Elite II: Frontier "starfield-lite") ===
        // Drawn with the same soft point shader as the distant stars.
        // depthMask(false) keeps these tiny motion specks visible as they
        // streak past the ship from the external camera's viewpoint.
        if (travelParticles.length > 0) {
            gl.useProgram(starProg);
            gl.uniformMatrix4fv(starU.uMVP, false, vp);
            gl.uniform1f(starU.uTime, time);
            gl.bindBuffer(gl.ARRAY_BUFFER, travelPosBuf);
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, travelSizeBuf);
            gl.enableVertexAttribArray(1);
            gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 0, 0);
            gl.depthMask(false);
            gl.drawArrays(gl.POINTS, 0, travelParticles.length);
            gl.depthMask(true);
            gl.disableVertexAttribArray(1);
            gl.disableVertexAttribArray(0);
        }

        // === Ship ===
        gl.useProgram(solidProg);
        const orbitA = time * 0.035;
        const orbitR = 3.0;
        const sx = Math.cos(orbitA) * orbitR;
        const sz = Math.sin(orbitA) * orbitR;
        const sy = Math.sin(time * 0.25) * 0.15 + 0.3;
        let shipModel = I();
        shipModel = translate(shipModel, sx, sy, sz);
        shipModel = rotY(shipModel, -orbitA + Math.PI / 2);
        shipModel = rotX(shipModel, Math.sin(time * 0.2) * 0.04);
        shipModel = scale3(shipModel, 0.6);
        gl.uniformMatrix4fv(solidU.uMVP, false, vp);
        gl.uniformMatrix4fv(solidU.uModel, false, shipModel);
        gl.uniform3fv(solidU.uLightDir, lightDir);
        const sc = bindSolid(shipPosBuf, shipNormBuf, shipColorBuf, shipGeom.vertexCount);
        gl.drawArrays(gl.TRIANGLES, 0, sc);

        // === Engine Flames (additive blend) ===
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        const flameColor = new Float32Array([0.4, 0.92, 1.0]);

        // Main rear engine flame
        const mainJitter = Math.sin(time * 47.3) * 0.06 + Math.sin(time * 31.1) * 0.04;
        const surgeTick = Math.floor(time * 3.5);
        const sH = Math.sin(surgeTick * 93.7 + 17.3) * 43758.5453;
        const sR = sH - Math.floor(sH);
        const prevH = Math.sin((surgeTick - 1) * 93.7 + 17.3) * 43758.5453;
        const prevR = prevH - Math.floor(prevH);
        const mainSurge = (sR > 0.78) ? 0.25 + sR * 0.2 : (prevR > 0.78) ? 0.12 + prevR * 0.08 : 0;
        const flameLen = 0.4 + mainJitter + mainSurge;
        let flameModel = translate(shipModel, 0, 0, -0.325);
        flameModel = scaleXYZ(flameModel, 1, 1, flameLen);
        gl.uniformMatrix4fv(solidU.uMVP, false, vp);
        gl.uniformMatrix4fv(solidU.uModel, false, flameModel);
        gl.uniform3fv(solidU.uLightDir, new Float32Array([0, 1, 0]));
        gl.bindBuffer(gl.ARRAY_BUFFER, flamePosBuf);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, flameNormBuf);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.disableVertexAttribArray(2);
        gl.vertexAttrib3f(2, flameColor[0], flameColor[1], flameColor[2]);
        gl.drawArrays(gl.TRIANGLES, 0, flameGeom.vertexCount);

        // Trim thrusters (intermittent bursts)
        const thrusters = [
            { x:-0.65, y:-0.03, z:-0.30, rx:0, ry:0, rz:1, freq:3.7, phase:0.0 },
            { x: 0.65, y:-0.03, z:-0.30, rx:0, ry:0, rz:1, freq:4.3, phase:1.7 },
            { x: 0,    y: 0.15, z:-0.15, rx:0, ry:0, rz:1, freq:5.1, phase:3.1 },
            { x: 0,   y:-0.13, z:-0.15, rx:0, ry:0, rz:1, freq:2.9, phase:5.0 },
        ];
        gl.bindBuffer(gl.ARRAY_BUFFER, thrusterPosBuf);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, thrusterNormBuf);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
        gl.disableVertexAttribArray(2);
        gl.vertexAttrib3f(2, 0.3, 0.85, 1.0);

        for (const t of thrusters) {
            // Discrete time steps: check every ~0.12s for sharp on/off
            const burstInterval = 0.12 + t.phase * 0.015;
            const burstTick = Math.floor(time / burstInterval);
            const h = Math.sin(burstTick * 127.1 + t.freq * 311.7 + t.phase * 74.3) * 43758.5453;
            const rand = h - Math.floor(h);
            const isFiring = rand > 0.55;

            if (isFiring) {
                // Random rotation around flame axis (vibration)
                const vibAngle = (rand * 20 + time * 18) % (Math.PI * 2);
                const tScale = 0.09 + rand * 0.11;
                let tModel = translate(shipModel, t.x, t.y, t.z);
                tModel = rotZ(tModel, vibAngle);
                tModel = scaleXYZ(tModel, tScale, tScale, tScale * 1.3);
                gl.uniformMatrix4fv(solidU.uModel, false, tModel);
                gl.drawArrays(gl.TRIANGLES, 0, thrusterGeom.vertexCount);
            }
        }

        // Restore normal blending
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        disableAttribs();
        requestAnimationFrame(render);
    }

    render();
})();

// ── Nav Bar FE2 Galaxy Map Canvas ──
(function () {
    const navCanvas = document.getElementById('navCanvas');
    if (!navCanvas) return;
    const ctx = navCanvas.getContext('2d');

    let w, h;
    let navResizeObserver = null;

    function resize() {
        const parent = navCanvas.parentElement;
        if (!parent) return;
        const rect = parent.getBoundingClientRect();
        const newW = Math.max(1, Math.floor(rect.width));
        const newH = Math.max(1, Math.floor(rect.height));
        if (newW === w && newH === h) return;
        w = navCanvas.width = newW;
        h = navCanvas.height = newH;
    }

    resize();
    window.addEventListener('resize', resize);

    if (typeof ResizeObserver !== 'undefined') {
        navResizeObserver = new ResizeObserver(() => resize());
        navResizeObserver.observe(navCanvas.parentElement);
    }

    // Match the safety used for the hero space canvas.
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(resize);
    }
    window.addEventListener('load', resize);
    setTimeout(resize, 100);

    const nodeCount = 28;
    const nodes = [];
    for (let i = 0; i < nodeCount; i++) {
        const radius = Math.pow(Math.random(), 1.8) * 0.9 + 0.05;
        nodes.push({
            angle: Math.random() * Math.PI * 2,
            radius,
            size: Math.random() * 2 + 0.8,
            major: Math.random() < 0.18,
            phase: Math.random() * Math.PI * 2,
            hue: 210 + Math.random() * 50,
        });
    }

    const connections = [];
    const cx = 0, cy = 0;
    const rx = 1.0, ry = 0.55;
    const connectThresh = 0.22;

    function toXY(node) {
        return {
            x: cx + Math.cos(node.angle) * rx * node.radius,
            y: cy + Math.sin(node.angle) * ry * node.radius,
        };
    }

    const screenNodes = nodes.map(toXY);
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            const dx = screenNodes[i].x - screenNodes[j].x;
            const dy = screenNodes[i].y - screenNodes[j].y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < connectThresh) {
                connections.push({ i, j, dist: d });
            }
        }
    }

    let rotation = 0;
    const centerX = () => w / 2;
    const centerY = () => h / 2;
    const scaleX = () => w * 0.72;
    const scaleY = () => h * 0.68;

    function draw(timestamp) {
        if (navCanvas.parentElement.getBoundingClientRect().height === 0) {
            requestAnimationFrame(draw);
            return;
        }

        ctx.clearRect(0, 0, w, h);

        rotation += 0.0008;
        const t = timestamp * 0.001;
        const bobX = Math.sin(t * 0.3) * w * 0.015;
        const bobY = Math.cos(t * 0.22) * h * 0.02;
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const sx = scaleX();
        const sy = scaleY();
        const midX = centerX() + bobX;
        const midY = centerY() + bobY;

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';

        const gridStep = Math.max(48, Math.floor(w / 12));

        ctx.strokeStyle = 'rgba(0, 255, 65, 0.22)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (let x = (midX % gridStep) - gridStep; x < w + gridStep; x += gridStep) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x + Math.sin(t * 0.25) * 6, h);
        }
        for (let y = (midY % gridStep) - gridStep; y < h + gridStep; y += gridStep) {
            ctx.moveTo(0, y);
            ctx.lineTo(w, y + Math.cos(t * 0.25) * 4);
        }
        ctx.stroke();

        const centerGlow = ctx.createRadialGradient(midX, midY, 0, midX, midY, sx * 0.5);
        centerGlow.addColorStop(0, 'rgba(0, 255, 80, 0.12)');
        centerGlow.addColorStop(0.5, 'rgba(0, 255, 80, 0.05)');
        centerGlow.addColorStop(1, 'rgba(0, 255, 80, 0)');
        ctx.fillStyle = centerGlow;
        ctx.beginPath();
        ctx.ellipse(midX, midY, sx * 0.5, sy * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(0, 255, 65, 0.35)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(midX, midY, sx * 0.35, sy * 0.30, rotation * 0.3, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(0, 255, 65, 0.18)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(midX, midY, sx * 0.55, sy * 0.48, -rotation * 0.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        ctx.strokeStyle = 'rgba(80, 220, 160, 0.30)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (const { i, j, dist } of connections) {
            const a = nodes[i], b = nodes[j];
            const aOsc = Math.sin(t * 1.8 + a.phase) * 0.04;
            const bOsc = Math.sin(t * 1.8 + b.phase) * 0.04;
            const ar = a.radius + aOsc;
            const br = b.radius + bOsc;
            const ax = midX + (cos * Math.cos(a.angle) - sin * Math.sin(a.angle)) * sx * ar;
            const ay = midY + (sin * Math.cos(a.angle) + cos * Math.sin(a.angle)) * sy * ar;
            const bx = midX + (cos * Math.cos(b.angle) - sin * Math.sin(b.angle)) * sx * br;
            const by = midY + (sin * Math.cos(b.angle) + cos * Math.sin(b.angle)) * sy * br;
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
        }
        ctx.stroke();

        for (const node of nodes) {
            const aOsc = Math.sin(t * 1.8 + node.phase) * 0.04;
            const a = node.angle + rotation;
            const r = node.radius + aOsc;
            const x = midX + Math.cos(a) * sx * r;
            const y = midY + Math.sin(a) * sy * r;
            const twinkle = 0.55 + 0.45 * Math.sin(timestamp * 0.002 + node.phase);

            if (node.major) {
                ctx.fillStyle = `rgba(255, 220, 120, ${0.50 + twinkle * 0.20})`;
                ctx.beginPath();
                ctx.arc(x, y, node.size + 1.5, 0, Math.PI * 2);
                ctx.fill();
                const glow = ctx.createRadialGradient(x, y, 0, x, y, node.size + 5);
                glow.addColorStop(0, `rgba(255, 220, 120, ${0.24 + twinkle * 0.12})`);
                glow.addColorStop(1, 'rgba(220, 200, 140, 0)');
                ctx.fillStyle = glow;
                ctx.beginPath();
                ctx.arc(x, y, node.size + 5, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillStyle = `rgba(120, 220, 180, ${0.40 + twinkle * 0.20})`;
                ctx.beginPath();
                ctx.arc(x, y, node.size + 0.2, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
})();

// ── Nav active state on click ──
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
    });
});

// ── Intersection Observer for Section Animations ──
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

document.querySelectorAll('section').forEach(section => {
    section.style.opacity = '0';
    section.style.transform = 'translateY(20px)';
    section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(section);
});

// ── Skill Bar Animation ──
const skillObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const fills = entry.target.querySelectorAll('.skill-fill');
            fills.forEach(fill => {
                const width = fill.style.width;
                fill.style.width = '0%';
                setTimeout(() => { fill.style.width = width; }, 100);
            });
            skillObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

const skillsGrid = document.querySelector('.skills-grid');
if (skillsGrid) skillObserver.observe(skillsGrid);

// ── Glitch Effect on Title (click to trigger) ──
const heroTitle = document.querySelector('.hero-title');
if (heroTitle) {
    heroTitle.addEventListener('click', () => {
        const g = () => `${Math.random() * 50 - 25}px ${Math.random() * 30 - 15}px`;
        heroTitle.style.textShadow = `${g()} 0 var(--fe2-red), ${g()} 0 var(--fe2-cyan)`;
        setTimeout(() => {
            heroTitle.style.textShadow = `${g()} 0 var(--fe2-red), ${g()} 0 var(--fe2-cyan)`;
        }, 80);
        setTimeout(() => {
            heroTitle.style.textShadow = '1px 1px 0 var(--fe2-panel)';
        }, 180);
    });
}

// ── Console Easter Egg ──
console.log('%c CASUALSECURITYINC SYSTEM INITIALIZED ',
    'color: #00ff41; font-size: 20px; font-family: monospace;');
console.log('%c> Commander: Conny Brunnkvist',
    'color: #ffcc00; font-size: 14px; font-family: monospace;');
console.log('%c> Ship: Eagle Mk-II',
    'color: #00ffff; font-size: 14px; font-family: monospace;');
console.log('%c> Status: ACTIVE - Operating on the digital frontier',
    'color: #00ff41; font-size: 14px; font-family: monospace;');
