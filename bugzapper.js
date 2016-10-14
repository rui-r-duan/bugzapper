var canvas;
var gl;
var program;

var vertexBuffer = null;
var colorBuffer = null;
var indexBuffer = null;

var baseColors = [
    vec3(0.0, 0.0, 0.0), // black
    vec3(1.0, 0.0, 0.0), // red
    vec3(1.0, 1.0, 0.0), // yellow
    vec3(0.0, 1.0, 0.0), // green
    vec3(0.0, 0.0, 1.0), // blue
    vec3(1.0, 0.0, 1.0), // magenta
    vec3(0.0, 1.0, 1.0), // cyan
    vec3(0.7, 0.9, 0.3), // yellow-green
    vec3(0.8, 0.2, 0.2)	 // dark red
];

var maxNumTriangles = 5000;
var maxNumVertices = 3 * maxNumTriangles;
var vertexBufferSize = Float64Array.BYTES_PER_ELEMENT * 2 * maxNumVertices;
var colorBufferSize = vertexBufferSize;
var indexBufferSize = Uint16Array.BYTES_PER_ELEMENT * 3 * maxNumVertices;

// The following resources are shared among the disk and all the bacterias.
var thetaList = [];
var vertices = [];
var indices = [];
var colors = [];

// attributes that configure the game and the game objects
var rDisk = 0.7;
var rCrustInner = rDisk;
var rCrustOuter = 0.8;
var diskColorIndex = 7;

// game controls
var gameTicks = 1;
var maxNumBact = 10;
var maxDt = 15;
var interval = 10;

// game objects
var diskObj = null;
var bacteriaList = [];

var diskIndice = [];
var bacteriaIndice = [];

var intervalId = 0;

window.onload = function init()
{
    canvas = document.getElementById("gl-canvas");

    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) { alert("WebGL isn't available"); }

    //
    //	Configure WebGL
    //
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    //	Load shaders and initialize attribute buffers
    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    // Allocate VBOs in GPU and set Attributes to point to VBOs

    // vertex coordinates
    vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertexBufferSize, gl.STATIC_DRAW);

    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    // vertex color
    colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, colorBufferSize, gl.STATIC_DRAW);

    var vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);

    // element indices
    indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexBufferSize, gl.STATIC_DRAW);

    //
    //	Initialize our data for the disk and bacteria
    //
    initObjData();

    updateGLBuffers();

    canvas.addEventListener("mousedown", function(event) {
	var x = event.clientX;
	var y = event.clientY;
	console.log('xy:', x, y);
	var glx = 2 * x / canvas.width - 1;
	var gly = 2 * (canvas.height - y) / canvas.height - 1;
	console.log('gl_xy:', glx, gly);
	var polar = xy_to_polar(glx, gly);
	console.log('polar:', polar[0], polar[1]);
	for (var i = 0; i < bacteriaList.length; i++) {
	    var theta1 = bacteriaList[i].thetaBegin;
	    var theta2 = bacteriaList[i].thetaEnd;
	    if (isInBacteria(polar, rCrustInner, rCrustOuter, theta1, theta2)) {
		console.log('mouse in', i+'th', 'bacteria');
	    }
	}
    });

    render();
};

function initObjData()
{
    thetaList = genGlobalThetaList();
    vertices = genGlobalVertices(thetaList, rDisk, rCrustInner, rCrustOuter);
    indices = genGlobalIndice();
    colors = genGlobalColorBuffer();
    clearGlobalColorBuffer();
    colors = setObjColor(diskIndice, baseColors, diskColorIndex);
    var sector = 360 / maxNumBact;
    var theta = getRandomInt(0, 1 * sector);
    console.log(theta);
    var color = rd_rem(0, 5) + 1;
    bacteriaList[0] = new Bacteria(theta, 1, color);
    colors = setObjColor(bacteriaList[0].getIndice(),
			 baseColors, bacteriaList[0].color);
    intervalId = window.setInterval(updateGame, 150);
}

