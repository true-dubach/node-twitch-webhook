'use strict'

/**
 * Base error
 *
 * @extends Error
 */
class BaseError extends Error {}

/**
 * Library error
 *
 * @extends BaseError
 */
class FatalError extends BaseError {
  /**
   * Constructs an instance of FatalError
   *
   * @param {string|Error} error - Error or error message
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

/**
 * Access error
 *
 * @extends FatalError
 */
class RequestDenied extends FatalError {
  /**
   * Constructs an instance of RequestDenied
   *
   * @param {Object} response - Response
   */
  constructor (response) {
    super(response)

    this.response = response
  }
}

/**
 * Webhook error
 *
 * @extends BaseError
 */
class WebhookError extends BaseError {
  /**
   * Constructs an instance of FatalError
   *
   * @param {string} message - Error message
   */
  constructor (message) {
    super(message)
    Error.captureStackTrace(this)
  }
}

module.exports = {
  BaseError,
  FatalError,
  RequestDenied,
  WebhookError
}
