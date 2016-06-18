'use strict';

var platform      = require('./platform'),
	isArray       = require('lodash.isarray'),
	isPlainObject = require('lodash.isplainobject'),
	async         = require('async'),
	server, port;

let sendData = function (data, callback) {
	async.each(server.clients, function (client, done) {
		client.send(JSON.stringify(data), function (error) {
			if (!error) {
				platform.log(JSON.stringify({
					title: `Data sent through Websocket Channel on port ${port}`,
					data: data
				}));
			}

			done(error);
		});
	}, callback);
};

platform.on('data', function (data) {
	if (isPlainObject(data)) {
		sendData(data, (error) => {
			if (error) return platform.handleException(error);
		});
	}
	else if (isArray(data)) {
		async.each(data, function (datum, done) {
			if (!isPlainObject(datum)) return done(new Error(`Invalid data received. Data must be a valid JSON Object or a collection of objects. Data: ${data}`));

			sendData(datum, done);
		}, (error) => {
			if (error) platform.handleException(error);
		});
	}
	else
		platform.handleException(new Error(`Invalid data received. Data must be a valid JSON Object or a collection of objects. Data: ${data}`));
});

platform.on('close', function () {
	let d = require('domain').create();

	d.once('error', function (error) {
		console.error(`Error closing Websockets Channel on port ${port}`, error);
		platform.handleException(error);
		platform.notifyClose();
		d.exit();
	});

	d.run(function () {
		server.close();
		console.log(`Websockets Channel closed on port ${port}`);
		platform.notifyClose();
		d.exit();
	});
});

platform.once('ready', function (options) {
	let config = require('./config.json');
	let WebSocketServer = require('ws').Server;

	let messageEvent = options.message_event || config.message_event.default;
	let groupMessageEvent = options.groupmessage_event || config.groupmessage_event.default;

	port = options.port;
	server = new WebSocketServer({
		port: options.port
	});

	server.on('error', function (error) {
		console.error(error);
		platform.handleException(error);
	});

	server.on('connection', function (socket) {
		socket.on('error', function (error) {
			console.error(error);
			platform.handleException(error);
		});

		socket.on('message', function (data) {
			async.waterfall([
				async.constant(data || '{}'),
				async.asyncify(JSON.parse)
			], (error, obj) => {
				if (error) return platform.handleException(error);

				if (obj.type === messageEvent) {
					platform.sendMessageToDevice(obj.target, obj.message, (error) => {
						if (error) platform.handleException(error);
					});
				}
				else if (obj.type === groupMessageEvent) {
					platform.sendMessageToGroup(obj.target, obj.message, (error) => {
						if (error) platform.handleException(error);
					});
				}
			});
		});
	});

	platform.log(`Websockets Channel initialized on port ${port}`);
	platform.notifyReady();
});
