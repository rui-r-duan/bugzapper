var canvas;
var gl;
var program;
var vBuf = null;
var cBuf = null;

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
const BYTES_PER_VERTEX = Float32Array.BYTES_PER_ELEMENT * 2;
const BYTES_PER_VERTEX_COLOR = Float32Array.BYTES_PER_ELEMENT * 3;
const RADIAN_TO_DEGREE = 180 / Math.PI;
const DEGREE_TO_RADIAN = Math.PI / 180;
var vertexBufferSize = BYTES_PER_VERTEX * maxNumVertices;
var colorBufferSize = vertexBufferSize;
var vIndex = 0;			// vertex index of GL vertex buffer
var thetaLoc;

// attributes that configure the game and the game objects
var rDisk = 0.7;
var rCrustInner = rDisk;
var rCrustOuter = 0.8;
var diskColorIndex = 7;

// game controls
var gameTicks = 1;
var maxInterval = 20;
// var nextTick = getRandomInt(1, maxInterval); // next tick to generate a new Bacteria
var nextTick =  maxInterval; // next tick to generate a new Bacteria
var maxNumBact = 10;
var maxDt = 15;
var intervalId = 0;
var delay = 80;			// game frame length in milli-seconds
var points = 0;			// user game points;

// game objects
var objs = [];
var bactBegin = 1;		// index of objs for the first bacteria obj

window.onload = function init()
{
    canvas = document.getElementById("gl-canvas");

    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) { alert("WebGL isn't available"); }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.enableVertexAttribArray(vPosition);

    var vColor = gl.getAttribLocation(program, "vColor");
    gl.enableVertexAttribArray(vColor);

    thetaLoc = gl.getUniformLocation(program, "theta");

    vBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuf);
    gl.bufferData(gl.ARRAY_BUFFER, vertexBufferSize, gl.STATIC_DRAW);

    cBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cBuf);
    gl.bufferData(gl.ARRAY_BUFFER, colorBufferSize, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, vBuf);
    gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, cBuf);
    gl.vertexAttribPointer(vColor, 3, gl.FLOAT, false, 0, 0);

    initObjData();

    canvas.addEventListener("mousedown", function(event) {
	var rect = canvas.getBoundingClientRect();
	var x = event.clientX - rect.left;
	var y = event.clientY - rect.top;
	console.log('x, y:', x, y);
	var glx = 2 * x / canvas.width - 1;
	var gly = 2 * (canvas.height - y) / canvas.height - 1;
	var polar = xy_to_polar(glx, gly);
	var isFound = false;
	for (var i = bactBegin + maxNumBact - 1; i >= bactBegin; i--) {
	    if (!objs[i].isActive) {
		continue;
	    }
	    var theta1 = objs[i].thetaBegin;
	    var theta2 = objs[i].thetaEnd;
	    console.log(polar[0], polar[1]);
	    if (isInBacteria(polar, rCrustInner, rCrustOuter, theta1, theta2)) {
		if (!isFound) {
		    isFound = true;
		    objs[i].poisonIt();
		    points += 10;
		    document.getElementById("points").innerHTML = points.toString();
		    break;
		}
	    }
	}
    });

    var speedSlider = document.getElementById("speed-slider");
    delay = speedSlider.valueAsNumber;
    speedSlider.onchange = function(event) {
	// Or use event.srcElemtn.value and put it with number arithmetic
	// expression and it can be coerced from a string to an integer
	// automatically.
	delay = event.srcElement.valueAsNumber;
	window.clearInterval(intervalId);
	intervalId = window.setInterval(updateGame, delay);
    };
    var intervalSlider = document.getElementById("interval-slider");
    maxInterval = intervalSlider.valueAsNumber;
    intervalSlider.onchange = function(event) {
	maxInterval = event.srcElement.valueAsNumber;
    };

    intervalId = window.setInterval(updateGame, delay);

    render();
};

function initObjData()
{
    var disk = new Disk(0.0, 0.0, rDisk, vec3(0.7, 0.9, 0.3));
    objs.push(disk);

    for (var i = 0; i < maxNumBact; i++) {
	var b = new Bacteria(getRandomInt(0, 360), 1, getRandomColor());
	objs.push(b);
    }

    vIndex = 0;
    for (var j = 0; j < objs.length; j++) {
	addGLObj(objs[j]);
    }
}

function addGLObj(obj)
{
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuf);
    var v = flatten(obj.vertices);
    gl.bufferSubData(gl.ARRAY_BUFFER, vIndex * BYTES_PER_VERTEX, v);

    gl.bindBuffer(gl.ARRAY_BUFFER, cBuf);
    var c = flatten(obj.colors);
    gl.bufferSubData(gl.ARRAY_BUFFER, vIndex * BYTES_PER_VERTEX_COLOR, c);

    vIndex += obj.vertices.length;
}

