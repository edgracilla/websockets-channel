/* global describe, it, after, before */
'use strict'

const async = require('async')
const amqp = require('amqplib')
const WebSocket = require('ws')
const should = require('should')

const isEmpty = require('lodash.isempty')

const PORT = 8081
const PLUGIN_ID = 'demo.channel'
const INPUT_PIPE = 'demo.pipe.channel'
const COMMAND_RELAYS = 'demo.channel.cmd.relay'
const BROKER = 'amqp://guest:guest@127.0.0.1/'

let _app = null
let _conn = null
let _channel = null

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

  after('terminate', function () {
    _conn.close()
  })

  describe('#start', function () {
    it('should start the app', function (done) {
      this.timeout(10000)
      _app = require('../app')
      _app.once('init', done)
    })
  })

  describe('#data', function () {
    it('should be able to serve a client and exchange data', (done) => {
      this.timeout(8000)

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
    it('should be able to receive correct command', function (done) {
      this.timeout(10000)

      // -- set msg queue listener
      _channel.consume(COMMAND_RELAYS, (msg) => {
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
        _channel.ack(msg)
      }).catch((err) => {
        should.ifError(err)
      })

      // -- send command to plugin. should be catch by listener above

      let url = 'http://127.0.0.1:' + PORT
      let ws = new WebSocket(url)

      ws.on('open', function () {
        ws.send(JSON.stringify({
          type: 'message',
          devices: '527981789267421',
          deviceGroups: '527981789267421',
          command: 'ACTIVATE'
        }))
      })
    })
  })
})
