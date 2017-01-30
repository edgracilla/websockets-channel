'use strict'

let ws = require('ws')
let async = require('async')
let isArray = require('lodash.isarray')
let reekoh = require('demo-reekoh-node')
let isPlainObject = require('lodash.isplainobject')

let _plugin = new reekoh.plugins.Channel()
let _server = {}

let notifyReady = () => {
  setImmediate(() => {
    process.send({ type: 'ready' })
  })
}

let sendData = function (data, callback) {
  async.each(_server.clients, function (client, done) {
    client.send(JSON.stringify(data), function (error) {
      if (!error) {
        _plugin.log(JSON.stringify({
          title: `Data sent through Websocket Channel on port ${_plugin.port}`,
          data: data
        }))
      }
      done(error)
    })
  }, callback)
}

_plugin.on('data', (data) => {

  if (isPlainObject(data)) {
    sendData(data, (error) => {
      if (error) return _plugin.handleException(error)
    })
  } else if (isArray(data)) {
    async.each(data, function (datum, done) {
      if (!isPlainObject(datum)) return done(new Error(`Invalid data received. Data must be a valid JSON Object or a collection of objects. Data: ${data}`))

      sendData(datum, done)
    }, (error) => {
      if (error) _plugin.handleException(error)
    })
  } else {
    _plugin.handleException(new Error(`Invalid data received. Data must be a valid JSON Object or a collection of objects. Data: ${data}`))
  }
})

_plugin.on('ready', () => {

  _server = new ws.Server({ port: _plugin.port })

  _server.on('error', (err) => {
    _plugin.logException(err)
    console.error(err)
  })

  _server.on('connection', (socket) => {

    socket.on('error', (err) => {
      _plugin.handleException(err)
      console.error(err)
    })

    socket.on('message', (data) => {
      async.waterfall([
        async.constant(data || '{}'),
        async.asyncify(JSON.parse)
      ], (err, obj) => {
        if (err) return _plugin.handleException(err)

        if (obj.type === 'message') {
          _plugin.relayMessage(obj.message, obj.deviceTypes, obj.devices)
            .catch((err) => {
              if (err) _plugin.handleException(err)
            })
        }
      })
    })
  })

  _plugin.log('Channel has been initialized on port ' + _plugin.port)
  notifyReady()
})

