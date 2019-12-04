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
			initialized: false,
			unsaved: false
		},
		events = {},
		buttons = {
			clear: {
				action: function(e) {
					if (confirm("Are you sure you want to clear the canvas?")) {
						var layer = getCurrentLayer();
						layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
					}
				},
				label: "Clear",
				active: true
			},
			save: {
				action: function(e) {
					download("image.png");
					flags.unsaved = false;
				},
				label: "Save",
				active: true
			},
			setColor: {
				action: function(e) {
					brush.color = prompt("Enter color (any valid HTML color code)", brush.color);
					updateBrush();
				},
				label: "Set Color",
				active: true
			},
			setSize: {
				action: function(e) {
					brush.size = prompt("Enter brush size (in pixels)", brush.size);
					updateBrush();
				},
				label: "Brush Size",
				active: true
			}
		};

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

		for (var btnName in buttons) {
			if (!buttons[btnName].active) {
				continue;
			}
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

		// touch controls
		elems.page.addEventListener("touchstart", events.startDrawing);
		elems.page.addEventListener("touchmove", events.move);
		elems.page.addEventListener("touchend", events.stopDrawing);
		elems.page.addEventListener("touchleave", events.stopDrawing);
		elems.page.addEventListener("touchcancel", events.stopDrawing);
		elems.page.addEventListener("touchleave", events.stopDrawing);
		
		window.addEventListener('beforeunload', function (e) {
			if (flags.unsaved) {
				e.preventDefault();
				e.returnValue = '';
			}
		});
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
			updateBrush();
		}
	}

	function updateBrush() {
		var ctx = getCurrentLayer().ctx;
		ctx.strokeStyle = brush.color;
		ctx.lineWidth = brush.size;
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

	function getCurrentLayer() {
		return layers[currentLayer];
	}

	function draw(from, to) {
		var layer = getCurrentLayer();
		layer.ctx.beginPath();
		layer.ctx.moveTo(from.x, from.y);
		layer.ctx.lineTo(to.x, to.y);
		layer.ctx.stroke();
		layer.ctx.closePath();
		flags.unsaved = true;
	}

	function download(filename) {
		var layer = getCurrentLayer();
		// future: when there are multiple layers, combine them before saving
		var a = document.createElement('a');
		a.href = layer.canvas.toDataURL();
		a.setAttribute('download', filename);
		a.click();
	}

	obj.setOptions(setupOptions);

	if (options.autoInit) {
		obj.init();
	} else {
		log("Not autoinitializing");
	}

	return obj;
}