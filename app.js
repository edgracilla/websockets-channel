'use strict'

const ws = require('ws')
const async = require('async')
const reekoh = require('reekoh')
const isArray = require('lodash.isarray')
const isPlainObject = require('lodash.isplainobject')

let _server = null
let _plugin = new reekoh.plugins.Channel()

let sendData = (data, callback) => {
  async.each(_server.clients, (client, done) => {
    client.send(JSON.stringify(data), (error) => {
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
      if (error) return _plugin.logException(error)
    })
  } else if (isArray(data)) {
    async.each(data, (datum, done) => {
      if (!isPlainObject(datum)) return done(new Error(`Invalid data received. Data must be a valid JSON Object or a collection of objects. Data: ${data}`))

      sendData(datum, done)
    }, (error) => {
      if (error) _plugin.logException(error)
    })
  } else {
    _plugin.logException(new Error(`Invalid data received. Data must be a valid JSON Object or a collection of objects. Data: ${data}`))
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
      _plugin.logException(err)
      console.error(err)
    })

    socket.on('message', (data) => {
      async.waterfall([
        async.constant(data || '{}'),
        async.asyncify(JSON.parse)
      ], (err, obj) => {
        if (err) return _plugin.logException(err)

        if (obj.type === 'message') {
          _plugin.relayCommand(obj.command, obj.devices, obj.deviceGroups).catch((err) => {
            if (err) _plugin.logException(err)
          })
        }
      })
    })
  })

  _plugin.log('Channel has been initialized on port ' + _plugin.port)
  process.send({ type: 'ready' })
})

