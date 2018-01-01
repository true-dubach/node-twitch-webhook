const assert = require('assert')
const request = require('request-promise')
const errors = require('request-promise/errors')

function sendRequest (requestOptions) {
  requestOptions.resolveWithFullResponse = true
  requestOptions.simple = false

  return request(requestOptions);
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
      if (status == false) {
        throw new Error('cannot start listening if "autoStart" is false')
      }
    })
}

module.exports = {
  sendRequest,
  checkResponseCode,
  hasStartedListening,
  hasStoppedListening
}
