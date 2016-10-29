var canvas;
var gl;
var program;
var vBuf = null;
var cBuf = null;

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
var pointSizeLoc;

// attributes that configure the game and the game objects
var rDisk = 0.7;
var rCrustInner = rDisk;
var rCrustOuter = 0.8;
var diskColorIndex = 7;

// game controls
var gameTicks = 1;
var maxInterval = 30;
var nextTick =	maxInterval; // next tick to generate a new Bacteria
var maxDt = 15;
var intervalId = 0;
var bactTickInterval = 2;	// control the bacteria's speed of growth
var score = 0;			// user game score;
var updateGameDelay = 30;	// milliseconds between each call of updateGame()
var isWin = false;
var isLost = false;
var maxGrownUpsToLoseGame = 5;
var maxNumParticlePoints = 100;
var maxNumExplosions = 5;
var maxBactTickInterval = 20;

// game objects
var objs = [];			// for GL, it references disk, bacterias, etc.
var disk = null;
var bacterias = [];
var explosions = [];

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
    pointSizeLoc = gl.getUniformLocation(program, "pointSize");

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

    canvas.addEventListener("mousedown", onMouseDown);;

    var speedSlider = document.getElementById("speed-slider");
    bactTickInterval = maxBactTickInterval - speedSlider.value;
    speedSlider.onchange = function(event) {
	// Or use event.srcElemtn.value and put it with number arithmetic
	// expression and it can be coerced from a string to an integer
	// automatically.
	bactTickInterval = maxBactTickInterval - event.srcElement.value;
    };
    var intervalSlider = document.getElementById("interval-slider");
    maxInterval = intervalSlider.valueAsNumber;
    intervalSlider.onchange = function(event) {
	maxInterval = event.srcElement.valueAsNumber;
    };
    document.getElementById("reset").onclick = function () {
	resetGame();
    };
    var maxCompleteBactNum = document.getElementById("bactCountToLose");
    maxCompleteBactNum.value = maxGrownUpsToLoseGame;
    maxCompleteBactNum.onchange = function(event) {
	maxGrownUpsToLoseGame = maxCompleteBactNum.valueAsNumber;
    };

    intervalId = window.setInterval(updateGame, updateGameDelay);

    render();
};

function onMouseDown(event) {
    var rect = canvas.getBoundingClientRect();
    var x = event.clientX - rect.left;
    var y = event.clientY - rect.top;
    // console.log('x, y:', x, y);
    var glx = 2 * x / canvas.width - 1;
    var gly = 2 * (canvas.height - y) / canvas.height - 1;
    var polar = xy_to_polar(glx, gly);
    var isFound = false;
    for (var i = bacterias.length - 1; i >= 0; i--) {
	if (!bacterias[i].isActive) {
	    continue;
	}
	var theta1 = bacterias[i].thetaBegin;
	var theta2 = bacterias[i].thetaEnd;
	if (isInBacteria(polar, rCrustInner, rCrustOuter, theta1, theta2)) {
	    if (!isFound) {
		isFound = true;
		bacterias[i].poisonIt(polar[1]);
		if (bacterias[i].isGrownUp()) {
		    setScore(score + 2);
		}
		else {
		    setScore(score + 10);
		}
		break;
	    }
	}
    }
}


function initObjData()
{
    disk = new Disk(0.0, 0.0, rDisk, vec3(0.7, 0.9, 0.3));
    objs.push(disk);
    for (var i = 0; i < maxNumExplosions; i++) {
	var p = new Explosion();
	explosions.push(p);
	objs.push(p);
    }
    addOneStdBact(getRandomInt(0, 360));
    rebuildGLBuf(objs);
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

// i references objs[i]
function updateGLObj(i)
{
    var vi = getGLVIndex(i);
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuf);
    var v = flatten(objs[i].vertices);
    gl.bufferSubData(gl.ARRAY_BUFFER, vi * BYTES_PER_VERTEX, v);

    gl.bindBuffer(gl.ARRAY_BUFFER, cBuf);
    var c = flatten(objs[i].colors);
    gl.bufferSubData(gl.ARRAY_BUFFER, vi * BYTES_PER_VERTEX_COLOR, c);
}

