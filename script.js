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
    'Long-range security operations...',
    'Penetration testing specialist...',
    'Vulnerability researcher...',
    'Digital frontier explorer...',
    'Elite rank security contractor...'
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
    function resize() {
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
        gl.viewport(0, 0, W, H);
    }
    resize();
    window.addEventListener('resize', resize);

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
            float facing = max(-n.z, 0.0);
            float rim = pow(1.0 - facing, 2.5);
            fragColor = vec4(uColor, rim * uIntensity);
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

    const U = (prog, names) => {
        const u = {};
        for (const n of names) u[n] = gl.getUniformLocation(prog, n);
        return u;
    };
    const solidU = U(solidProg, ['uMVP', 'uModel', 'uLightDir']);
    const starU = U(starProg, ['uMVP', 'uTime']);
    const atmoU = U(atmoProg, ['uMVP', 'uModelView', 'uScale', 'uColor', 'uIntensity']);
    const wireU = U(wireProg, ['uMVP', 'uColor']);

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

            const ux = bx - ax, uy = by - ay, uz = bz - az;
            const vx = cx - ax, vy = cy - ay, vz = cz - az;
            let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
            const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
            nx /= nl; ny /= nl; nz /= nl;

            pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
            nrm.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);

            const up = ny;
            let r, g, b;
            if (up > 0.5) {
                r = 0.7 + up * 0.2; g = 0.75 + up * 0.15; b = 0.85 + up * 0.1;
            } else if (up > 0.0) {
                r = 0.15 + up * 0.25; g = 0.35 + up * 0.3; b = 0.15 + up * 0.1;
            } else if (up > -0.5) {
                r = 0.25 - up * 0.1; g = 0.3 - up * 0.05; b = 0.18;
            } else {
                r = 0.12; g = 0.18 - up * 0.1; b = 0.28 - up * 0.1;
            }
            const hash = ((f[i] * 7 + f[i + 1] * 13 + f[i + 2] * 23) % 100) / 100;
            r += (hash - 0.5) * 0.08;
            g += (hash - 0.5) * 0.06;
            b += (hash - 0.5) * 0.04;
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

    // ── Geometry: Ship ──
    function createShip() {
        const pos = [], nrm = [], col = [];

        function tri(ax, ay, az, bx, by, bz, cx, cy, cz, r, g, b) {
            const ux = bx - ax, uy = by - ay, uz = bz - az;
            const vx = cx - ax, vy = cy - ay, vz = cz - az;
            let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
            const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
            nx /= nl; ny /= nl; nz /= nl;
            pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
            nrm.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
            col.push(r, g, b, r, g, b, r, g, b);
        }

        // Top surface - light grey
        tri(0, 0.08, 2, -1.5, 0, -0.5, 0, 0.25, 0.3, 0.65, 0.65, 0.7);
        tri(0, 0.08, 2, 0, 0.25, 0.3, 1.5, 0, -0.5, 0.65, 0.65, 0.7);
        tri(0, 0.25, 0.3, -1.5, 0, -0.5, 0, 0, -1.5, 0.6, 0.6, 0.65);
        tri(0, 0.25, 0.3, 0, 0, -1.5, 1.5, 0, -0.5, 0.6, 0.6, 0.65);

        // Bottom surface - darker
        tri(0, -0.05, 2, 0, -0.02, 0.3, -1.5, -0.03, -0.5, 0.35, 0.35, 0.4);
        tri(0, -0.05, 2, 1.5, -0.03, -0.5, 0, -0.02, 0.3, 0.35, 0.35, 0.4);
        tri(0, -0.02, 0.3, 0, -0.02, -1.5, -1.5, -0.03, -0.5, 0.3, 0.3, 0.35);
        tri(0, -0.02, 0.3, 1.5, -0.03, -0.5, 0, -0.02, -1.5, 0.3, 0.3, 0.35);

        // Left edge
        tri(0, 0.08, 2, 0, -0.05, 2, -1.5, 0, -0.5, 0.5, 0.5, 0.55);
        tri(-1.5, 0, -0.5, 0, -0.05, 2, -1.5, -0.03, -0.5, 0.5, 0.5, 0.55);
        tri(-1.5, 0, -0.5, -1.5, -0.03, -0.5, 0, 0, -1.5, 0.45, 0.45, 0.5);
        tri(0, 0, -1.5, -1.5, -0.03, -0.5, 0, -0.02, -1.5, 0.45, 0.45, 0.5);

        // Right edge
        tri(0, 0.08, 2, 1.5, 0, -0.5, 0, -0.05, 2, 0.5, 0.5, 0.55);
        tri(1.5, 0, -0.5, 1.5, -0.03, -0.5, 0, -0.05, 2, 0.5, 0.5, 0.55);
        tri(1.5, 0, -0.5, 0, 0, -1.5, 1.5, -0.03, -0.5, 0.45, 0.45, 0.5);
        tri(0, 0, -1.5, 0, -0.02, -1.5, 1.5, -0.03, -0.5, 0.45, 0.45, 0.5);

        // Tail edge
        tri(0, 0, -1.5, 0, -0.02, -1.5, -1.5, -0.03, -0.5, 0.4, 0.4, 0.45);
        tri(0, 0, -1.5, 1.5, -0.03, -0.5, 0, -0.02, -1.5, 0.4, 0.4, 0.45);

        // Left engine pod
        tri(-0.9, 0.06, -1.5, -0.9, 0.06, -2.2, -0.5, 0.06, -1.5, 0.5, 0.5, 0.55);
        tri(-0.5, 0.06, -1.5, -0.9, 0.06, -2.2, -0.5, 0.06, -2.2, 0.5, 0.5, 0.55);
        tri(-0.9, -0.04, -1.5, -0.5, -0.04, -1.5, -0.9, -0.04, -2.2, 0.35, 0.35, 0.4);
        tri(-0.5, -0.04, -1.5, -0.5, -0.04, -2.2, -0.9, -0.04, -2.2, 0.35, 0.35, 0.4);
        tri(-0.9, 0.06, -1.5, -0.9, -0.04, -1.5, -0.9, 0.06, -2.2, 0.45, 0.45, 0.5);
        tri(-0.9, -0.04, -1.5, -0.9, -0.04, -2.2, -0.9, 0.06, -2.2, 0.45, 0.45, 0.5);
        tri(-0.5, 0.06, -1.5, -0.5, 0.06, -2.2, -0.5, -0.04, -1.5, 0.45, 0.45, 0.5);
        tri(-0.5, -0.04, -1.5, -0.5, 0.06, -2.2, -0.5, -0.04, -2.2, 0.45, 0.45, 0.5);
        tri(-0.9, 0.06, -2.2, -0.9, -0.04, -2.2, -0.5, 0.06, -2.2, 1.0, 0.4, 0.0);
        tri(-0.5, 0.06, -2.2, -0.9, -0.04, -2.2, -0.5, -0.04, -2.2, 1.0, 0.4, 0.0);

        // Right engine pod
        tri(0.5, 0.06, -1.5, 0.5, 0.06, -2.2, 0.9, 0.06, -1.5, 0.5, 0.5, 0.55);
        tri(0.9, 0.06, -1.5, 0.5, 0.06, -2.2, 0.9, 0.06, -2.2, 0.5, 0.5, 0.55);
        tri(0.5, -0.04, -1.5, 0.9, -0.04, -1.5, 0.5, -0.04, -2.2, 0.35, 0.35, 0.4);
        tri(0.9, -0.04, -1.5, 0.9, -0.04, -2.2, 0.5, -0.04, -2.2, 0.35, 0.35, 0.4);
        tri(0.5, 0.06, -1.5, 0.5, -0.04, -1.5, 0.5, 0.06, -2.2, 0.45, 0.45, 0.5);
        tri(0.5, -0.04, -1.5, 0.5, -0.04, -2.2, 0.5, 0.06, -2.2, 0.45, 0.45, 0.5);
        tri(0.9, 0.06, -1.5, 0.9, 0.06, -2.2, 0.9, -0.04, -1.5, 0.45, 0.45, 0.5);
        tri(0.9, -0.04, -1.5, 0.9, 0.06, -2.2, 0.9, -0.04, -2.2, 0.45, 0.45, 0.5);
        tri(0.5, 0.06, -2.2, 0.5, -0.04, -2.2, 0.9, 0.06, -2.2, 1.0, 0.4, 0.0);
        tri(0.9, 0.06, -2.2, 0.5, -0.04, -2.2, 0.9, -0.04, -2.2, 1.0, 0.4, 0.0);

        // Cockpit highlight (cyan accent on top)
        tri(0.15, 0.26, 0.3, 0, 0.32, 0.1, -0.15, 0.26, 0.3, 0.0, 0.8, 0.85);
        tri(0, 0.08, 1.2, 0.15, 0.26, 0.3, -0.15, 0.26, 0.3, 0.0, 0.7, 0.75);

        return {
            positions: new Float32Array(pos),
            normals: new Float32Array(nrm),
            colors: new Float32Array(col),
            vertexCount: pos.length / 3
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
    const shipGeom = createShip();
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
        const view = lookAt([0, 2, 8], [0, 0, 0], [0, 1, 0]);
        const vp = mul(proj, view);

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

        // === Planet ===
        gl.useProgram(solidProg);
        const planetModel = rotY(I(), time * 0.08);
        gl.uniformMatrix4fv(solidU.uMVP, false, vp);
        gl.uniformMatrix4fv(solidU.uModel, false, planetModel);
        gl.uniform3fv(solidU.uLightDir, lightDir);
        const pc = bindSolid(planetPosBuf, planetNormBuf, planetColorBuf, planet.vertexCount);
        gl.drawArrays(gl.TRIANGLES, 0, pc);

        // === Planet Wireframe ===
        gl.useProgram(wireProg);
        gl.uniformMatrix4fv(wireU.uMVP, false, mul(vp, planetModel));
        gl.uniform4f(wireU.uColor, 0.0, 1.0, 0.25, 0.06);
        gl.bindBuffer(gl.ARRAY_BUFFER, planetEdgeBuf);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.disableVertexAttribArray(1);
        gl.disableVertexAttribArray(2);
        gl.depthMask(false);
        gl.drawArrays(gl.LINES, 0, planet.edgeCount);
        gl.depthMask(true);

        // === Atmosphere ===
        gl.useProgram(atmoProg);
        const planetMV = mul(view, planetModel);
        gl.uniformMatrix4fv(atmoU.uMVP, false, mul(vp, planetModel));
        gl.uniformMatrix4fv(atmoU.uModelView, false, planetMV);
        gl.uniform1f(atmoU.uScale, 1.12);
        gl.uniform3f(atmoU.uColor, 0.2, 0.5, 0.9);
        gl.uniform1f(atmoU.uIntensity, 0.35);
        gl.bindBuffer(gl.ARRAY_BUFFER, planetPosBuf);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.disableVertexAttribArray(1);
        gl.disableVertexAttribArray(2);
        gl.depthMask(false);
        gl.drawArrays(gl.TRIANGLES, 0, planet.vertexCount);
        gl.depthMask(true);

        // === Ship ===
        gl.useProgram(solidProg);
        const orbitA = time * 0.12;
        const orbitR = 5.5;
        const sx = Math.cos(orbitA) * orbitR;
        const sz = Math.sin(orbitA) * orbitR;
        const sy = Math.sin(time * 0.4) * 0.3 + 0.5;
        let shipModel = I();
        shipModel = translate(shipModel, sx, sy, sz);
        shipModel = rotY(shipModel, -orbitA + Math.PI / 2);
        shipModel = rotX(shipModel, Math.sin(time * 0.3) * 0.05);
        shipModel = scale3(shipModel, 0.45);
        gl.uniformMatrix4fv(solidU.uMVP, false, vp);
        gl.uniformMatrix4fv(solidU.uModel, false, shipModel);
        gl.uniform3fv(solidU.uLightDir, lightDir);
        const sc = bindSolid(shipPosBuf, shipNormBuf, shipColorBuf, shipGeom.vertexCount);
        gl.drawArrays(gl.TRIANGLES, 0, sc);

        disableAttribs();
        requestAnimationFrame(render);
    }

    render();
})();

// ── Smooth Scroll for Nav Links ──
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.querySelector(link.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        }
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

// ── Random Glitch Effect on Title ──
const heroTitle = document.querySelector('.hero-title');
if (heroTitle) {
    setInterval(() => {
        if (Math.random() > 0.95) {
            heroTitle.style.textShadow = `
                ${Math.random() * 10 - 5}px ${Math.random() * 10 - 5}px 0 var(--fe2-red),
                ${Math.random() * 10 - 5}px ${Math.random() * 10 - 5}px 0 var(--fe2-cyan)
            `;
            setTimeout(() => {
                heroTitle.style.textShadow = '4px 4px 0 var(--fe2-panel)';
            }, 100);
        }
    }, 2000);
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
