var debug = false;

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
		// pos = { x: 0, y: 0 },
		// lastPos = { x: 0, y: 0 },
		elems = {
			container: null,
			page: null,
			buttons: null
		},
		layers = {},
		currentLayer,
		colorPicker,
		brush = new Brush("#000000", 2, 0.75),
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
					brush.setColor(prompt("Enter color (any valid HTML color code)", brush.getColor()));
				},
				label: "Set Color",
				active: false
			},
			setSize: {
				action: function(e) {
					brush.setSize(prompt("Enter brush size (in pixels)", brush.getSize()));
				},
				label: "Brush Size",
				active: true
			},
			setOpacity: {
				action: function(e) {
					brush.setOpacity(prompt("Enter opacity (0-100)", brush.getOpacity()));
				},
				label: "Set Opacity",
				active: true
			},
		};

	obj.setOptions = function(newOptions) {
		options = mergeDefaults(options, { ...newOptions });

		log(options);
		debug = options.debug;

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
				brush.setColor("#ffffff");
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

		// Has to be set after layer is created
		colorPicker = new ColorPicker({
			parentElement: elems.container,
			color: brush.getColor(),
			onChange: function(color) {
				log("Setting brush color " + color.toHex());
				brush.setColor(color.toHex());
			}
		});

		// Set up listeners
		elems.page.addEventListener("mousedown", events.startDrawing);
		window.addEventListener("mousemove", events.move);
		window.addEventListener("mouseup", events.stopDrawing);

		// touch controls
		elems.page.addEventListener("touchstart", events.startDrawing);
		window.addEventListener("touchmove", events.move);
		window.addEventListener("touchend", events.stopDrawing);
		elems.page.addEventListener("touchcancel", events.stopDrawing);
		
		window.addEventListener('beforeunload', function (e) {
			if (flags.unsaved) {
				e.preventDefault();
				e.returnValue = '';
			}
		});
	}

	function showMessage(message) {
		alert(message);
	}

	function setLayerActive(name) {
		if (name in layers) {
			log("Setting active layer: " + name);
			currentLayer = name;
		}
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

	events.startDrawing = function(e) {
		e.preventDefault();
		log("Start drawing");
		brush.setPosition(getEventPosition(e, elems.page));
		flags.drawing = true;
	}

	events.move = function(e) {
		e.preventDefault();
		if (flags.drawing) {
			brush.setPosition(getEventPosition(e, elems.page));
			brush.draw(getCurrentLayer());
			setUnsaved();
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
				//updateBrush();
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

function Brush(color, size, opacity) {
	var brush = this,
		altColor = null,
		position = null,
		path = [];

	brush.draw = function(layer) {
		layer.ctx.lineCap = 'round';
		layer.ctx.strokeStyle = brush.getColor();

		// brush glow!
		layer.ctx.shadowColor = brush.getColor();
		layer.ctx.shadowBlur = brush.getSize() / 10;

		layer.ctx.lineWidth = brush.getSize();
		layer.ctx.globalAlpha = brush.getOpacity();

		if (path.length) {
			var from = path[0];
			layer.ctx.beginPath();
			layer.ctx.moveTo(from.x, from.y);
			layer.ctx.lineTo(position.x, position.y);
			layer.ctx.stroke();
			layer.ctx.closePath();
		}
	}

	brush.setColor = function(newColor) {
		color = newColor;
		return brush;
	};

	brush.getColor = function() {
		return color;
	};

	brush.setAltColor = function(newColor) {
		altColor = newColor;
		return brush;
	};

	brush.getAltColor = function() {
		return altColor;
	};

	brush.swapColors = function() {
		var temp = color;
		color = altColor;
		altColor = color;
		return brush;
	};

	brush.setSize = function(newSize) {
		size = newSize;
		return brush;
	};

	brush.getSize = function() {
		return size;
	};

	brush.setOpacity = function(newOpacity) {
		opacity = newOpacity;
		return brush;
	};

	brush.getOpacity = function() {
		return opacity;
	};

	brush.setPosition = function(x, y) {
		if (typeof x == 'object') {
			y = x.y;
			x = x.x;
		}

		if (!position) {
			position = {x: null, y: null};
		} else {
			path.unshift({...position});
		}

		position.x = x;
		position.y = y;
		return brush;
	};

	brush.getPosition = function() {
		return {...position};
	};

	return brush;
}

function ColorPicker(setupOptions) {
	var defaultOptions = {
			parentElement: document.body,
			color: '#FFFFFF',
			pixelDensity: 2,
			spacing: 10,
			colorCanvas: {
				width: 255,
				height: 255
			},
			hueCanvas: {
				width: 360,
				height: 20
			},
			onChange: function(color) {
				log("Default onChange is in use")
			},
			autoInit: true
		},
		options = { ...defaultOptions },
		that = this,

		// State flags
		isClickingColor = false,
		isClickingHue = false,

		// Declare for scope
		container,
		hex,
		selectedColorSwatch,
		previewColorSwatch,
		colorCanvas,
		hueCanvas,
		colorCtx,
		hueCtx,
		selectedColor,
		previewColor;

	function createElements() {
		container = document.createElement('div');
		colorCanvas = document.createElement('canvas');
		var rightPanel = document.createElement('div');
		hex = document.createElement('input');
		selectedColorSwatch = document.createElement('div');
		previewColorSwatch = document.createElement('div');
		hueCanvas = document.createElement('canvas');
		colorCtx = colorCanvas.getContext('2d');
		hueCtx = hueCanvas.getContext('2d');

		options.parentElement.appendChild(container);
		container.appendChild(colorCanvas);
		container.appendChild(rightPanel);
		rightPanel.appendChild(hex);
		rightPanel.appendChild(selectedColorSwatch);
		rightPanel.appendChild(previewColorSwatch);
		container.appendChild(hueCanvas);

		var rightPanelWidth = Math.max(25, options.hueCanvas.width - options.colorCanvas.width - options.spacing);
		var fullWidth = Math.max(rightPanelWidth + options.spacing + options.colorCanvas.width, options.hueCanvas.width);

		container.className = 'color-picker';
		container.style.padding = options.spacing + 'px';
		container.style.width = fullWidth + 'px';

		rightPanel.className = 'right-panel';
		rightPanel.style.width = rightPanelWidth + 'px';
		rightPanel.style.marginLeft = options.spacing + 'px';
		
		hex.className = 'color-input';

		selectedColorSwatch.className = 'selected-color-swatch color-swatch';
		selectedColorSwatch.style.height = rightPanelWidth + 'px';
		selectedColorSwatch.style.marginBottom = options.spacing + 'px';
		selectedColorSwatch.style.marginTop = options.spacing + 'px';

		previewColorSwatch.className = 'preview-color-swatch color-swatch';
		previewColorSwatch.style.height = Math.max(rightPanelWidth, options.colorCanvas.height - rightPanelWidth - hex.offsetHeight - options.spacing * 2) + 'px';

		colorCanvas.className = 'color-canvas';
		colorCanvas.width = options.colorCanvas.width * options.pixelDensity;
		colorCanvas.height = options.colorCanvas.height * options.pixelDensity;
		colorCanvas.style.width = options.colorCanvas.width + 'px';
		colorCanvas.style.height = options.colorCanvas.height + 'px';

		hueCanvas.className = 'hue-canvas';
		hueCanvas.width = options.hueCanvas.width * options.pixelDensity;
		hueCanvas.height = options.hueCanvas.height * options.pixelDensity;
		hueCanvas.style.width = options.hueCanvas.width + 'px';
		hueCanvas.style.height = options.hueCanvas.height + 'px';
		hueCanvas.style.marginTop = options.spacing + 'px';

	}

	function init() {
		log("Initializing color picker");
		createElements();
		drawHueGradient();
		selectColor(colorFromHex(options.color))	;

		window.addEventListener('mousemove', function(e) {
			if (isClickingColor && !isClickingHue) {
				selectColor(getColorFromEvent(e));
			}
		});

		colorCanvas.addEventListener('mousemove', function(e) {
			if (!isClickingHue) {
				setPreviewColor(getColorFromEvent(e));
			}
		});
	
		colorCanvas.addEventListener('mouseout', function(e) {
			if (!isClickingColor) {
				setPreviewColor(selectedColor);
			}
		});
	
		colorCanvas.addEventListener('mousedown', function(e) {
			isClickingColor = true;
		});
	
		colorCanvas.addEventListener('click', function(e) {
			selectColor(getColorFromEvent(e));
		});
	
		document.addEventListener('mouseup', function(e) {
			isClickingColor = false;
			isClickingHue = false;
		});
	
		hueCanvas.addEventListener('click', function(e) {
			selectColor(adjustHueFromPosition(e));
		});
	
		hueCanvas.addEventListener('mousedown', function(e) {
			isClickingHue = true;
		});
	
		window.addEventListener('mousemove', function(e) {
			var newColor = adjustHueFromPosition(e);
			if (!isClickingColor && isClickingHue) {
				selectColor(newColor);
			}
		});

		hueCanvas.addEventListener('mousemove', function(e) {
			var newColor = adjustHueFromPosition(e);
			if (!isClickingColor && !isClickingHue) {
				setPreviewColor(newColor);
			}
		});

		hueCanvas.addEventListener('mousedown', function(e) {
			isClickingHue = true;
		});
	
		hueCanvas.addEventListener('mouseout', function(e) {
			if (!isClickingHue) {
				setPreviewColor(selectedColor);
			}
		});
	
		hex.addEventListener('change', function() {
			selectColor(colorFromHex(hex.value));
		});
	}

	function setPreviewColor(color) {
		if (!previewColor || previewColor.h != color.h) {
			drawPickerGradient(color.getHueColor());
			drawColorDisc(color);
		}
		previewColor = color;
		previewColorSwatch.style.backgroundColor = previewColor.toString();
		hex.value = previewColor.toHex();
	}

	function drawPickerGradient(hueColor) {
		var grad = colorCtx.createLinearGradient(0, 0, colorCanvas.width, 0);
		grad.addColorStop(0, 'rgba(255, 255, 255)');
		grad.addColorStop(1, hueColor.toString());

		colorCtx.fillStyle = grad;
		colorCtx.fillRect(0, 0, colorCanvas.width, colorCanvas.height);

		var vgrad = colorCtx.createLinearGradient(0, 0,0 , colorCanvas.height);
		vgrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
		vgrad.addColorStop(1, 'rgba(0, 0, 0, 255)');

		colorCtx.fillStyle = vgrad;
		colorCtx.fillRect(0, 0, colorCanvas.width, colorCanvas.height);
	}

	function selectColor(color) {
		setPreviewColor(color);

		selectedColor = color;
		selectedColorSwatch.style.backgroundColor = color.toString();
		drawColorDisc(color);
		drawSelectedHueBox(color);

		options.onChange(color);
	}

	function drawColorDisc(color) {
		drawPickerGradient(color.getHueColor());
		var x = colorCanvas.width * (color.s / 100),
			y = colorCanvas.height * (1 - color.v / 100);

		colorCtx.beginPath();
		colorCtx.arc(x + 1, y + 1, 14, 0, 2 * Math.PI);
		colorCtx.strokeStyle = "rgba(0, 0, 0, 0.3)";
		colorCtx.lineWidth = 2;
		colorCtx.stroke();
		colorCtx.closePath();

		colorCtx.beginPath();
		colorCtx.arc(x, y, 14, 0, 2 * Math.PI);
		colorCtx.strokeStyle = "rgba(255, 255, 255, 0.7)";
		colorCtx.lineWidth = 2;
		colorCtx.stroke();
		colorCtx.closePath();
	}

	function drawSelectedHueBox(color) {
		drawHueGradient();
		var x = color.h / 360 * hueCanvas.width,
			w = 15;

		hueCtx.lineWidth = 2;

		hueCtx.strokeStyle = "rgba(0, 0, 0, 0.5)";
		hueCtx.strokeRect(x - (w/2), 2, w, hueCanvas.height - 2);

		hueCtx.strokeStyle = "rgba(255, 255, 255, 0.9)";
		hueCtx.strokeRect(x - (w/2) - 1, 1, w, hueCanvas.height - 2);
		
	}

	function drawHueGradient() {
		hueCtx.clearRect(0, 0, hueCanvas.width, hueCanvas.height);

		var hues = [
			"#ff0000",
			"#ffff00",
			"#00ff00",
			"#00ffff",
			"#0000ff",
			"#ff00ff",
			"#ff0000"
		];

		var padding = 4;
		var hueGrad = colorCtx.createLinearGradient(0, 0, hueCanvas.width, 0);
		for (var i in hues) {
			var start = i / (hues.length - 1);
			hueGrad.addColorStop(start, hues[i]);
		}
		hueCtx.fillStyle = hueGrad;
		hueCtx.fillRect(padding, padding, hueCanvas.width - padding * 2, hueCanvas.height - padding * 2);
	}

	function adjustHueFromPosition(e) {
		var coords = getEventPosition(e, hueCanvas);
		var hue = 360 * coords.x / hueCanvas.width * 2;
		return new Color(new HSV(hue, previewColor.s, previewColor.v));
	}

	function colorFromHex(hex) {
		var m = hex.match(/^#?([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})$/);

		if (!m) {
			throw hex + " is not a valid hexadecimal value";
		}

		var rgb = new RGB(
			parseInt(m[1], 16),
			parseInt(m[2], 16),
			parseInt(m[3], 16)
		);

		return new Color(rgb);
	}

	function getColorFromEvent(e) {
		var coords = getEventPosition(e, colorCanvas);
		var s = coords.x * 2 / colorCanvas.width * 100;
		var v = 100 - coords.y * 2 / colorCanvas.height * 100;
		return new Color(new HSV(previewColor.h, s, v));
	}

	options = mergeDefaults(options, { ...setupOptions });

	that.init = init;

	that.getSelectedColor = function() {
		return selectedColor;
	}

	that.setSelectedColor = selectColor;
	that.setPreviewColor = setPreviewColor;

	if (options.autoInit) {
		init();
	}

	return that;
}

function HSV(h, s, v) {
	var that = this;
	that.h = Math.min(Math.max(0, h), 360);
	that.s = Math.min(Math.max(0, s), 100);
	that.v = Math.min(Math.max(0, v), 100);
	that.type = 'HSV';

	that.toArray = function() {
		return [that.h, that.s, that.v];
	}

	return that;
}

function RGB(r, g, b) {
	var that = this;
	that.r = Math.min(Math.max(0, r), 255);
	that.g = Math.min(Math.max(0, g), 255);
	that.b = Math.min(Math.max(0, b), 255);
	that.type = 'RGB';

	that.toArray = function() {
		return [that.r, that.g, that.b];
	}

	return that;
}

function Color(rgbOrHsv, a) {
	var that = this;

	that.a = a || 1;
	
	switch (rgbOrHsv.type) {
		case "RGB":
			makeFromRGB(rgbOrHsv);
			break;
		case "HSV":
			makeFromHSV(rgbOrHsv);
			break;
		default: throw new "Unknown type passed into color";
	}

	function makeFromHSV(hsv) {
		that.h = hsv.h;
		that.s = hsv.s;
		that.v = hsv.v;

		var rgb = [null, null, null];

		var hPos = hsv.h / 120;
		var iMax = Math.round(hPos),
			iMid = iMax > hPos? iMax - 1 : iMax + 1,
			iMin = iMax > hPos? iMax + 1 : iMax - 1;

		var cMax = hsv.v / 100 * 255;
		var cMin = cMax * (100 - hsv.s) / 100;
		var cMid = cMin + ( Math.abs(iMax - hPos) * 2 * (cMax - cMin) );

		rgb[(3 + iMax) % 3] = Math.round(cMax);
		rgb[(3 + iMid) % 3] = Math.round(cMid);
		rgb[(3 + iMin) % 3] = Math.round(cMin);

		that.r = rgb[0];
		that.g = rgb[1];
		that.b = rgb[2];
	}

	function makeFromRGB(rgbObj) {
		that.r = rgbObj.r;
		that.g = rgbObj.g;
		that.b = rgbObj.b;

		var rgb = rgbObj.toArray();

		var max = Math.max(...rgb);
		var min = Math.min(...rgb);

		// Calculate value
		that.v = Math.round((max / 255) * 100);

		if (max == min) {
			that.h = 0;
			that.s = 0;
			return;
		}

		// Calculate hue
		that.h = 0;
		var foundMax = false;
		for (var i in rgb) {
			if (rgb[i] == max && !foundMax) {
				that.h += i * 120;
				foundMax = true;
			} else if (rgb[i] > min) {
				var mult = foundMax? 1 : -1;

				if (i == rgb.length - 1 && foundMax) {
					that.h = 360;
					mult = -1;
				}

				that.h += mult * ((rgb[i] - min) / (max - min)) * 60;
			}
		}

		that.h = Math.round(that.h);

		// Calculate saturation
		that.s = Math.round(100 * (max - min) / max);
	
	}

	that.toString = function() {
		return "rgba(" + that.r + ", " + that.g + ", " + that.b + ", " + that.a + ")";
	}

	that.toHex = function() {
		return "#" + ("000000" + ((that.r << 16) | (that.g << 8) | that.b).toString(16)).slice(-6).toUpperCase();
	}

	that.toHSVA = function() {
		return "hsva(" + that.h + ", " + that.s + ", " + that.v + ", " + that.a + ")";
	}

	that.getHueColor = function() {
		return new Color(new HSV(that.h, 100, 100));
	}

	return that;
}


// Utility functions //

function mergeDefaults(defaults, values) {
	for (var key in defaults) {
		if (defaults.hasOwnProperty(key) && !values.hasOwnProperty(key)) {
			values[key] = defaults[key];
		}
	}
	return values;
}

function log(message) {
	if (debug) {
		console.log(message);
	}
}

function getEventPosition(e, elem, zoom) {
	var x, y, eventX, eventY;

	if (!elem) {
		elem = touch.target;
	}

	if (!zoom) {
		zoom = 1;
	}

	var rect = elem.getBoundingClientRect();

	if (e.type == 'touchstart' || e.type == 'touchmove' || e.type == 'touchend' || e.type == 'touchcancel') {
		var touch = e.touches[0] || e.changedTouches[0];
		
		eventX = touch.clientX;
		eventY = touch.clientY;
	} else {
		eventX = e.clientX;
		eventY = e.clientY;
	}

	x = eventX - rect.x;
	y = eventY - rect.y;

	return {x: x * 1/zoom, y: y * 1/zoom};
}