function initProceduralBackground() {
    const canv = document.getElementById('bg-canvas');
    const gl = canv.getContext('webgl') || canv.getContext('experimental-webgl');
    if (!gl) { console.error('WebGL not supported'); return; }
    gl.getExtension('OES_standard_derivatives');

    canv.width = window.innerWidth;
    canv.height = window.innerHeight;

    const vsSource = `
        attribute vec2 position;
        void main() { gl_Position = vec4(position, 0.0, 1.0); }
    `;

    const fsSource = `
        #extension GL_OES_standard_derivatives : enable
        precision mediump float;
        uniform float iTime;
        uniform vec2 iResolution;

        float PIXEL_SIZE = 6.0;

        float distanceField(vec2 p, float t)
        {
            float t1 = t * 0.031 - sqrt(length(p));
            float t2 = t * 0.023 - length(p) * 0.4;
            float a = sin(t2 / 20.0) * 20.0 + sin(t2) * 1.5;

            p *= (exp(sin(t1) * -2.0) * .5) + 0.5;

            p *= mat2(
                cos(a),  sin(a),
               -sin(a),  cos(a)
            );

            p = p - floor(p) - 0.5;

            p *= mat2(
                 0.5, 0.5,
                -0.5, 0.5
            );

            return max(abs(p.x) - 0.25, abs(p.y) - 0.25);
        }

        float fill(vec2 screen, float t)
        {
            float d = distanceField(screen, t);
            float d2 = distanceField(screen, t + 0.001);

            float v = length(vec2(dFdx(d), dFdy(d)))
                    * max(1.0, abs(d2 - d) * 700.0);

            return smoothstep(-v, v, d);
        }

        void main()
        {
            vec2 pixelCoord = floor(gl_FragCoord.xy / PIXEL_SIZE) * PIXEL_SIZE;

            vec2 screen = (pixelCoord - iResolution.xy * 0.5)
                        / (iResolution.y * 0.5);

            float r = fill(screen, iTime + 0.000);
            float g = fill(screen, iTime + 0.003);
            float b = fill(screen, iTime + 0.006);

            float mask = (r + g + b) / 3.0;

            vec3 lightColor = vec3(0.005, 0.005, 0.005);
            vec3 darkColor  = vec3(0.009, 0.009, 0.009);

            vec3 c = mix(darkColor, lightColor, mask);

            c = pow(c, vec3(1.0 / 2.2));

            gl_FragColor = vec4(c, 1.0);
        }
    `;

    function compileShader(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    const vs = compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program));
        return;
    }
    gl.useProgram(program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const iTimeLoc = gl.getUniformLocation(program, 'iTime');
    const iResLoc  = gl.getUniformLocation(program, 'iResolution');
    const startTime = performance.now();

    function update() {
        gl.uniform1f(iTimeLoc, (performance.now() - startTime) / 1000);
        gl.uniform2f(iResLoc, canv.width, canv.height);
        gl.viewport(0, 0, canv.width, canv.height);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        requestAnimationFrame(update);
    }

    update();
}
