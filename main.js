var debug = false;

function Oekaki(setupOptions) {
	const SAVED_DRAWING_PREFIX = 'savedDrawing:';

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
			toolbar: null,
			titlebar: null,
			layerSelect: null,
			buttons: {}
		},
		colors = {
			foreground: {
				elem: null,
				baseClasses: 'oekaki-color oekaki-color-primary',
				isPrim: true,
				isActive: true
			},
			background: {
				elem: null,
				baseClasses: 'oekaki-color oekaki-color-alt',
				isPrim: false,
				isActive: false
			},
			active: null
		},
		layers = {},
		currentLayer,
		workingCanvas,
		workingContext,
		history = [],
		redoHistory = [],
		savedAs = null,
		// TO DO: Use color class with brush
		brush = new Brush("#000000", 2, 100),
		zoom = 1,
		flags = {
			drawing: false,
			initialized: false,
			unsaved: false,
			eyedropper: false
		},
		events = {},
		buttons = {
			save: {
				action: function(e) {
					save();
				},
				label: "Save",
				keyCommand: "⌘S",
				active: true
			},
			rename: {
				action: function(e) {
					var name = prompt("Enter drawing name", options.name);
					if (name) {
						options.name = name;
						updateTitle();
					}
				},
				label: "Rename",
				active: true
			},
			undo: {
				action: events.undo,
				label: "Undo",
				keyCommand: "⌘Z",
				active: true
			},
			redo: {
				action: events.redo,
				label: "Redo",
				keyCommand: "⌘⇧Z",
				active: true
			},
			clear: {
				action: function(e) {
					clear();
					logAction("clear");
				},
				label: "Clear",
				active: true
			},
			setColor: {
				action: function(e) {
					var color = prompt("Enter color (any valid HTML color code)", brush.getColor());
					if (color) {
						brush.setColor(color);
					}
				},
				label: "Set Color",
				active: false
			},
			setSize: {
				action: function(e) {
					var size = prompt("Enter brush size (in pixels)", brush.getSize());
					if (size) {
						brush.setSize(size);
					}
				},
				label: "Brush Size",
				active: true
			},
			setOpacity: {
				action: function(e) {
					var opacity = prompt("Enter opacity (0-100)", brush.getOpacity());
					if (opacity) {
						brush.setOpacity(opacity);
					}
				},
				label: "Set Opacity",
				active: true
			},
			download: {
				action: function(e) {
					download(options.name);
				},
				label: "Download",
				active: false
			},
			export: {
				action: function(e) {
					exportPNG(options.name + ".png");
				},
				label: "Export",
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

		var saveBtn = document.createElement('button');
		saveBtn.innerHTML = "New Drawing";
		elems.form.appendChild(saveBtn);


		// Uploading the saved files isn't working right now.
		// elems.form.appendChild(document.createElement('hr'));

		// var loadFile = document.createElement('input');
		// loadFile.type = 'file';
		// loadFile.innerHTML = "Load File";
		// elems.form.appendChild(loadFile);

		// loadFile.addEventListener("change", function(e) {
		// 	e.preventDefault();

		// 	elems.form.innerHTML = "Loading file...";

		// 	var file = e.target.files[0];
		// 	var reader = new FileReader();
		// 	reader.addEventListener("load", function(e) {
		// 		load(e.target.result);

		// 		elems.form.parentNode.removeChild(elems.form);
		// 		elems.form = null;
		// 	});

		// 	reader.readAsText(file);
		// });

		var savedDrawings = getSavedDrawingsList();

		if (savedDrawings.length) {
			elems.form.appendChild(document.createElement('hr'));
			
			var loadDrawing = document.createElement('select');
			loadDrawing.className = "oekaki-load-select";

			savedDrawings.forEach(function(filename) {
				var option = document.createElement('option');
				option.innerHTML = filename;
				loadDrawing.appendChild(option);
			});

			log(savedDrawings);

			elems.form.appendChild(loadDrawing);

			var loadBtn = document.createElement('button');
			loadBtn.innerHTML = "Load";
			elems.form.appendChild(loadBtn);

			loadBtn.addEventListener("click", function(e) {
				e.preventDefault();

				if (loadDrawing.value === "") {
					return;
				}

				var fileContent = localStorage.getItem("savedDrawing:" + loadDrawing.value);
				if (load(fileContent)) {
					savedAs = loadDrawing.value;
					elems.form.parentNode.removeChild(elems.form);
					elems.form = null;
				}
				// to do: get the filename of the selected option, load the file in that location from localStorage
			});
		}

		elems.form.addEventListener("submit", function(e) {
			log("Received form submission");
			e.preventDefault();

			options.width = elems.form.width.value;
			options.height = elems.form.height.value;
			options.name = elems.form.name.value;
			options.backgroundColor = elems.form.background.value;

			if (options.backgroundColor == "black") {
				brush.setColors("#ffffff", "#000000");
			} else {
				brush.setColors("#000000", "#ffffff");
			}

			elems.form.parentNode.removeChild(elems.form);
			elems.form = null;

			launch();
		});
	}

	function launch() {
		initDocument();
		addLayer('Background', true);
		clear();
	}

	function initDocument() {
		log("initDocument");
		log(options);
		initTitlebar(elems.container);

		// Main area
		var rows = document.createElement('div');
		rows.className = 'oekaki-rows';
		elems.container.appendChild(rows);

		initToolbar(rows);
		initPage(rows);
		initListeners();
	}

	function initTitlebar(parent) {
		elems.titlebar = document.createElement('div');
		elems.titlebar.className = "oekaki-titlebar";
		parent.appendChild(elems.titlebar);

		document.originalTitle = document.title;
		updateTitle();
	}

	function initToolbar(parent) {
		elems.toolbar = document.createElement('div');
		elems.toolbar.className = 'oekaki-toolbar';
		parent.appendChild(elems.toolbar);

		for (var buttonName in buttons) {
			createButton(elems.toolbar, buttonName, buttons[buttonName]);
		}

		initColors(elems.toolbar);
		initLayers(elems.toolbar);
	}

	function createButton(parent, buttonName, button) {
		if (typeof button.active == 'undefined') {
			button.active = true;
		}

		if (!button.active) {
			return;
		}

		var btn = document.createElement('div');
		btn.className = "oekaki-button oekaki-button-" + buttonName;
		btn.innerHTML = button.label;
		if ('keyCommand' in button) {
			btn.innerHTML += '<small class="oekaki-button-command">' + button.keyCommand + "</small>";
		}
		btn.addEventListener("click", button.action);
		elems.buttons[buttonName] = btn;
		parent.appendChild(btn);
		return btn;
	}

	function initPage(parent) {
		var pageContainer = document.createElement('div');
		pageContainer.className = 'oekaki-page-container';

		elems.page = document.createElement('div');
		elems.page.className = "oekaki-page oekaki-transbg";
		elems.page.style.width = options.width + "px";
		elems.page.style.height = options.height + "px";

		pageContainer.appendChild(elems.page);
		parent.appendChild(pageContainer);

		workingCanvas = document.createElement('canvas');
		workingCanvas.className = 'oekaki-working-canvas';
		workingCanvas.width = options.width;
		workingCanvas.height = options.height;
		workingContext = workingCanvas.getContext('2d');
		elems.page.appendChild(workingCanvas);
	}

	function initColors(parent) {
		colors.foreground.elem = document.createElement('div');
		colors.background.elem = document.createElement('div');

		var colorsContainer = document.createElement('div');
		colorsContainer.className = 'oekaki-colors';
		colorsContainer.appendChild(colors.foreground.elem);
		colorsContainer.appendChild(colors.background.elem);
		parent.appendChild(colorsContainer);

		colors.foreground.colorPicker = new ColorPicker({
			parentElement: document.body,
			color: brush.getColor(),
			modal: true,
			onChange: function(color) {
				log("Setting brush color " + color.toHex());
				brush.setColor(color.toHex());
				// brush.setOpacity(color.getOpacity());
				colors.foreground.elem.style.backgroundColor = color.toString();
			}
		});

		colors.background.colorPicker = new ColorPicker({
			parentElement: document.body,
			color: brush.getAltColor(),
			modal: true,
			onChange: function(color) {
				log("Setting brush alt color " + color.toHex());
				brush.setAltColor(color.toHex());
				// brush.setOpacity(color.getOpacity());
				colors.background.elem.style.backgroundColor = color.toString();
			}
		});

		colors.foreground.elem.colorObj = colors.foreground;
		colors.background.elem.colorObj = colors.background;
		colors.foreground.elem.otherColor = colors.background;
		colors.background.elem.otherColor = colors.foreground;

		var setColorActive = function(color, isActive) {
			color.elem.className = color.baseClasses
			if (isActive) {
				color.elem.className += ' oekaki-color-active';
				brush.setPrimColorFlag(color.isPrim);
				colors.active = color;
			}
			color.isActive = isActive;
		};

		var clickColor = function(e) {
			e.preventDefault();
			var isActive = e.target.colorObj.isActive;
			if (!isActive) {
				setColorActive(e.target.colorObj, !isActive);
				setColorActive(e.target.otherColor, isActive);
			} else {
				// show color picker
				e.target.colorObj.colorPicker.showModal();
			}
		};

		setColorActive(colors.foreground, true);
		setColorActive(colors.background, false);

		colors.foreground.elem.addEventListener('click', clickColor);
		colors.background.elem.addEventListener('click', clickColor);
	}

	function initLayers(parent) {
		var layerSelect = elems.layerSelect = document.createElement('select');
		layerSelect.className = 'oekaki-layers';
		
		layerSelect.addEventListener("change", function(e) {
			setLayerActive(layerSelect.value);
		});

		parent.appendChild(elems.layerSelect);

		createButton(parent, 'newLayer', {
			label: "+ Layer",
			action: function(e) {
				var layerName = prompt("New Layer Name", "Layer " + Object.keys(layers).length);

				if (!layerName) {
					return;
				}

				if (layerName in layers) {
					showMessage("Layer name is already in use");
					return;
				}

				addLayer(layerName);
			}
		});
	}

	function initListeners() {
		// Set up listeners
		workingCanvas.addEventListener("mousedown", events.startDrawing);
		window.addEventListener("mousemove", events.move);
		window.addEventListener("mouseup", events.stopDrawing);

		window.addEventListener("keydown", events.keyDown);
		window.addEventListener("keyup", events.keyUp);
		window.addEventListener("keypress", events.keyPress);

		var cursorEvts = [
			"keydown", "keyup", "keypress", "mouseup", "mousedown", "mousemove"
		];
		for (var i in cursorEvts) {
			workingCanvas.addEventListener(cursorEvts[i], events.setCursor);
		}

		// touch controls
		workingCanvas.addEventListener("touchstart", events.startDrawing);
		workingCanvas.addEventListener("touchmove", events.draw);
		workingCanvas.addEventListener("touchend", events.stopDrawing);
		workingCanvas.addEventListener("touchcancel", events.stopDrawing);
		
		window.addEventListener('beforeunload', function (e) {
			if (flags.unsaved) {
				e.preventDefault();
				e.returnValue = '';
			}
		});
	}

	function showMessage(message) {
		throw message;
	}

	function setLayerActive(name) {
		if (name in layers) {
			log("Setting active layer: " + name);
			currentLayer = name;
			elems.layerSelect.value = name;
		}
	}

	function addLayer(name, isBg, _saveState) {
		log("Adding layer: " + name);
		
		if (typeof isBg == "undefined") {
			isBg = false;
		}

		if (typeof _saveState == "undefined") {
			_saveState = true;
		}

		if (_saveState) {
			logAction("addLayer", {args: [name, isBg]});
		}

		if (name in layers) {
			showMessage('A layer named "' + name + '" already exists');
			return;
		}

		var option = document.createElement("option");
		option.innerHTML = name;
		if (elems.layerSelect.children.length) {
			elems.layerSelect.insertBefore(option, elems.layerSelect.children[0]);
		} else {
			elems.layerSelect.appendChild(option);
		}

		var canvas = document.createElement('canvas');
		canvas.width = options.width;
		canvas.height = options.height;
		elems.page.insertBefore(canvas, workingCanvas);

		var layer = layers[name] = {
			canvas: canvas,
			ctx: canvas.getContext('2d'),
			isBackground: isBg
		};

		setLayerActive(name);

		return layer;
	}

	function canDraw() {
		var canDraw = !flags.eyedropper;
		return canDraw;
	}

	function copyCanvasToContext(canvas, copyToContext) {
		copyToContext.drawImage(canvas, 0, 0, canvas.width, canvas.height);
	}

	function commitWorkingCanvas() {
		copyCanvasToContext(workingCanvas, getCurrentLayer().ctx);
		clearWorkingCanvas();
	}

	function clearWorkingCanvas() {
		workingContext.clearRect(0, 0, workingCanvas.width, workingCanvas.height);
	}

	function draw(e) {
		brush.addToPath(getEventPositions(e, elems.page, zoom));
		clearWorkingCanvas();
		brush.draw(workingContext);
		setUnsaved();
	}

	function redraw() {
		reset();
		for (var i = 0; i < history.length; ++i) {
			log(history[i]);
			redoState(history[i]);
		}
	}

	function redoState(state) {
		switch (state.action) {
			case "brush": brush.drawPath(getLayer(state.layer).ctx, state.stroke); break;
			case "clear": clear(); break;
			case "addLayer": addLayer(...state.args, false); break;
		}
	}

	function logAction(action, state) {
		if (typeof state == "undefined") {
			state = {};
		}

		state.action = action;
		history.push(state);
		redoHistory = [];
	}

	function undo() {
		if (history.length > 1) {
			var state = history.pop();
			clearWorkingCanvas();
			redoHistory.push(state);
			redraw();
		}
	}

	function redo() {
		if (redoHistory.length) {
			var state = redoHistory.pop();
			redoState(state);
			history.push(state);
		}
	}

	events.startDrawing = function(e) {
		if (canDraw()) {
			e.preventDefault();
			log("Start drawing");

			brush.addToPath(getEventPositions(e, elems.page, zoom));
			flags.drawing = true;
		}

		if (flags.eyedropper) {
			events.eyeDropper(e);
		}
	}

	events.undo = function(e) {
		e.preventDefault();
		undo();
	};

	events.redo = function(e) {
		e.preventDefault();
		redo();
	};

	events.keyDown = function(e) {
		if (e.altKey) {
			flags.eyedropper = true;
		}

		if (e.ctrlKey || e.metaKey) {
			switch (e.key.toUpperCase()) {
				case 'S':
					e.preventDefault();
					save();
					break;
				case 'Z':
					if (e.shiftKey) {
						events.redo(e);
					} else {
						events.undo(e);
					}
					break;
			}
		}
	};

	events.keyUp = function(e) {
		flags.eyedropper = false;
	};

	events.eyeDropperPreview = function(e) {
		// option/alt
		if (flags.eyedropper) {
			e.preventDefault();
			var pos = getEventPosition(e, elems.page);
			var color = colors.active.colorPicker.eyeDropper(pos.x, pos.y, getCurrentLayer().ctx);
			colors.active.colorPicker.setPreviewColor(color);
			flags.blockDrawing = true;
		}
	}

	events.eyeDropper = function(e) {
		// option/alt
		if (flags.eyedropper) {
			e.preventDefault();
			var pos = getEventPosition(e, elems.page);
			var color = colors.active.colorPicker.eyeDropper(pos.x, pos.y, getCurrentLayer().ctx);
			colors.active.colorPicker.setSelectedColor(color);
			flags.blockDrawing = true;
		}
	};

	events.move = function(e) {
		e.preventDefault();

		if (flags.eyedropper) {
			events.eyeDropperPreview(e);
		}

		if (flags.drawing && canDraw()) {
			draw(e);
		}
	}
	
	events.setCursor = function(e) {
		var cursor = '';
		if (e.altKey) {
			cursor = 'crosshair';
		} else if (flags.drawing) {
			cursor = 'none';
		}
		elems.page.style.cursor = cursor;
	}

	events.stopDrawing = function(e) {
		e.preventDefault();
		if (flags.drawing) {
			log("Stop drawing");
			if (brush.isDot()) {
				draw(e);
			}
			var stroke = brush.clearPath();
			logAction("brush", {
				layer: currentLayer,
				stroke: stroke
			});
			commitWorkingCanvas();
		}
		flags.drawing = false;
		flags.blockDrawing = false;
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
		elems.titlebar.textContent = '"' + options.name + '"';
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

	function reset() {
		// delete all layers
		for (var key in layers) {
			var layer = layers[key];
			layer.canvas.remove();
			delete layers[key];
		}
		log(layers);
		clearWorkingCanvas();
	}

	function drawBgColor(layer) {
		layer.ctx.fillStyle = options.backgroundColor;
		layer.ctx.globalAlpha = 1;
		layer.ctx.fillRect(0, 0, layer.canvas.width, layer.canvas.height);
	}
	
	function clear() {
		for (var key in layers) {
			var layer = layers[key];
			if (layer.isBackground && options.backgroundColor && options.backgroundColor != "transparent") {
				drawBgColor(layer);
				//updateBrush();
			} else {
				layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
			}
		}

		clearWorkingCanvas();
	}

	function load(fileContents) {
		if (!fileContents) {
			throw "Empty file";
		}
		var compressed = LZString.decompress(fileContents);

		if (!compressed) {
			throw "Unable to decompress file";
		}

		var json = JSON.parse(compressed);
			
		if (!json) {
			throw "Unable to parse file";
		}

		options.width = json.options.width;
		options.height = json.options.height;
		options.name = json.options.name;
		options.backgroundColor = json.options.backgroundColor;

		if (options.backgroundColor == "black") {
			brush.setColors("#ffffff", "#000000");
		} else {
			brush.setColors("#000000", "#ffffff");
		}

		initDocument();
		history = json.history;
		redraw();

		return true;
	}

	function generateSaveFile() {
		var output = {
			options: options,
			layers: [],
			currentLayer: currentLayer,
			history: history
		};

		var layerNames = Object.keys(layers);
		for (var i = 0; i < layerNames.length; ++i) {
			var name = layerNames[i];
			output.layers.push({name: name, isBg: layers[name].isBg});
		}

		return LZString.compress(JSON.stringify(output));
	}

	function getSavedDrawingsList() {
		var savedDrawings = localStorage.getItem("savedDrawings");

		if (savedDrawings === null || savedDrawings.length == 0) {
			log("No saved drawings list, loading from localStorage keys");
			savedDrawings = [];
			for (var i = 0; i < localStorage.length; ++i) {
				var k = localStorage.key(i);
				log(k);
				if (k.indexOf(SAVED_DRAWING_PREFIX) == 0) {
					savedDrawings.push(k.slice(SAVED_DRAWING_PREFIX.length));
				}
			}
		} else {
			try {
				savedDrawings = JSON.parse(savedDrawings);
			} catch (e) {
				savedDrawings = [];
			}
		}

		return savedDrawings;
	}

	function save(filename) {
		if (typeof filename == "undefined") {
			filename = options.name;
		}
		var content = generateSaveFile();
		var savedDrawings = getSavedDrawingsList();

		log(savedDrawings);
		
		var i = 0;
		if (savedAs != filename && savedDrawings.indexOf(filename) >= 0) {
			var keyName = filename;
			while (savedDrawings.indexOf(keyName) >= 0) {
				keyName = filename + " (" + (++i) + ")";
			}

			if (!confirm(filename + " already exists. Overwrite?")) {
				if (confirm("Save as " + keyName + "?")) {
					filename = keyName;
					options.name = filename;
					updateTitle();
				} else {
					return;
				}
			}
		}

		if (savedDrawings.indexOf(filename) == -1) {
			savedDrawings.push(filename);
		}

		localStorage.setItem("savedDrawings", JSON.stringify(savedDrawings.sort()));
		localStorage.setItem(SAVED_DRAWING_PREFIX + filename, content);
		savedAs = filename;
		setSaved();
	}

	function download(filename) {
		var content = generateSaveFile();
		var file = new File([content], filename, {
			type: 'application/oekaki-drawing'
		});
		var fileReader = new FileReader();
		fileReader.addEventListener("load", function() {
			downloadDataURI(filename + '.oedraw', fileReader.result);
		});
		fileReader.readAsDataURL(file);
	}

	function exportPNG(filename) {
		clearWorkingCanvas();

		// Flatten all layers on to working canvas
		var layerNames = Object.keys(layers).reverse();
		for (var i = 0; i < layerNames.length; ++i) {
			var name = layerNames[i];
			var layer = layers[name];
			copyCanvasToContext(layer.canvas, workingContext);
		}

		downloadDataURI(filename, workingCanvas.toDataURL());
		clearWorkingCanvas();
	}

	function downloadDataURI(filename, dataURI) {
		var a = document.createElement('a');
		a.href = dataURI;
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
		isPrimColor = true,
		path = [];

	brush.draw = function(context) {
		var strokeInfo = brush.getStrokeInfo();
		return brush.drawPath(context, strokeInfo);
	};

	brush.drawPath = function(context, strokeInfo) {
		context.lineCap = 'round';
		context.lineJoin = 'round';
		context.strokeStyle = strokeInfo.color;
		context.lineWidth = strokeInfo.size;
		context.fillStyle = '';
		context.globalAlpha = strokeInfo.opacity / 100;

		if (strokeInfo.path.length > 1) {
			var fromPoint = new Point(strokeInfo.path[0]);

			context.moveTo(fromPoint.x, fromPoint.y);
			context.beginPath();

			for (var i = 1; i < strokeInfo.path.length; i++) {
				toPoint = new Point(strokeInfo.path[i])
				var midpoint = fromPoint.getMidpoint(toPoint);
				context.quadraticCurveTo(fromPoint.x, fromPoint.y, midpoint.x, midpoint.y);
				fromPoint = midpoint;
			}

			context.stroke();
			context.closePath();
		}
		return brush;
	}

	brush.getStrokeInfo = function() {
		return {
			path: path,
			color: brush.getColor(),
			size: brush.getSize(),
			opacity: brush.getOpacity()
		};
	};

	brush.isDot = function() {
		return path.length === 1;
	};

	brush.clearPath = function() {
		var stroke = brush.getStrokeInfo();
		path = [];
		return stroke;
	};

	brush.setColors = function(primColor, altColor) {
		return brush.setColor(primColor).setAltColor(altColor);
	};

	brush.setColor = function(newColor) {
		color = newColor;
		return brush;
	};

	brush.getPrimColor = function() {
		return color;
	};

	brush.getColor = function() {
		return brush.isPrimColor()? brush.getPrimColor() : brush.getAltColor() ;
	};

	brush.setPrimColorFlag = function(bool) {
		isPrimColor = bool;
		return brush;
	};

	brush.isPrimColor = function(bool) {
		return isPrimColor;
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
	
	brush.addToPath = function(positions) {
		for (var i = 0; i < positions.length; ++i) {
			brush.setPosition(positions[i].x, positions[i].y);
		}

		return brush;
	};

	brush.setPosition = function(x, y) {
		if (typeof x == 'object') {
			y = x.y;
			x = x.x;
		}
		
		position = {x: x, y: y};
		path.unshift(position);
		return brush;
	};

	brush.getPosition = function() {
		return {...position};
	};

	return brush;
}


function Point(x, y) {
	var that = this;

	if (typeof x == 'object') {
		y = x.y;
		x = x.x;
	}

	that.x = x;
	that.y = y;

	that.getDistance = function(point) {
		var diff = that.getDiff(point);
		return Math.sqrt(Math.pow(diff.x, 2) + Math.pow(diff.y, 2));
	};

	that.getMidpoint = function(point) {
		var diff = that.getDiff(point);
		var midpoint = new Point(that.x - diff.x / 2, that.y - diff.y / 2);
		return midpoint;
	};

	that.getAngle = function(point) {
		var diff = that.getDiff(point);
		return Math.atan2(diff.x, diff.y);
	};

	that.getDiff = function(point) {
		var diff = new Point(that.x - point.x, that.y - point.y);
		// log([that.x, that.y, point.x, point.y, diff.x, diff.y]);
		return diff;
	};

	that.toObject = function() {
		return {
			x: that.x,
			y: that.y
		};
	}

	return that;
}

function ColorPicker(setupOptions) {
	var defaultOptions = {
			parentElement: document.body,
			color: '#FFFFFF',
			pixelDensity: 2,
			spacing: 10,
			modal: false,
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
		previewColor,
		modal;

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

		if (options.modal) {
			modal = new Modal(options.parentElement, 'color-picker-');
			modal.appendChild(container);
		} else {
			options.parentElement.appendChild(container);
		}

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

	that.eyeDropper = function(x, y, ctx) {
		var data = ctx.getImageData(x, y, 1, 1).data;	
		return new Color(new RGB(data[0], data[1], data[2]), data[3] / 255);
	}

	that.showModal = function() {
		if (modal) {
			modal.open();
		}
	}
	
	that.hideModal = function() {
		if (modal) {
			modal.close();
		}
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

	that.getAlpha = function() {
		return that.a;
	}

	that.getOpacity = function() {
		return that.a * 100;
	}

	return that;
}

function Modal(container, classPrefix) {
	var modal = this,
		elem = document.createElement('div')
		baseClass = classPrefix + 'modal';
		
	modal.appendChild = function(child) {
		elem.appendChild(child);
	};

	modal.open = function() {
		elem.className = baseClass + ' ' + baseClass + '-open';
		modal.isActive = true;
	};

	modal.close = function() {
		elem.className = baseClass + ' ' + baseClass + '-closed';
		modal.isActive = false;
	};

	function init() {
		container.appendChild(elem);

		document.addEventListener('keyup', function(e) {
			if (modal.isActive && e.key === "Escape") {
				modal.close();
			}
		});

		elem.addEventListener('click', function(e) {
			if (e.target == elem) {
				modal.close();
			}
		});

		modal.close();
	}

	init();
	return modal;
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
	var events = getEventPositions(e, elem, zoom);
	return events[0];
}

function getEventPositions(e, elem, zoom) {
	var events = [];

	if (!elem) {
		elem = touch.target;
	}

	if (!zoom) {
		zoom = 1;
	}

	var rect = elem.getBoundingClientRect();

	var getPosition = function(clientX, clientY) {
		var x = clientX - rect.x,
			y = clientY - rect.y;
		
		return { x: x * 1/zoom, y: y * 1/zoom };
	}

	if (e.type == 'touchstart' || e.type == 'touchmove' || e.type == 'touchend' || e.type == 'touchcancel') {
		var touch = e.touches[0] || e.changedTouches[0];

		// for (var i = 0; i < touches.length; ++i) {
		// 	var touch = touches[i];
		// 	events.push(getPosition(touch.clientX, touch.clientY));
		// }

		events.push(getPosition(touch.clientX, touch.clientY));
	} else {
		events.push(getPosition(e.clientX, e.clientY));
	}

	return events;
}

// https://github.com/pieroxy/lz-string/blob/master/libs/lz-string.min.js
var LZString=function(){function o(o,r){if(!t[o]){t[o]={};for(var n=0;n<o.length;n++)t[o][o.charAt(n)]=n}return t[o][r]}var r=String.fromCharCode,n="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",e="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$",t={},i={compressToBase64:function(o){if(null==o)return"";var r=i._compress(o,6,function(o){return n.charAt(o)});switch(r.length%4){default:case 0:return r;case 1:return r+"===";case 2:return r+"==";case 3:return r+"="}},decompressFromBase64:function(r){return null==r?"":""==r?null:i._decompress(r.length,32,function(e){return o(n,r.charAt(e))})},compressToUTF16:function(o){return null==o?"":i._compress(o,15,function(o){return r(o+32)})+" "},decompressFromUTF16:function(o){return null==o?"":""==o?null:i._decompress(o.length,16384,function(r){return o.charCodeAt(r)-32})},compressToUint8Array:function(o){for(var r=i.compress(o),n=new Uint8Array(2*r.length),e=0,t=r.length;t>e;e++){var s=r.charCodeAt(e);n[2*e]=s>>>8,n[2*e+1]=s%256}return n},decompressFromUint8Array:function(o){if(null===o||void 0===o)return i.decompress(o);for(var n=new Array(o.length/2),e=0,t=n.length;t>e;e++)n[e]=256*o[2*e]+o[2*e+1];var s=[];return n.forEach(function(o){s.push(r(o))}),i.decompress(s.join(""))},compressToEncodedURIComponent:function(o){return null==o?"":i._compress(o,6,function(o){return e.charAt(o)})},decompressFromEncodedURIComponent:function(r){return null==r?"":""==r?null:(r=r.replace(/ /g,"+"),i._decompress(r.length,32,function(n){return o(e,r.charAt(n))}))},compress:function(o){return i._compress(o,16,function(o){return r(o)})},_compress:function(o,r,n){if(null==o)return"";var e,t,i,s={},p={},u="",c="",a="",l=2,f=3,h=2,d=[],m=0,v=0;for(i=0;i<o.length;i+=1)if(u=o.charAt(i),Object.prototype.hasOwnProperty.call(s,u)||(s[u]=f++,p[u]=!0),c=a+u,Object.prototype.hasOwnProperty.call(s,c))a=c;else{if(Object.prototype.hasOwnProperty.call(p,a)){if(a.charCodeAt(0)<256){for(e=0;h>e;e++)m<<=1,v==r-1?(v=0,d.push(n(m)),m=0):v++;for(t=a.charCodeAt(0),e=0;8>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}else{for(t=1,e=0;h>e;e++)m=m<<1|t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t=0;for(t=a.charCodeAt(0),e=0;16>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}l--,0==l&&(l=Math.pow(2,h),h++),delete p[a]}else for(t=s[a],e=0;h>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1;l--,0==l&&(l=Math.pow(2,h),h++),s[c]=f++,a=String(u)}if(""!==a){if(Object.prototype.hasOwnProperty.call(p,a)){if(a.charCodeAt(0)<256){for(e=0;h>e;e++)m<<=1,v==r-1?(v=0,d.push(n(m)),m=0):v++;for(t=a.charCodeAt(0),e=0;8>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}else{for(t=1,e=0;h>e;e++)m=m<<1|t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t=0;for(t=a.charCodeAt(0),e=0;16>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}l--,0==l&&(l=Math.pow(2,h),h++),delete p[a]}else for(t=s[a],e=0;h>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1;l--,0==l&&(l=Math.pow(2,h),h++)}for(t=2,e=0;h>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1;for(;;){if(m<<=1,v==r-1){d.push(n(m));break}v++}return d.join("")},decompress:function(o){return null==o?"":""==o?null:i._decompress(o.length,32768,function(r){return o.charCodeAt(r)})},_decompress:function(o,n,e){var t,i,s,p,u,c,a,l,f=[],h=4,d=4,m=3,v="",w=[],A={val:e(0),position:n,index:1};for(i=0;3>i;i+=1)f[i]=i;for(p=0,c=Math.pow(2,2),a=1;a!=c;)u=A.val&A.position,A.position>>=1,0==A.position&&(A.position=n,A.val=e(A.index++)),p|=(u>0?1:0)*a,a<<=1;switch(t=p){case 0:for(p=0,c=Math.pow(2,8),a=1;a!=c;)u=A.val&A.position,A.position>>=1,0==A.position&&(A.position=n,A.val=e(A.index++)),p|=(u>0?1:0)*a,a<<=1;l=r(p);break;case 1:for(p=0,c=Math.pow(2,16),a=1;a!=c;)u=A.val&A.position,A.position>>=1,0==A.position&&(A.position=n,A.val=e(A.index++)),p|=(u>0?1:0)*a,a<<=1;l=r(p);break;case 2:return""}for(f[3]=l,s=l,w.push(l);;){if(A.index>o)return"";for(p=0,c=Math.pow(2,m),a=1;a!=c;)u=A.val&A.position,A.position>>=1,0==A.position&&(A.position=n,A.val=e(A.index++)),p|=(u>0?1:0)*a,a<<=1;switch(l=p){case 0:for(p=0,c=Math.pow(2,8),a=1;a!=c;)u=A.val&A.position,A.position>>=1,0==A.position&&(A.position=n,A.val=e(A.index++)),p|=(u>0?1:0)*a,a<<=1;f[d++]=r(p),l=d-1,h--;break;case 1:for(p=0,c=Math.pow(2,16),a=1;a!=c;)u=A.val&A.position,A.position>>=1,0==A.position&&(A.position=n,A.val=e(A.index++)),p|=(u>0?1:0)*a,a<<=1;f[d++]=r(p),l=d-1,h--;break;case 2:return w.join("")}if(0==h&&(h=Math.pow(2,m),m++),f[l])v=f[l];else{if(l!==d)return null;v=s+s.charAt(0)}w.push(v),f[d++]=s+v.charAt(0),h--,s=v,0==h&&(h=Math.pow(2,m),m++)}}};return i}();"function"==typeof define&&define.amd?define(function(){return LZString}):"undefined"!=typeof module&&null!=module&&(module.exports=LZString);