function rebuildGLBuf(objs)
{
    vIndex = 0;
    for (var i = 0; i < objs.length; i++) {
	addGLObj(objs[i]);
    }
}

function updateGame()
{
    gameTicks++;

    if (isWin) {
	gameWinUpdate();
    }
    else {
	if (isLost) {
	    gameLostUpdate();
	}
	else {
	    // check if game runs into isWin state
	    if (isAllBactClear()) {
		nextTick = 0;		// will not generate new bacteria from now on
		isWin = true;
		// console.log('YOU WIN');
		return;
	    }

	    // check if game runs into isLost state
	    var numGrownUps = countGrownUps();
	    if (numGrownUps == maxGrownUpsToLoseGame || isFullCircleBact()) {
		nextTick = 0;
		isLost = true;
		// console.log('YOU LOSE');
		return;
	    }

	    // if not win and not lost, then do the normal update

	    // generate new bacteria
	    if (gameTicks == nextTick) {
		addOneStdBact_updateGLBuf(getRandomBactPosition());
		nextTick = gameTicks + maxInterval;
	    }

	    // merge bacterias
	    // console.log('before merge: ' + rangeArrayToString(getBactThetaRangesForMerge(bacterias)));
	    var newBactList = mergeBacterias();
	    // console.log('after merge: ' + rangeArrayToString(getBactThetaRangesForMerge(newBactList)));
	    bacterias = newBactList;
	    objs = [disk].concat(explosions);
	    objs = objs.concat(bacterias);

	    updateEachBacteria();
	    updateEachExplosion();
	}
    }

    // rebuild GL buffers
    rebuildGLBuf(objs);
}

function gameWinUpdate()
{
    updateEachBacteria();
    updateEachExplosion();
    if (isExplosionAnimDone()) {
	endGame();
    }
}

function gameLostUpdate()
{
    updateEachBacteria();
    updateEachExplosion();
    if (isExplosionAnimDone()) {
	endGame();
    }
}

function updateEachBacteria()
{
    for (var i = 0; i < bacterias.length; i++) {
	if (!bacterias[i].isActive) {
	    continue;
	}
	bacterias[i].update();
    }
}

function updateEachExplosion()
{
    for (var i = 0; i < explosions.length; i++) {
	if (!explosions[i].isActive) {
	    continue;
	}
	explosions[i].update();
    }
}

// Returns vertex index in GL vertex buffer (?th vertex it is)
function getGLVIndex(i)
{
    var vi = 0;
    for (var j = 0; j < i; j++) {
	vi += objs[j].vertices.length;
    }
    return vi;
}

