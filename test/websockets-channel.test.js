/* global describe, it, after, before */
'use strict'

const async = require('async')
const amqp = require('amqplib')
const WebSocket = require('ws')
const should = require('should')
const cp = require('child_process')
const isEmpty = require('lodash.isempty')

const PORT = 8081
const PLUGIN_ID = 'demo.channel'
const INPUT_PIPE = 'demo.pipe.channel'
const COMMAND_RELAYS = 'demo.channel.cmd.relay'
const BROKER = 'amqp://guest:guest@127.0.0.1/'

let _plugin = null
let _channel = null
let _conn = null

describe('Websocket Channel', () => {
  before('init', () => {
    process.env.PORT = PORT
    process.env.BROKER = BROKER
    process.env.PLUGIN_ID = PLUGIN_ID
    process.env.INPUT_PIPE = INPUT_PIPE
    process.env.COMMAND_RELAYS = COMMAND_RELAYS

    amqp.connect(BROKER).then((conn) => {
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
    _conn.close()
    setTimeout(() => {
      _plugin.kill('SIGKILL')
    }, 4500)
  })

  describe('#spawn', () => {
    it('should spawn a child process', () => {
      should.ok(_plugin = cp.fork(process.cwd()), 'Child process not spawned.')
    })
  })

  describe('#handShake', function () {
    it('should notify the parent process when ready within 8 seconds', (done) => {
      this.timeout(8000)

      _plugin.on('message', (msg) => {
        if (msg.type === 'ready') done()
      })

      _plugin.send({ type: 'ready' }, (error) => {
        should.ifError(error)
      })
    })
  })

  describe('#data', function () {
    it('should be able to serve a client and exchange data', (done) => {
      this.timeout(5000)

      let url = 'http://127.0.0.1:' + PORT
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

      _channel.sendToQueue(INPUT_PIPE, new Buffer(JSON.stringify(dummyData)))
    })
  })

  describe('#message', function () {
    it('should be able to receive correct messages', function (done) {
      this.timeout(10000)

      // -- test data

      let dummyData = {
        type: 'message',
        devices: '527981789267421',
        deviceGroups: '527981789267421',
        command: 'ACTIVATE'
      }

      // -- set msg queue listener

      let processTask = (msg) => {
        if (!isEmpty(msg)) {
          async.waterfall([
            async.constant(msg.content.toString('utf8')),
            async.asyncify(JSON.parse)
          ], (err, parsed) => {
            should.equal(parsed.devices, '527981789267421')
            should.equal(parsed.deviceGroups, '527981789267421')
            should.equal(parsed.command, 'ACTIVATE')
            done(err)
          })
        }
      }

      let ret = _channel.consume(COMMAND_RELAYS, (msg) => {
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

      let url = 'http://127.0.0.1:' + PORT
      let ws = new WebSocket(url)

      ws.on('open', function () {
        ws.send(JSON.stringify(dummyData))
      })
    })
  })
})
