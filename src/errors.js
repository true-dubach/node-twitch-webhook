'use strict'

class FatalError extends Error {
  /**
   *
   * @param {string|Error} error
   */
  constructor (error) {
    if (error instanceof Error) {
      super(error.message)
      this.stack = error.stack
    } else {
      super(error)
      Error.captureStackTrace(this)
    }
  }
}

class RequestDenied extends FatalError {
  /**
   *
   * @param {Object} response
   */
  constructor (response) {
    super(`Invalid response status code ${response.statusCode}`)

    this.response = response
  }
}

module.exports = {
  FatalError,
  RequestDenied
}
