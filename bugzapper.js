var canvas;
var gl;
var vertices = [];
var index = [];
var colors = [];
var numPoints = 50; // number of points per circle
var baseColors = [
    vec3(0.7, 0.9, 0.3),
    vec3(0.8, 0.2, 0.2)
];

window.onload = function init()
{
    canvas = document.getElementById("gl-canvas");

    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) { alert("WebGL isn't available"); }

    //
    //  Initialize our data for the disc and bacteria
    //

    // First, initialize the vertices of our 3D gasket

    var disc = new Circle(vec3(0.0, 0.0, 0.0), // center coordinates
			  0.8,		       // radius
			  0,		       // color index for baseColors
			  0);		       // z
    var bacteria = new Circle(disc.points[20],
			      0.1,
			      1,
			      -1);
    // vertices = Array.prototype.concat(disc.points, bacteria.points);
    // index = concatIndex(disc.index, bacteria.index);
    // colors = Array.prototype.concat(disc.color, bacteria.color);
    addObject(disc);
    addObject(bacteria);

    //
    //  Configure WebGL
    //
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);

    //  Load shaders and initialize attribute buffers

    var program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    // Load the data into the GPU

    // vertex coordinates

    var vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW);

    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    // vertex color

    var colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);

    var vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);

    // element index

    var indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(index), gl.STATIC_DRAW);


    render();
};


function render()
{
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // gl.drawArrays(gl.POINTS, 0, vertices.length);
    gl.drawElements(gl.TRIANGLES, index.length, gl.UNSIGNED_SHORT, 0);
}

/**
 * Generate circle points
 */
// center is a vec3
function genCirclePoints(center, r, az) {
    var pv = [center];
    var d = Math.PI * (360 / numPoints) / 180;
    for (var theta = 0; theta < 2 * Math.PI; theta += d) {
	var x = center[0] + r * Math.cos(theta);
	var y = center[1] + r * Math.sin(theta);
	var z = az;
	pv.push(vec3(x, y, z));
    }
    return pv;
}

function genCircleIndex() {
    var iv = [];
    for (var i = 1; i < numPoints; i++) {
	iv.push(0);
	iv.push(i);
	iv.push(i+1);
    }
    iv.push(0);
    iv.push(i);
    iv.push(1);
    return iv;
}

// center is a vec3, radius is a float
function Circle(center, radius, colorIndex, az) {
    this.x = center[0];
    this.y = center[1];
    this.r = radius;
    this.points = genCirclePoints(center, radius, az); // points on the peripheral
    this.index = genCircleIndex();
    this.color = new Array(this.points.length);
    for (i = 0; i < this.points.length; i++) {
	this.color[i] = baseColors[colorIndex];
    }
}

function concatIndex(a, b) {
    var d = a.length / 3 + 1;
    for (var i = 0; i < b.length; i++) {
	b[i] += d;
    }
    return Array.prototype.concat.apply(a, b);
}

// This function modifies global variables!
function addObject(obj) {
    vertices = vertices.concat(obj.points);
    index = concatIndex(index, obj.index);
    colors = colors.concat(obj.color);
}
