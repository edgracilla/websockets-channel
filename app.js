'use strict'

const ws = require('ws')
const async = require('async')
const reekoh = require('reekoh')
const isArray = require('lodash.isarray')
const isPlainObject = require('lodash.isplainobject')

let server = null
let plugin = new reekoh.plugins.Channel()

let sendData = (data, callback) => {
  async.each(server.clients, (client, done) => {
    client.send(JSON.stringify(data), (error) => {
      if (!error) {
        plugin.log(JSON.stringify({
          title: `Data sent through Websocket Channel on port ${plugin.port}`,
          data: data
        }))
      }
      done(error)
    })
  }, callback)
}

plugin.on('data', (data) => {
  if (isPlainObject(data)) {
    sendData(data, (error) => {
      if (error) return plugin.logException(error)
    })
  } else if (isArray(data)) {
    async.each(data, (datum, done) => {
      if (!isPlainObject(datum)) return done(new Error(`Invalid data received. Data must be a valid JSON Object or a collection of objects. Data: ${data}`))

      sendData(datum, done)
    }, (error) => {
      if (error) plugin.logException(error)
    })
  } else {
    plugin.logException(new Error(`Invalid data received. Data must be a valid JSON Object or a collection of objects. Data: ${data}`))
  }
})

plugin.on('ready', () => {
  server = new ws.Server({ port: plugin.port })

  server.on('error', (err) => {
    plugin.logException(err)
    console.error(err)
  })

  server.on('connection', (socket) => {
    socket.on('error', (err) => {
      plugin.logException(err)
      console.error(err)
    })

    socket.on('message', (data) => {
      async.waterfall([
        async.constant(data || '{}'),
        async.asyncify(JSON.parse)
      ], (err, obj) => {
        if (err) return plugin.logException(err)

        if (obj.type === 'message') {
          plugin.relayCommand(obj.command, obj.devices, obj.deviceGroups).catch((err) => {
            if (err) plugin.logException(err)
          })
        }
      })
    })
  })

  plugin.log('Channel has been initialized on port ' + plugin.port)
  plugin.emit('init')
})

module.exports = plugin

