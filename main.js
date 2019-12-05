function Oekaki(setupOptions) {
	var obj = {},
		defaultOptions = {
			width: 500,
			height: 500,
			createForm: false,
			autoInit: true,
			debug: false,
			name: "Untitled Drawing",
			backgroundColor: null
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
			size: 2,
			opacity: 0.75
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
						clear();
					}
				},
				label: "Clear",
				active: true
			},
			rename: {
				action: function(e) {
					options.name = prompt("Enter drawing name", options.name);
					updateTitle();
				},
				label: "Rename",
				active: true
			},
			save: {
				action: function(e) {
					download(options.name + ".png");
					setSaved();
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
			},
			setOpacity: {
				action: function(e) {
					brush.opacity = prompt("Enter opacity ", brush.opacity);
					updateBrush();
				},
				label: "Set Opacity",
				active: true
			},
		};

	obj.setOptions = function(newOptions) {
		options = mergeDefaults(options, { ...newOptions });

		log(options);

		if ((!options.hasOwnProperty('id') || !options.id) && (!options.hasOwnProperty('element') || !options.element)) {
			throw "No \"id\" or \"element\" property was set in options";
		}
	}

	obj.init = function() {
		log("Initializing");
		if (flags.initialized) {
			throw "Already initialized";
		}

		flags.initialized = true;

		elems.container = options.element || document.getElementById(options.id);
		elems.container.className = "oekaki-container";

		if (options.createForm) {
			createForm();
		} else {
			launch();
		}
	};

	function createForm() {
		log("Building new document form");
		elems.form = document.createElement('form');
		elems.form.className = 'oekaki-create-form oekaki-form';
		elems.container.appendChild(elems.form);

		var inputs = {
			"name": {
				label: "Drawing Name",
				type: "text",
				default: options.name
			},
			"width": {
				label: "Width (px)",
				type: "number",
				default: options.width,
				attributes: {
					"step": 1,
					"min": 10,
					"max": 1000
				}
			},
			"height": {
				label: "Height (px)",
				type: "number",
				default: options.height,
				attributes: {
					"step": 1,
					"min": 10,
					"max": 1000
				}
			},
			"background": {
				label: "Background Color",
				type: "select",
				default: "transparent",
				options: {
					"transparent": "Transparent",
					"white": "White",
					"black": "Black"
				}
			}
		};

		for (var name in inputs) {
			var inputSettings = inputs[name];
			var label = document.createElement("label");
			label.innerHTML = inputSettings.label;
			label.className = 'oekaki-create-input-' + name;

			var input;
			switch (inputSettings.type) {
				case 'textarea':
					input = document.createElement("textarea");
					break;
				case 'select':
					input = document.createElement("select");
					for (var opt in inputSettings.options) {
						var option = document.createElement("option");
						option.value = opt;
						option.innerHTML = inputSettings.options[opt];
						input.appendChild(option);
					}
					break;
				default:
					input = document.createElement("input");
					input.setAttribute("type", inputSettings.type);
					break;
			}

			input.setAttribute("name", name);

			if ('attributes' in inputSettings) {
				for (var attr in inputSettings.attributes) {
					input.setAttribute(attr, inputSettings.attributes[attr]);
				}
			}

			input.value = inputSettings.default;

			label.appendChild(input);
			elems.form.appendChild(label);
		}

		var btn = document.createElement('button');
		btn.innerHTML = "Start Drawing!";
		elems.form.appendChild(btn);

		elems.form.addEventListener("submit", function(e) {
			log("Received form submission");
			e.preventDefault();

			options.width = elems.form.width.value;
			options.height = elems.form.height.value;
			options.name = elems.form.name.value;
			options.backgroundColor = elems.form.background.value;

			if (options.backgroundColor == "black") {
				brush.color = "white";
			}

			elems.form.parentNode.removeChild(elems.form);
			elems.form = null;

			launch();
		});
	}

	function launch() {
		log("Launching");
		log(options);
		elems.page = document.createElement('div');
		elems.container.appendChild(elems.page);
		elems.page.className = "oekaki-page";
		elems.page.style.width = options.width + "px";
		elems.page.style.height = options.height + "px";

		document.originalTitle = document.title;
		updateTitle();

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

		// future: Allow several layers
		var bg = addLayer('Background', true);
		clear();

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
		
		window.addEventListener('beforeunload', function (e) {
			if (flags.unsaved) {
				e.preventDefault();
				e.returnValue = '';
			}
		});
	}

	function log(message) {
		if (options.debug) {
			console.log(message);
		}
	}

	function showMessage(message) {
		alert(message);
	}

	function setLayerActive(name) {
		if (name in layers) {
			log("Setting active layer: " + name);
			currentLayer = name;
			updateBrush();
		}
	}

	function updateBrush() {
		log("Updating brush for current layer");
		log(brush);
		var ctx = getCurrentLayer().ctx;
		ctx.strokeStyle = brush.color;
		ctx.lineWidth = brush.size;
		ctx.globalAlpha = brush.opacity;
	}

	function addLayer(name, isBg) {
		log("Adding layer: " + name);
		
		if (name in layers) {
			showMessage('A layer named "' + name + '" already exists');
			return;
		}

		var canvas = document.createElement('canvas');
		canvas.width = options.width;
		canvas.height = options.height;
		elems.page.appendChild(canvas);

		var layer = layers[name] = {
			canvas: canvas,
			ctx: canvas.getContext('2d'),
			isBackground: isBg
		};

		setLayerActive(name);

		return layer;
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

		var x, y;
		if (e.type == 'touchstart' || e.type == 'touchmove' || e.type == 'touchend' || e.type == 'touchcancel') {
			var touch = e.touches[0] || e.changedTouches[0];
			var rect = touch.target.getBoundingClientRect();
			x = touch.clientX - rect.x;
			y = touch.clientY - rect.y;
		} else if (e.type == 'mousedown' || e.type == 'mouseup' || e.type == 'mousemove' || e.type == 'mouseover'|| e.type=='mouseout' || e.type=='mouseenter' || e.type=='mouseleave') {
			x = e.layerX;
			y = e.layerY;
		}

		pos.x = x * 1/zoom;
		pos.y = y * 1/zoom;
	}

	events.startDrawing = function(e) {
		e.preventDefault();
		log("Start drawing");
		updatePosition(e);
		flags.drawing = true;
	}

	events.move = function(e) {
		e.preventDefault();
		if (flags.drawing) {
			updatePosition(e);
			draw(lastPos, pos);
		}
	}

	events.stopDrawing = function(e) {
		e.preventDefault();
		if (flags.drawing) {
			log("Stop drawing");
		}
		flags.drawing = false;
	}

	function getCurrentLayer() {
		return getLayer(currentLayer);
	}

	function getLayer(name) {
		return layers[name];
	}

	function draw(from, to) {
		var layer = getCurrentLayer();
		layer.ctx.beginPath();
		layer.ctx.moveTo(from.x, from.y);
		layer.ctx.lineTo(to.x, to.y);
		layer.ctx.stroke();
		layer.ctx.closePath();
		setUnsaved();
	}

	function updateTitle() {
		document.title = '"' + options.name + '" - ' + document.originalTitle;
		document.cleanTitle = document.title;
	}

	function setUnsaved() {
		if (!flags.unsaved) {
			document.title = '* ' + document.cleanTitle;
			flags.unsaved = true;
		}
	}

	function setSaved() {
		if (flags.unsaved) {
			document.title = document.cleanTitle;
			flags.unsaved = false;
		}
	}
	
	function clear() {
		for (var i in layers) {
			var layer = layers[i];
			if (layer.isBackground && options.backgroundColor && options.backgroundColor != "transparent") {
				layer.ctx.fillStyle = options.backgroundColor;
				layer.ctx.globalAlpha = 1;
				layer.ctx.fillRect(0, 0, layer.canvas.width, layer.canvas.height);
				updateBrush();
			} else {
				layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
			}
		}
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