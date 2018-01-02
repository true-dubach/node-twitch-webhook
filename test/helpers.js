const assert = require('assert')
const http = require('http')
const request = require('request-promise')
const errors = require('request-promise/errors')

function sendRequest (requestOptions) {
  requestOptions.resolveWithFullResponse = true
  requestOptions.simple = false

  return request(requestOptions)
}

function checkResponseCode (requestOptions, requiredCode) {
  return sendRequest(requestOptions).then(response => {
    assert.equal(
      response.statusCode,
      requiredCode,
      `unexpected status code: ${response.statusCode}`
    )

    return response
  })
}

function hasStartedListening (url) {
  return request.get(url).catch(response => {
    if (!response.statusCode || response.statusCode >= 500) {
      throw new Error('listening was not started')
    }
  })
}

function hasStoppedListening (url) {
  return request
    .get(url)
    .then(() => false)
    .catch(response => response.error instanceof errors.RequestError)
    .finally(status => {
      if (status === false) {
        throw new Error('cannot start listening if "autoStart" is false')
      }
    })
}

let requests = []
function startMockedServer (port) {
  const server = http.createServer((request, response) => {
    requests.push(request.url)
    response.writeHead(202, { 'Content-Type': 'text/plain' })
    response.end()
  })
  server.unref()

  return new Promise((resolve, reject) => {
    server.on('error', reject).listen(port, resolve)
  })
}

function checkRequestToMockedServer (callback) {
  if (requests.findIndex(callback) === -1) {
    throw new Error('request does not exist')
  }
}

module.exports = {
  sendRequest,
  checkResponseCode,
  hasStartedListening,
  hasStoppedListening,
  startMockedServer,
  checkRequestToMockedServer
}