function updateGame()
{
    gameTicks++;
    if (gameTicks > 10000) {
	window.clearInterval(intervalId);
	gameTicks = 1;
	return;
    }
    clearGlobalColorBuffer();
    colors = setObjColor(diskIndice, baseColors, diskColorIndex);
    for (var i = 0; i < bacteriaList.length; i++) {
	var olddt = bacteriaList[i].dt;
	if (olddt < maxDt) {
	    var newdt = olddt + 1;
	    bacteriaList[i].update(bacteriaList[i].t, newdt);
	}
	colors = setObjColor(bacteriaList[i].getIndice(),
			     baseColors, bacteriaList[i].color);
    }
    if (gameTicks % interval == 0) {
	// add a new bacteria
	var n = bacteriaList.length;
	if (n < maxNumBact) {
	    var sector = 360 / maxNumBact;
	    var theta = getRandomInt(n * sector, (n+1) * sector);
	    console.log(theta);
	    var color = rd_rem(n, 5) + 1;
	    bacteriaList[n] = new Bacteria(theta, 1, color);
	    colors = setObjColor(bacteriaList[n].getIndice(),
				 baseColors, bacteriaList[n].color);
	}
    }
    updateGLBuffers();
}

function updateGLBuffers()
{
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten(vertices));

    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten(colors));

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, new Uint16Array(indices));
}

function render()
{
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
    window.requestAnimFrame(render);
}

/**
 * Generate a theta list that maps to all the vertices.
 * In Degrees.
 */
function genGlobalThetaList()
{
    var t = [];
    var d = 1;
    for (var i = 0; i < 360; i = i + d) {
	t.push(i);
    }
    return t;
}

/**
 * Generate all vertices that are used in this program.
 * Put the origin point to the end.
 * Return a vec2 list.
 */
function genGlobalVertices(thetaList, r1, r2, r3)
{
    var t = [];
    thetaList.forEach(function(theta, index, array) {
	var ra = theta * Math.PI / 180; // degrees to radians
	var p1x = r1 * Math.cos(ra);
	var p1y = r1 * Math.sin(ra);
	var p2x = r2 * Math.cos(ra);
	var p2y = r2 * Math.sin(ra);
	var p3x = r3 * Math.cos(ra);
	var p3y = r3 * Math.sin(ra);
	t.push(vec2(p1x, p1y));
	t.push(vec2(p2x, p2y));
	t.push(vec2(p3x, p3y));
    });
    t.push(vec2(0.0, 0.0));
    return t;
}

function genGlobalIndice()
{
    diskIndice = genDiskTriangles(thetaList, vertices);
    bacteriaIndice = genBacteriaTriangles(thetaList.concat([0]));
    return indices = diskIndice.concat(bacteriaIndice);
}

function genGlobalColorBuffer()
{
    return colors = new Array(vertices.length);
}

function clearGlobalColorBuffer()
{
    for (var i = 0; i < vertices.length; i++) {
	colors[i] = baseColors[0];
    }
}

/**
 * Return an index list.  The index references the elements in the vertex list.
 */
function genDiskTriangles(thetaList, vertices)
{
    var p = [];
    var originIndex = vertices.length - 1;
    for (var i = 0; i < thetaList.length - 1; i++) {
	var j = 3 * i;
	p.push(originIndex);
	p.push(j);		// 3*i
	p.push(j+3);		// 3*(i+1)
    }
    p.push(originIndex);
    p.push(3 * i);
    p.push(0);
    return p;
}

/**
 * In the global thetaList, find the best matched one, and return its index.
 */
function getMatchedThetaIndex(t)
{
    var index = thetaList.indexOf(t);
    if (index == -1) {
	// not found
	// TODO
    }
    return index;
}

function getThetaIndexPair(t1, t2)
{
    var begin = getMatchedThetaIndex(t1);
    var end = getMatchedThetaIndex(t2);
    return [begin, end];
}

/**
 * Return an index list.  The index references the elements in vertex list.
 * ts is a theta index list that references the global theta list.
 */
function genBacteriaTriangles(ts)
{
    var p = [];
    for (var i = 0; i <= ts.length - 3; i += 2) {
	var a = 3 * ts[i] + 1;
	var b = 3 * ts[i] + 2;
	var c = 3 * ts[i+1] + 1;
	var d = 3 * ts[i+1] + 2;
	var e = 3 * ts[i+2] + 1;
	var f = 3 * ts[i+2] + 2;
	p.push(a); p.push(d); p.push(b);
	p.push(a); p.push(c); p.push(d);
	p.push(c); p.push(f); p.push(d);
	p.push(c); p.push(e); p.push(f);
    }
    return p;
}

function setObjColor(vertexIndice, baseColors, colorIndex)
{
    vertexIndice.forEach(function(item, i, array) {
	colors[item] = baseColors[colorIndex];
    });
    return colors;
}

