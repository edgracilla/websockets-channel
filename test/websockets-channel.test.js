'use strict';

const PORT = 8080;

var cp        = require('child_process'),
	should    = require('should'),
	WebSocket = require('ws'),
	wsChannel;

describe('WS Channel', function () {
	this.slow(8000);

	after('terminate child process', function () {
		this.timeout(5000);

		wsChannel.send({
			type: 'close'
		});

		setTimeout(function () {
			wsChannel.kill('SIGKILL');
		}, 4500);
	});

	describe('#spawn', function () {
		it('should spawn a child process', function () {
			should.ok(wsChannel = cp.fork(process.cwd()), 'Child process not spawned.');
		});
	});

	describe('#handShake', function () {
		it('should notify the parent process when ready within 8 seconds', function (done) {
			this.timeout(8000);

			wsChannel.on('message', function (message) {
				if (message.type === 'ready')
					done();
			});

			wsChannel.send({
				type: 'ready',
				data: {
					options: {
						port: PORT
					}
				}
			}, function (error) {
				should.ifError(error);
			});
		});
	});

	describe('#data', function () {
		it('should be able to serve a client and exchange data', function (done) {
			this.timeout(5000);

			var url = 'http://127.0.0.1:' + PORT;
			var ws = new WebSocket(url);

			ws.on('message', function (data) {
				data = JSON.parse(data);

				should.equal(data.key1, 'value1');
				should.equal(data.key2, 121);
				should.equal(data.key3, 40);

				done();
			});

			setTimeout(function () {
				wsChannel.send({
					type: 'data',
					data: {
						key1: 'value1',
						key2: 121,
						key3: 40
					}
				}, function (error) {
					should.ifError(error);
				});
			}, 2000);
		});
	});

	describe('#message', function () {
		it('should be able to receive messages', function (done) {
			this.timeout(5000);

			var url = 'http://127.0.0.1:' + PORT;
			var ws = new WebSocket(url);

			ws.on('open', function () {
				ws.send(JSON.stringify({
					type: 'message',
					target: '527981789267421',
					message: 'ACTIVATE'
				}));
			});

			setTimeout(function () {
				done();
			}, 1000);
		});
	});

	// TODO: Tests for messaging
});