function updateGame()
{
    gameTicks++;
    if (gameTicks > 10000) {
	window.clearInterval(intervalId);
	gameTicks = 1;
	return;
    }
    if (gameTicks == nextTick) {
	var b = objs[getRandomInt(1, maxNumBact + 1)];
	if (!b.isActive) {
	    b.isActive = true;
	    b.setTheta(getRandomInt(0, 360));
	}
	// nextTick = gameTicks + getRandomInt(1, maxInterval);
	nextTick = gameTicks + maxInterval;
    }
    for (var i = bactBegin; i < bactBegin + maxNumBact; i++) {
	if (!objs[i].isActive) {
	    continue;
	}
	objs[i].update();
    }
}

function render()
{
    gl.clear(gl.COLOR_BUFFER_BIT);
    var vi = 0;      // vertex index in vertex buffer and color buffer
    for (var i = 0; i < objs.length; i++) {
	if (objs[i].isActive) {
	    objs[i].redraw(vi);
	}
	vi += objs[i].vertices.length;
    }
    window.requestAnimFrame(render);
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

function GameObj()
{
    this.vertices = [];
    this.colors = [];
    this.color = vec3(0.0, 0.0, 0.0);
    this.setColor = function(c) {
	this.color = c;
	if (this.colors.length != this.vertices.length) {
	    this.colors = new Array(this.vertices.length);
	}
	for (var i = 0; i < this.colors.length; i++) {
	    this.colors[i] = c;
	}
    };
    this.theta = 0.0;
    this.redraw = function(gl_vIndex) {
	gl.uniform1f(thetaLoc, this.theta * DEGREE_TO_RADIAN);
	gl.drawArrays(this.drawMode, gl_vIndex + this.beginIndex, this.vCount);
    };
    this.beginIndex = 0;
    this.vCount = this.vertices.length;
    this.isActive = true;
}

function Disk(x, y, r, c)
{
    GameObj.call(this);
    this.x = x;
    this.y = y;
    this.radius = r;
    this.drawMode = gl.TRIANGLE_FAN;

    this.genCirclePoints = function() {
	if (this.vertices.length != 362) {
	    this.vertices = new Array(362);
	}
	this.vertices[0] = vec2(x, y);
	for (var i = 0; i < 360; i++) {
	    var t = i * DEGREE_TO_RADIAN;
	    var nx = x + r * Math.cos(t);
	    var ny = y + r * Math.sin(t);
	    this.vertices[i+1] = vec2(nx, ny);
	}
	this.vertices[361] = this.vertices[1];
    };

    this.genCirclePoints();
    this.setColor(c);
    this.vCount = this.vertices.length;
}

// pre: 0 <= t0 <= 359, 0 <= dt <= 359, integers
function Bacteria(t, dt, color)
{
    assert(t >= 0 && t <= 359, 'must: 0 <= t <= 359');
    assert(dt >= 0 && dt <= 359, 'must: 0 <= dt <= 359');
    assert((typeof t === 'number') && Math.floor(t) === t, 'must: t is integer');
    assert((typeof dt === 'number') && Math.floor(dt) === dt, 'must: dt is integer');

    GameObj.call(this);
    this.theta = t;
    this.thetaBegin = t;	// value range: [-359, 359]
    this.thetaEnd = t;		// value range: [-359, 359]
    this.dt = dt;
    this.drawMode = gl.TRIANGLE_STRIP;
    this.isActive = false;
    this.isPoisoned = false;
    this.poisonDt = 0;		// this.poisonDt can grow from 0 to this.dt
    this.visualParts = [[this.beginIndex, this.beginIndex + this.vCount]];

    this._genPoints = function() {
	var thetaCount = maxDt * 2 + 1;
	if (this.vertices.length != thetaCount) {
	    this.vertices = new Array(thetaCount * 2);
	}
	for (var t = -maxDt, i = 0; t <= maxDt; t++, i += 2) {
	    var tr = t * DEGREE_TO_RADIAN;
	    var p1x = rCrustInner * Math.cos(tr);
	    var p1y = rCrustInner * Math.sin(tr);
	    var p2x = rCrustOuter * Math.cos(tr);
	    var p2y = rCrustOuter * Math.sin(tr);
	    this.vertices[i] = vec2(p1x, p1y);
	    this.vertices[i+1] = vec2(p2x, p2y);
	}
    };

    this._genPoints();

    // input value range (closed range, degrees):
    //     [0, numThetas in this bacteria]
    this._thetaIndex_to_vIndex = function(i) {
	return 2 * i;
    };

    this._setVisiblePart = function(dt) {
	this.dt = dt;		// 1 degree offset ~ 2 vertices offset
	var numThetas = Math.floor(this.vertices.length / 2);
	var middleIndex = Math.floor(numThetas / 2) * 2;
	this.beginIndex = middleIndex - dt * 2;
	this.vCount = (2 * dt + 1) * 2;
	this.visualParts = [[this.beginIndex, this.beginIndex + this.vCount]];

	var t = this.theta;
	var rangePair = rd_pair_rem([t - dt, t + dt], 360);
	this.thetaBegin = rangePair[0];
	this.thetaEnd = rangePair[1];
    };

    this.setColor = function(c) {
	this.color = c;
	if (this.colors.length != this.vertices.length) {
	    this.colors = new Array(this.vertices.length);
	}
	for (var i = 0; i < this.colors.length; i++) {
	    this.colors[i] = c;
	}
    };

    this.setTheta = function(t) {
	this.theta = t;
	// visible part depends on this.theta, so update it to keep the internal
	// states consistent
	this._setVisiblePart(this.dt);
    };

    this.setColor(color);
    this._setVisiblePart(dt);

    this.update = function() {
	var olddt = this.dt;
	var newdt = olddt + 1;
	if (newdt <= maxDt) {
	    this._setVisiblePart(newdt);
	}

	if (this.isPoisoned) {
	    olddt = this.poisonDt;
	    newdt = olddt + 1;
	    if (newdt < this.dt) {
		this._setPoisonedVisibleParts(newdt);
	    }
	    else if (newdt == this.dt) {
		this._reset();
	    }
	}
    };

    this.poisonIt = function() {
	this.isPoisoned = true;
    };

    // must be called after calling _setVisiblePart()
    this._setPoisonedVisibleParts = function(poisonDt) {
	this.poisonDt = poisonDt; // 1 degree offset ~ 2 vertices offset
	var numThetas = Math.floor(this.vertices.length / 2);
	var middleThetaIndex = Math.floor(numThetas / 2);
	var a = middleThetaIndex - poisonDt;
	var b = middleThetaIndex + poisonDt;
	var endThetaIndex = middleThetaIndex + this.dt;
	var av = this._thetaIndex_to_vIndex(a);
	var bv = this._thetaIndex_to_vIndex(b);
	var endVIndex = this._thetaIndex_to_vIndex(endThetaIndex);
	this.visualParts[0] = [this.beginIndex, av];
	this.visualParts[1] = [bv, endVIndex];
    };

    this.redraw = function(gl_vIndex) {
	gl.uniform1f(thetaLoc, this.theta * DEGREE_TO_RADIAN);
	for (var i = 0; i < this.visualParts.length; i++) {
	    gl.drawArrays(this.drawMode, gl_vIndex + this.visualParts[i][0],
			  this.visualParts[i][1] - this.visualParts[i][0]);
	}
    };

    this._reset = function() {
	this.isActive = false;
	this.isPoisoned = false;
	this.poisonDt = 0;
	this.dt = 1;
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

// return at most 2 ranges.
// Example 1: pair = [15, 359], divisor = 360, return [[15, 359]].
// Example 2: pair = [340, 25], divisor = 360, return [[340, 360], [0, 2]].
function rd_gen_ranges(pair, divisor)
{
    var a = pair[0];
    var b = pair[1];
    if (a <= b) {
	return [[a, b]];
    }
    else if (a > b) {
	return [[a, divisor], [0, b]];
    }
}

// Output: r >= 0, theta is in a closed range [0, 2*PI].
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

// theta1 and theta2 are in degrees that is in the closed range [0, 359]
// pre: r1 <= r2
// pre: no matter who is larger, theta1 is the beginning of the range, theta2
//      is the end of the range.
function isInBacteria(point, r1, r2, theta1, theta2)
{
    var r = point[0];
    var t = point[1] * RADIAN_TO_DEGREE;
    return (r >= r1 && r <= r2) && isInRange(t, theta1, theta2);
}

// begin >= end is valid
// begin < end is also valid
function isInRange(a, begin, end)
{
    if (begin <= end) {
	return a >= begin && a <= end;
    }
    else {
	var ranges = rd_gen_ranges([begin, end], 360);
	return a >= ranges[0][0] && a <= ranges[0][1] ||
	    a >= ranges[1][0] && a <= ranges[1][1];
    }
}

function getRandomColor() {
    // var i = getRandomInt(1, 7);
    // var j = getRandomInt(1, 7);
    // var a = baseColors[i];
    // var b = baseColors[j];
    // var c = mix(a, b, Math.random());
    // return c;
    return vec3(Math.random(), Math.random(), Math.random());
}