function assert(condition, message)
{
    if (!condition) {
	message = message || "Assertion failed";
	if (typeof Error !== "undefined") {
	    throw new Error(message);
	}
	throw message; // fallback
    }
}

/**
 * Return a random integer between min (included) and max (excluded).
 */
function getRandomInt(min, max)
{
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
}

/**
 * GameObj is a special pointer to the global indice[]
 * which contains a set of triples that consists triangles.
 * Each GameObj points to a subset of indice[], which means
 * that subset belongs to this GameObj.
 *
 * indexBegin is the index at the beginning of the subset. (included)
 * indexEnd is the index at the end of the subset. (excluded)
 */
function GameObj(indexBegin, indexEnd)
{
    this.vIndexBegin = indexBegin;
    this.vIndexEnd = indexEnd;
}

// pre: 0 <= t0 <= 359, 0 <= dt <= 359, integers
function Bacteria(t, dt, color)
{
    assert(t >= 0 && t <= 359, 'must: 0 <= t <= 359');
    assert(dt >= 0 && dt <= 359, 'must: 0 <= dt <= 359');
    assert((typeof t === 'number') && Math.floor(t) === t, 'must: t is integer');
    assert((typeof dt === 'number') && Math.floor(dt) === dt, 'must: dt is integer');

    GameObj.call(0, 0);
    this.t = t;
    this.dt = dt;
    this.color = color;

    this.update = function(t, dt) {
	this.t = t;
	this.dt = dt;
	var rangePair = rd_pair_rem([t-dt, t+dt], 360);
	this.thetaBegin = rangePair[0];
	this.thetaEnd = rangePair[1]; // included

	// indexPair.end is included
	var indexPair = getThetaIndexPair(this.thetaBegin, this.thetaEnd);

	// thetaList.length is the number of vertices on the disk circle
	// which is the first part in the global indices[].
	this.vIndexBegin = indexPair[0] * 2;

	// vIndexEnd is excluded
	this.vIndexEnd = indexPair[1] * 2;
    };

    this.update(t, dt);

    this.getIndice = function() {
	var a = this.vIndexBegin;
	var b = this.vIndexEnd;
	var indexRanges = rd_gen_ranges([a, b], bacteriaIndice.length / 3);
	var indiceList = [];
	indexRanges.forEach(function(range, index, array) {
	    var begin = (range[0] + thetaList.length) * 3;
	    var end = (range[1] + thetaList.length) * 3;
	    indiceList = indiceList.concat(indices.slice(begin, end));
	});
	return indiceList;
    };
}

/**
 * Return the positive remainder of dividend and positive divisor.
 */
function rd_rem(dividend, divisor)
{
    var r = dividend % divisor;
    if (r < 0) {
	r += divisor;
    }
    return r;
}

// divisor is the size of the cycle list.
// pair is of this form [a, b], that references the section from na to nb
// in the cycle list.
//
// This function transform pair and return a new pair that uses positive index
// to reference the elements in the cycle list.
function rd_pair_rem(pair, divisor)
{
    var a = rd_rem(pair[0], divisor);
    var b = rd_rem(pair[1], divisor);
    return [a, b];
}

function rd_gen_ranges(pair, divisor)
{
    var a = pair[0];
    var b = pair[1];
    var lst = [];
    var i = a;
    if (a < b) {
	lst.push(pair);
    }
    else if (a > b) {
	lst.push([a, divisor]);
	lst.push([0, b]);
    }
    else if (a == b) {
	lst.push(pair);
    }
    return lst;
}

function xy_to_polar(x, y)
{
    var theta = Math.atan(y / x);
    if ((y > 0 && x < 0) || (y < 0 && x < 0)) {
	theta += Math.PI;
    }
    if (theta < 0) {
	theta += Math.PI * 2;
    }
    var r = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
    return [r, theta];
}

// theta1 and theta2 are in degrees
// pre: r1 <= r2
// pre: no matter who is larger, theta1 is the beginning of the range, theta2
//      is the end of the range.
function isInBacteria(point, r1, r2, theta1, theta2)
{
    var r = point[0];
    var t = 180 * point[1] / Math.PI; // degrees
    console.log(r, t, r1, r2, theta1, theta2);
    return (r >= r1 && r <= r2) && (t >= theta1 && t <= theta2);
}
