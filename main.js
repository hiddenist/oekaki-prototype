function Oekaki(setupOptions) {
	var obj = {},
		defaultOptions = {
			width: 500,
			height: 500,
			autoInit: true,
			debug: false
		},
		options = { ...defaultOptions },
		pos = { x: 0, y: 0 },
		lastPos = { x: 0, y: 0 },
		elems = {
			container: null,
			page: null,
			buttons: null
		},
		layers = {},
		currentLayer,
		brush = {
			color: "#000000",
			size: 1
		},
		zoom = 1,
		flags = {
			drawing: false,
			initialized: false
		},
		events = {};


	obj.setOptions = function(newOptions) {
		options = mergeDefaults(options, { ...newOptions });

		log(options);

		if (!options.hasOwnProperty('id') || !options.id) {
			throw "No \"id\" property was set in options";
		}
	}

	obj.init = function() {
		log("Initializing");
		if (flags.initialized) {
			throw "Already initialized";
		}

		flags.initialized = true;

		// Create canvas
		elems.container = document.getElementById(options.id);
		elems.container.className = "oekaki-container";

		elems.page = document.createElement('div');
		elems.container.appendChild(elems.page);
		elems.page.className = "oekaki-page";
		elems.page.style.width = options.width + "px";
		elems.page.style.height = options.height + "px";

		elems.buttons = document.createElement('div');
		elems.buttons.className = "oekaki-buttons";
		elems.container.appendChild(elems.buttons);
		
		var buttons = {
			clear: {
				action: clear,
				label: "Clear"
			}
		};

		for (var btnName in buttons) {
			var btn = document.createElement('div');
			btn.className = "oekaki-button oekaki-button-" + btnName;
			btn.innerHTML = buttons[btnName].label;
			btn.addEventListener("click", buttons[btnName].action);
			elems.buttons.appendChild(btn);
		}

		// future: loop this and allow several layers
		addLayer('background');

		// Set up listeners
		elems.page.addEventListener("mousedown", events.startDrawing);
		elems.page.addEventListener("mousemove", events.move);
		elems.page.addEventListener("mouseup", events.stopDrawing);
		elems.page.addEventListener("mouseout", events.stopDrawing);
	};

	function log(message) {
		if (options.debug) {
			console.log(message);
		}
	}

	function showMessage(message) {
		alert(message);
	}

	function setLayer(name) {
		if (name in layers) {
			log("Setting active layer: " + name);
			currentLayer = name;
			var ctx = layers[currentLayer].ctx;
			ctx.strokeStyle = brush.color;
			ctx.lineWidth = brush.size;
		}
	}

	function addLayer(name) {
		log("Adding layer: " + name);
		
		if (name in layers) {
			showMessage('A layer named "' + name + '" already exists');
			return;
		}

		var canvas = document.createElement('canvas');
		canvas.width = options.width;
		canvas.height = options.height;
		elems.page.appendChild(canvas);

		layers[name] = {
			canvas: canvas,
			ctx: canvas.getContext('2d')
		};

		setLayer(name);
	}

	function mergeDefaults(defaults, values) {
		for (var key in defaults) {
			if (defaults.hasOwnProperty(key) && !values.hasOwnProperty(key)) {
				values[key] = defaults[key];
			}
		}
		return values;
	}

	function updatePosition(e) {
		lastPos.x = pos.x;
		lastPos.y = pos.y;
		pos.x = e.layerX * 1/zoom;
		pos.y = e.layerY * 1/zoom;
	}

	events.startDrawing = function(e) {
		log("Start drawing");
		updatePosition(e);
		flags.drawing = true;
	}

	events.move = function(e) {
		if (flags.drawing) {
			updatePosition(e);
			draw(lastPos, pos);
		}
	}

	events.stopDrawing = function(e) {
		log("Stop drawing");
		flags.drawing = false;
	}

	function draw(from, to) {
		var ctx = layers[currentLayer].ctx;
		ctx.beginPath();
		ctx.moveTo(from.x, from.y);
		ctx.lineTo(to.x, to.y);
		ctx.stroke();
		ctx.closePath();
	}

	function clear() {
		var layer = layers[currentLayer];
		layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
	}

	obj.setOptions(setupOptions);

	if (options.autoInit) {
		obj.init();
	} else {
		log("Not autoinitializing");
	}

	return obj;
}