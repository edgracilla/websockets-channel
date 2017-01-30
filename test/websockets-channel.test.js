/* global describe, it, after, before */
'use strict'


const async = require('async')
const cp = require('child_process')
const isEmpty = require('lodash.isempty')
const should = require('should')
const amqp = require('amqplib')
const WebSocket = require('ws')

let wsChannel = null
let _channel = null
let _conn = null

describe('WS Channel', () => {

  before('init', () => {
    process.env.PORT = 8081
    process.env.INPUT_PIPE = 'demo.pipe.channel'
    process.env.BROKER = 'amqp://guest:guest@127.0.0.1/'

    amqp.connect(process.env.BROKER)
      .then((conn) => {
        _conn = conn
        return conn.createChannel()
      }).then((channel) => {
        _channel = channel
      }).catch((err) => {
        console.log(err)
      })

  })

  after('terminate child process', function () {
    this.timeout(5000)

    setTimeout(() => {
      _conn.close()
      wsChannel.kill('SIGKILL')
    }, 4500)
  })

  describe('#spawn', () => {
    it('should spawn a child process', () => {
      should.ok(wsChannel = cp.fork(process.cwd()), 'Child process not spawned.')
    })
  })

  describe('#handShake', function () {
    it('should notify the parent process when ready within 8 seconds', (done) => {
      this.timeout(8000)

      wsChannel.on('message', (msg) => {
        if (msg.type === 'ready') done()
      })

      wsChannel.send({ type: 'ready' }, (error) => {
        should.ifError(error)
      })
    })
  })

  describe('#data', function () {
    it('should be able to serve a client and exchange data', (done) => {
      this.timeout(5000)

      let url = 'http://127.0.0.1:' + process.env.PORT
      let ws = new WebSocket(url)

      ws.on('message', (data) => {
        data = JSON.parse(data)

        should.equal(data.key1, 'value1')
        should.equal(data.key2, 121)
        should.equal(data.key3, 40)

        done()
      })

      let dummyData = {
        key1: 'value1',
        key2: 121,
        key3: 40
      }

      _channel.sendToQueue(process.env.INPUT_PIPE, new Buffer(JSON.stringify(dummyData)))

    })
  })

  describe('#message', function () {
    it('should be able to receive correct messages', function (done) {
      this.timeout(5000)

      // -- test data

      let dummyData = {
        type: 'message',
        devices: '527981789267421',
        deviceTypes: '527981789267421',
        message: 'ACTIVATE'
      }

      // -- set msg queue listener

      let processTask = (msg) => {
        if (!isEmpty(msg)) {
          async.waterfall([
            async.constant(msg.content.toString('utf8')),
            async.asyncify(JSON.parse)
          ], (err, parsed) => {
            should.equal(parsed.devices, '527981789267421')
            should.equal(parsed.deviceTypes, '527981789267421')
            should.equal(parsed.message, 'ACTIVATE')
            done(err)
          })
        }
      }

      let ret = _channel.consume('agent.messages', (msg) => {
        if (!msg) return
        processTask(msg)
        _channel.ack(msg)
      })

      ret.then(() => {
        // noop
      }).catch((err) => {
        should.ifError(err)
      })

      // -- send command to plugin. should be catch by listener above

      let url = 'http://127.0.0.1:' + process.env.PORT
      let ws = new WebSocket(url)

      ws.on('open', function () {
        ws.send(JSON.stringify(dummyData))
      })

    })
  })

})
