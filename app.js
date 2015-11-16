'use strict';


var domain   = require('domain'),
	platform = require('./platform'),
	server, port;

/*
 * Listen for the data event.
 */
platform.on('data', function (data) {
	var async = require('async');

	async.each(server.clients, function (client, callback) {
		var d = domain.create();

		d.once('error', function (error) {
			console.error('Error sending data', error);
			platform.handleException(error);
			callback();
		});

		d.run(function () {
			client.send(JSON.stringify(data), function (error) {
				if (error)
					platform.handleException(error);
				else {
					platform.log(JSON.stringify({
						title: 'Data sent through Websocket Channel on port ' + port,
						data: data
					}));
				}

				callback();
				d.exit();
			});
		});
	});
});

/*
 * Event to listen to in order to gracefully release all resources bound to this service.
 */
platform.on('close', function () {
	var d = domain.create();

	d.once('error', function (error) {
		console.error('Error closing Websockets Channel on port ' + port, error);
		platform.handleException(error);
		platform.notifyClose();
	});

	d.run(function () {
		server.close();
		console.log('Websockets Channel closed on port ' + port);
		platform.notifyClose();
		d.exit();
	});
});

/*
 * Listen for the ready event.
 */
platform.once('ready', function (options) {
	var config = require('./config.json');
	var WebSocketServer = require('ws').Server;

	var messageEvent = options.message_event || config.message_event.default;
	var groupMessageEvent = options.groupmessage_event || config.groupmessage_event.default;

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
			var d = domain.create();

			d.once('error', function (error) {
				console.error('Error on message data', error);
				platform.handleException(error);
			});

			d.run(function () {
				data = JSON.parse(data);

				if (data.type === messageEvent)
					platform.sendMessageToDevice(data.target, data.message);
				else if (data.type === groupMessageEvent)
					platform.sendMessageToGroup(data.target, data.message);

				d.exit();
			});
		});
	});

	platform.log('Websockets Channel initialized on port ' + port);
	platform.notifyReady();
});