function render()
{
    gl.clear(gl.COLOR_BUFFER_BIT);
    var vi = 0;	     // vertex index in vertex buffer and color buffer
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

// Return a random integer between min (included) and max (excluded).
function getRandomInt(min, max)
{
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
}

// Return a random float between min (included) and max (excluded).
function getRandomArbitrary(min, max)
{
    return Math.random() * (max - min) + min;
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
	gl.drawArrays(this.drawMode, gl_vIndex + this.beginVIndex, this.vCount);
    };
    this.beginVIndex = 0;
    this.vCount = this.vertices.length;

    // obj user can query its value, but never set it, only obj can set it internally
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

// pre: 0 <= t0 <= 359, 0 <= dt <= 359, 0 <= maxdt <= 359, integers
function Bacteria(t, dt, maxdt, color, gameTick)
{
    assert(t >= 0 && t <= 359, 'must: 0 <= t <= 359');
    assert(dt >= 0 && dt <= 359, 'must: 0 <= dt <= 359');
    assert((typeof t === 'number') && Math.floor(t) === t, 'must: t is integer');
    assert((typeof dt === 'number') && Math.floor(dt) === dt, 'must: dt is integer');

    GameObj.call(this);
    this.theta = t;
    this.thetaBegin = t;	// value range: [0, 359]
    this.thetaEnd = t;		// value range: [0, 359]
    this.thetaBeginForMerge = t; // value range: [-359, 359]
    this.thetaEndForMerge = t;	 // value range: [-359, 359]
    this.dt = dt;
    this.maxdt = maxdt;
    this.drawMode = gl.TRIANGLE_STRIP;
    this.isActive = false;
    this.isPoisoned = false;
    this.poisonDt = 0;		// this.poisonDt can grow from 0 to this.dt
    this.poisonTheta = t;	// value range: [0, 359]
    this.visibleParts = [[this.beginVIndex, this.beginVIndex + this.vCount]];
    this.gameTick = gameTick;	// time of creation

    this._genPoints = function() {
	var thetaCount = maxdt * 2 + 1;
	if (this.vertices.length != thetaCount) {
	    this.vertices = new Array(thetaCount * 2);
	}
	for (var t = -maxdt, i = 0; t <= maxdt; t++, i += 2) {
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
    //	   [0, numThetas in this bacteria]
    this._ti_to_vi = function(i) {
	return 2 * i;
    };

    // theta index to vIndex
    // input is a range list
    this._ti_to_vi_range_list = function(r) {
	var s = [];
	for (var i = 0; i < r.length; i++) {
	    var a = r[i];
	    // this._ti_to_vi(a[1] + 1) is one off the last vertex to be drawn,
	    // if not +1 on a[1], the right most two vertices will be missing.
	    s.push( [ this._ti_to_vi(a[0]), this._ti_to_vi(a[1] + 1) ] );
	}
	return s;
    };

    this._setVisiblePart = function(dt) {
	this.dt = dt;		// 1 degree offset ~ 2 vertices offset
	var numThetas = Math.floor(this.vertices.length / 2);
	var middleIndex = Math.floor(numThetas / 2) * 2;
	this.beginVIndex = middleIndex - dt * 2;
	this.vCount = (2 * dt + 1) * 2;
	if (!this.poisoned) {
	    this.visibleParts = [[this.beginVIndex, this.beginVIndex + this.vCount]];
	}

	var t = this.theta;
	var rangePair = rd_pair_rem([t - dt, t + dt], 360);
	this.thetaBegin = rangePair[0];
	this.thetaEnd = rangePair[1];
	this.thetaBeginForMerge = t - dt;
	if (t + dt == 360) {
	    this.thetaEndForMerge = 360;
	}
	else {
	    this.thetaEndForMerge = (t + dt) % 360;
	}
	if (this.thetaBeginForMerge > this.thetaEndForMerge) {
	    this.thetaBeginForMerge -= 360;
	}
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
    this.setTheta(t);

    this.update = function() {
	if (gameTicks % bactTickInterval == 0) {
	    var olddt = this.dt;
	    var newdt = olddt + 1;
	    if (newdt <= maxdt) {
		this._setVisiblePart(newdt);
	    }
	}
	if (this.isPoisoned) {
	    olddt = this.poisonDt;
	    newdt = olddt + 1;
	    // when visible parts are empty, reset this bacteria
	    this._setPoisonedVisibleParts(newdt);
	}
    };

    this.poisonIt = function(thetaRadian) {
	if (this.isPoisoned) {
	    return;
	}
	this.isPoisoned = true;
	this.poisonTheta = Math.round(thetaRadian * RADIAN_TO_DEGREE);
	var i = getIdleExplosionIndex();
	if (i != -1) {
	    var e = explosions[i];
	    e.activate();
	    e.setPosition(rCrustInner + (rCrustOuter - rCrustInner) / 2, thetaRadian);
	    e.setColor(this.color);
	    updateGLObj(1 + i);
	}
    };

    // before calling this method, _setVisiblePart() must be called
    this._setPoisonedVisibleParts = function(poisonDt) {
	this.poisonDt = poisonDt; // 1 degree offset ~ 2 vertices offset

	// ==== from left to right (total: n thetas) ====
	// middle = floor(n / 2)
	// thetas:     (t-maxdt),    (t-dt),      t,    (t+dt),    (t+maxdt)
	// thetaIndex:         0, middle-dt, middle, middle+dt, middle+maxdt == n-1
	// vIndex:     (thetaIndex * 2).
	//
	// ==== PRE-CONDITIONS ====
	// t (this.theta) is in [0, 359], dt (this.dt) is in [0, 359]
	// this.poisonTheta is in [0, 359]
	// this.beginVIndex == (middle-dt) * 2
	// (t-dt) <=> this.beginVIndex
	//
	// (t-dt) <= poisonTheta <= t+dt, because we assure poisonTheta is in the bacteria's visible range
	// if poisonTheta is not in the value range [(t-dt), (t+dt)], there are two cases for this:
	// CASE 1 ex.: (t-dt)=-10, poisonTheta=352, t=5, (t+dt)=20
	// In this case, we minus 360 on poisonTheta to adjust it into range [(t-dt), (t+dt)].
	// CASE 2 ex.: (t-dt)=340, t=355, poisonTheta = 5, (t+dt)=370
	// In this case, we plus 360 on poisonTheta to ajust it into range [(t-dt), (t+dt)].
	//
	// ==== the invisible part ====
	// thetas:     (poisonTheta - poisonDt),           poisonTheta, (poisonTheta + poisonDt)
	// thetaIndex:                        ?, poisonTheta-(t-maxdt),                        ?
	// vIndex:     (thetaIndex * 2).
	//
	// ==== the visible parts ====
	// thetas:     [(t-dt), (poisonTheta-poisonDt)], [(poisonTheta+poisonDt), (t+dt)]
	var n = Math.floor(this.vertices.length / 2);
	var middle = Math.floor(n / 2);
	assert(n % 2 == 1, "there must be odd number of thetas");

	var tmpPoisonTheta = this.poisonTheta;
	if (tmpPoisonTheta > this.theta + this.dt) {
	    tmpPoisonTheta -= 360;
	}
	else if (tmpPoisonTheta < this.theta - this.dt) {
	    tmpPoisonTheta += 360;
	}

	// the following are theta index that are in range [0, vertex_count - 1]
	var p = tmpPoisonTheta - (this.theta - this.maxdt);
	assert(p > 0, 'poisonThetaIndex > 0');
	var pLeft = p - poisonDt; // pLeft can < 0
	var pRight = p + poisonDt;
	var bLeft = this.maxdt - this.dt;
	assert(this.maxdt - this.dt == middle - this.dt, 'maxdt - dt == middle - dt');
	var bRight = middle + this.dt;

	var theta_ranges;
	if (bLeft < pLeft && pRight < bRight) {
	    theta_ranges = [[bLeft, pLeft], [pRight, bRight]];
	}
	else if (bLeft >= pLeft && pRight < bRight) {
	    assert(p < middle, 'poisonThetaIndex < middle');
	    theta_ranges = [[pRight, bRight]];
	}
	else if (bLeft < pLeft && pRight >= bRight) {
	    assert(p > middle, 'poisonThetaIndex > middle');
	    theta_ranges = [[bLeft, pLeft]];
	}
	else {			// bLeft >= pLeft && pRight >= bRight
	    theta_ranges = [];
	}

	this.visibleParts = this._ti_to_vi_range_list(theta_ranges);
	if (this.visibleParts.length == 0) {
	    this.reset();
	}
    };

    this.redraw = function(gl_vIndex) {
	gl.uniform1f(thetaLoc, this.theta * DEGREE_TO_RADIAN);
	for (var i = 0; i < this.visibleParts.length; i++) {
	    gl.drawArrays(this.drawMode, gl_vIndex + this.visibleParts[i][0],
			  this.visibleParts[i][1] - this.visibleParts[i][0]);
	}
    };

    this.reset = function() {
	this.isActive = false;
	this.isPoisoned = false;
	this.poisonDt = 0;
	this.dt = 1;
    };

    this.activate = function() {
	this.isActive = true;
    };

    this.isGrownUp = function() {
	return this.dt == maxdt;
    };

    this.isOverlap = function(b) {
	var ra = [this.thetaBeginForMerge, this.thetaEndForMerge];
	var rb = [b.thetaBeginForMerge, b.thetaEndForMerge];
	var rbDown = [rb[0] - 360, rb[1] - 360];
	var rbUp = [rb[0] + 360, rb[1] + 360];
	var bSeparate1 = ra[1] < rb[0] || rb[1] < ra[0];
	var bSeparate2 = ra[1] < rbDown[0] || rbDown[1] < ra[0];
	var bSeparate3 = ra[1] < rbUp[0] || rbUp[1] < ra[1];
	return !(bSeparate1 && bSeparate2 && bSeparate3);
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
function split_circular_ranges(pair, divisor)
{
    var a = pair[0];
    var b = pair[1];
    assert(a >= 0 && a <= 359, 'must: 0 <= a <= 359');
    assert(b >= 0 && b <= 359, 'must: 0 <= b <= 359');
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
//	is the end of the range.
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
	var ranges = split_circular_ranges([begin, end], 360);
	return a >= ranges[0][0] && a <= ranges[0][1] ||
	    a >= ranges[1][0] && a <= ranges[1][1];
    }
}

function isInRangeList(a, r)
{
    for (var i = 0; i < r.length; i++) {
	if (isInRange(a, r[i][0], r[i][1])) {
	    return true;
	}
    }
    return false;
}

function getRandomColor()
{
    return vec3(Math.random(), Math.random(), Math.random());
}

function addOneStdBact(t)
{
    var b = new Bacteria(t, 1, maxDt, getRandomColor(), gameTicks);
    b.activate();
    addBact(b);
}

function addOneStdBact_updateGLBuf(t)
{
    addOneStdBact(t);
    rebuildGLBuf(objs);
}

function addBact(b)
{
    bacterias.push(b);
    console.log('bacterias.length=', bacterias.length);
    objs.push(b);
}

function clearAllBact()
{
    bacterias = [];
    objs = [];
    objs.push(disk);
    for (var i = 0; i < maxNumExplosions; i++) {
	objs.push(explosions[i]);
    }
}

function isAllBactClear()
{
    for (var i = 0; i < bacterias.length; i++) {
	if (bacterias[i].isActive && !bacterias[i].isPoisoned) {
	    return false;
	}
    }
    return true;
}

function countGrownUps()
{
    var c = 0;
    for (var i = 0; i < bacterias.length; i++) {
	if (bacterias[i].isActive && !bacterias[i].isPoisoned && bacterias[i].isGrownUp()) {
	    c++;
	}
    }
    return c;
}

function isExplosionAnimDone()
{
    for (var i = 0; i < explosions.length; i++) {
	if (explosions[i].isActive) {
	    return false;
	}
    }
    return true;
}

function resetGame()
{
    isWin = false;
    isLost = false;
    setScore(0);
    clearAllBact();
    gameTicks = 1;
    addOneStdBact_updateGLBuf(getRandomInt(0, 360));
    var intervalSlider = document.getElementById("interval-slider");
    maxInterval = intervalSlider.valueAsNumber;
    nextTick = maxInterval;
    var speedSlider = document.getElementById("speed-slider");
    bactTickInterval = maxBactTickInterval - speedSlider.value;
    var maxCompleteBactNum = document.getElementById("bactCountToLose");
    maxGrownUpsToLoseGame = maxCompleteBactNum.valueAsNumber;
    canvas.addEventListener("mousedown", onMouseDown);
    document.getElementById("win-or-lose").innerHTML = "";
    window.clearInterval(intervalId); // necessary
    intervalId = window.setInterval(updateGame, updateGameDelay);
}

function endGame()
{
    if (isWin) {
	document.getElementById("win-or-lose").innerHTML = "YOU WIN";
    }
    else if (isLost) {
	document.getElementById("win-or-lose").innerHTML = "YOU LOSE";
    }
    window.clearInterval(intervalId);
    canvas.removeEventListener("mousedown", onMouseDown);
}

function setScore(a)
{
    score = a;
    document.getElementById("score").innerHTML = score;
}

function divideBacterias()
{
    var healthy = [];
    var poisoned = [];
    var dead = [];
    for (var i = 0; i < bacterias.length; i++) {
	if (bacterias[i].isActive && !bacterias[i].isPoisoned) {
	    healthy.push(bacterias[i]);
	}
	else if (bacterias[i].isActive && bacterias[i].isPoisoned) {
	    poisoned.push(bacterias[i]);
	}
	else {
	    dead.push(bacterias[i]);
	}
    }
    return [healthy, poisoned, dead];
}

function mergeBacterias()
{
    bacterias.sort(compareBact); // it changes bacterias object
    var healthy, poisoned, dead;
    [healthy, poisoned, dead] = divideBacterias();
    var stack = [healthy[0]];
    for (var i = 1; i < healthy.length; i++) {
	var target = healthy[i];
	var top = stack[stack.length - 1];
	if (top.isOverlap(target)) {
	    var a, b;
	    [a, b] = sortBactsByAge(top, target);
	    var c = eat(a, b);	// order: a eats b, c uses a's color

	    stack.pop();
	    stack.push(c);
	}
	else {
	    stack.push(target);
	}
    }

    if (stack.length > 1 && stack[0].isOverlap(stack[stack.length - 1]))
    {
	[a, b] = sortBactsByAge(stack[0], stack[stack.length - 1]);
	c = eat(a, b);
	stack.pop();		// remove stack[stack.length - 1]
	stack.splice(0, 1);	// remove stack[0]
	stack.unshift(c);	// add c to the front of stack
    }

    stack = stack.concat(poisoned); // discard the dead
    return stack;
}

function sortBactsByAge(a, b)
{
    assert(a.gameTick != b.gameTick, "two bacterias cannot be created at the same time in this game");
    if (a.gameTick < b.gameTick) {
	return [a, b];
    }
    else {
	return [b, a];
    }
}

// ranges a and b are in the range [-359, 359]
// a[0] < a[1], b[0] < b[1]
function merge_range(a, b)
{
    assert(a[0] < a[1]);
    assert(b[0] < b[1]);
    assert(a[0] >= -359);
    assert(a[1] <= 359);
    assert(b[0] >= -359);
    assert(b[1] <= 359);
    var b1 = [b[0] - 360, b[1] - 360];
    var b2 = [b[0] + 360, b[1] + 360];
    var bArray = [b, b1, b2];
    var c;
    for (var i = 0; i < bArray.length; i++) {
	var isSeparate = a[1] < bArray[i][0] || bArray[i][1] < a[0];
	if (!isSeparate) {
	    c = bArray[i];
	    break;
	}
    }
    assert(c != undefined);
    var newStart = a[0] < c[0] ? a[0] : c[0];
    var newEnd = a[1] > c[1] ? a[1] : c[1];
    if (newEnd - newStart >= 360) {
	newStart = 0;
	newEnd = 360;
    }
    return [newStart, newEnd];
}

function compareBact(a, b)
{
    return a.thetaBeginForMerge - b.thetaBeginForMerge;
}

// test
// the value range of output ranges: [-359, 359]
function getBactThetaRangesForMerge(bacterias)
{
    var ranges = [];
    for (var i = 0; i < bacterias.length; i++) {
	if (bacterias[i].isActive) {
	    // closed range
	    var r = [bacterias[i].thetaBeginForMerge, bacterias[i].thetaEndForMerge];
	    ranges.push(r);
	}
    }
    return ranges;
}

// the value range of output ranges: [0, 359]
function getBactThetaRanges(bacterias)
{
    var ranges = [];
    for (var i = 0; i < bacterias.length; i++) {
	if (bacterias[i].isActive) {
	    // closed range
	    var r = [bacterias[i].thetaBegin, bacterias[i].thetaEnd];
	    ranges.push(r);
	}
    }
    return ranges;
}

function eat(a, b)
{
    var ra = [a.thetaBeginForMerge, a.thetaEndForMerge];
    var rb = [b.thetaBeginForMerge, b.thetaEndForMerge];
    // console.log('ra', ra);
    // console.log('rb', rb);
    var rc = merge_range(ra, rb);
    // console.log(rc);
    // assure this range difference is an even number, so the GL buffer
    // calculation can be correct later
    if ((rc[1] - rc[0]) % 2 == 1) {
	rc[0] -= 1;
    }
    var dt = (rc[1] - rc[0]) / 2;
    var t = rd_rem(rc[0] + dt, 360);
    // console.log(t);
    var maxdt = dt < 15 ? 15 : dt;
    if (dt == 0 || dt == 180) {
	t = 0;
	dt = 180;
	maxtdt = 180;
    }
    assert(dt > 0);
    assert(maxdt >= dt);
    var c = new Bacteria(t, dt, maxdt, a.color, a.gameTick);
    a.reset();
    b.reset();
    c.activate();
    return c;
}

// test
function rangeArrayToString(rr)
{
    var s = '[';
    for (var i = 0; i < rr.length; i++) {
	var r = rr[i];
	s += '[' + r[0] + ',' + r[1] + ']';
    }
    s += ']';
    return s;
}

function Explosion()
{
    GameObj.call(this);
    this.theta = 0;
    this.drawMode = gl.POINTS;
    this.velocities = [];
    this.pointSize = 4;
    this.isActive = false;

    this._genPoints = function(r) {
	if (this.vertices.length != maxNumParticlePoints) {
	    this.vertices = new Array(maxNumParticlePoints);
	}
	var tu = 0.0;
	var tv = 0.0 - DEGREE_TO_RADIAN;
	var tw = 0.0 + DEGREE_TO_RADIAN;
	var u = [r * Math.cos(tu), r * Math.sin(tu)];
	var v = [(r+0.01) * Math.cos(tv), (r+0.01) * Math.sin(tv)];
	var w = [(r+0.01) * Math.cos(tw), (r+0.01) * Math.sin(tw)];
	for (var i = 0; i < maxNumParticlePoints; i++) {
	    var s1 = Math.random();
	    var uv = mix(u, v, s1);
	    var s2 = Math.random();
	    var uvw = mix(uv, w, s2); // point in triangle (u, v, w) region
	    this.vertices[i] = uvw;
	}
    };

    this._genVelocities = function() {
	if (this.velocities.length != maxNumParticlePoints) {
	    this.velocities = new Array(maxNumParticlePoints);
	}
	for (var i = 0; i < maxNumParticlePoints; i++) {
	    var vx = getRandomInt(i, maxNumParticlePoints) * getRandomArbitrary(-0.0001, 0.0007);
	    var vy = getRandomInt(i, maxNumParticlePoints) * getRandomArbitrary(-0.0003, 0.0003);
	    this.velocities[i] = vec2(vx, vy);
	}
    };

    this.setPosition = function(r, thetaRadian) {
	this.theta = thetaRadian * RADIAN_TO_DEGREE;
	this._genPoints(r);	// generate this.vertices[]
	this.vCount = this.vertices.length;
	this._genVelocities();	// generate this.velocities[]
    };

    this.redraw = function(gl_vIndex) {
	gl.uniform1f(pointSizeLoc, this.pointSize);
	gl.uniform1f(thetaLoc, this.theta * DEGREE_TO_RADIAN);
	gl.drawArrays(this.drawMode, gl_vIndex + this.beginVIndex, this.vCount);
    };

    this.update = function() {
	if (!this.isActive) {
	    return;
	}
	if (gameTicks % 10 == 0) {
	    this.pointSize--;
	    if (this.pointSize == 0) {
		this.inactivate();
	    }
	}
	for (var i = 0; i < this.vertices.length; i++) {
	    this.vertices[i][0] += this.velocities[i][0];
	    this.vertices[i][1] += this.velocities[i][1];
	    this.velocities[i][0] -= 0.0002;
	    this.velocities[i][1] -= 0.0004;
	}
    };

    this.activate = function() {
	this.isActive = true;
	this.pointSize = 4;
    };

    this.inactivate = function() {
	this.isActive = false;
    };

    this.setPosition(rCrustInner, 0.0);
}

function getIdleExplosionIndex()
{
    for (var i = 0; i < explosions.length; i++) {
	if (!explosions.isActive) {
	    return i;
	}
    }
    return -1;
}

// pre: bacterias are sorted by beginThetaForMerge ascendingly
function getRandomBactPosition()
{
    var ranges = getBactThetaRanges(bacterias);
    var t = getRandomInt(0, 360);
    for (var i = 0; i < 360 && isInRangeList(t, ranges); i++) {
	t = getRandomInt(0, 360);
    }
    if (i == 360) {
	t = ranges[getRandomInt(0, ranges.length)][1];
    }
    return t;
}

function isFullCircleBact()
{
    for (var i = 0; i < bacterias.length; i++) {
	if (bacterias[i].isActive && !bacterias[i].isPoisoned && bacterias[i].dt == 180) {
	    return true;
	}
    }
    return false;
}
