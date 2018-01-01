const errors = require('./errors')
const crypto = require('crypto')
const EventEmitter = require('events').EventEmitter
const request = require('request-promise')
const url = require('url')
const http = require('http')
const https = require('https')
const qs = require('querystring')
const Promise = require('bluebird')
const isAbsoluteUrl = require('is-absolute-url')
const parseLinkHeader = require('parse-link-header')

/**
 * Twitch Webhook API
 */
class TwitchWebhook extends EventEmitter {
  /**
   * Constructs an instance of TwitchWebHookAPI
   *
   * @param {Object} options - Options
   * @param {string} options.client_id - Client ID required for Twitch API calls
   * @param {string} options.callback - URL where notifications
   * will be delivered.
   * @param {string} [options.secret] - Secret used to sign
   * notification payloads.
   * @param {number} [options.lease_seconds] - Number of seconds until
   * the subscription expires.
   * @param {boolean|Object} [options.listen] - Listen options
   * @param {string} [options.listen.autoStart=true] - Should automaticaly starts listening
   * @param {string} [options.listen.host="0.0.0.0"] - Host to bind to
   * @param {number} [options.listen.port=8443] - Port to bind to
   * @param {boolean|Object} [options.https=false] - Should use https connection.
   * If yes, these options to be passed to `https.createServer()`.
   * @param {string} [options.baseApiUrl="https://api.twitch.tv/helix/"] - Base Twitch API URL. Needed proxying and testing
   */
  constructor (options = {}) {
    if (!options.client_id) {
      throw new errors.FatalError('Twitch Client ID not provided!')
    }

    if (!options.callback) {
      throw new errors.FatalError('Callback URL not provided!')
    }

    super()

    this._options = options
    if (this._options.lease_seconds === undefined) {
      this._options.lease_seconds = 864000
    }

    this._options.listen = options.listen || {}
    this._options.listen.host = options.listen.host || '0.0.0.0'
    this._options.listen.port = options.listen.port || 8443

    this._options.https = options.https || {}

    this._apiUrl = options.baseApiUrl || 'https://api.twitch.tv/helix/'
    this._hubUrl = this._apiUrl + 'webhooks/hub'

    this._secrets = {}

    if (Object.keys(options.https).length) {
      this._server = https.createServer(
        options.https,
        this._requestListener.bind(this)
      )
    } else {
      this._server = http.createServer(this._requestListener.bind(this))
    }

    this._server.on('error', this.emit.bind(this, 'error'))
    this._server.on('listening', this.emit.bind(this, 'listening'))

    if (options.listen.autoStart === undefined || options.listen.autoStart) {
      this.listen()
    }
  }

  /**
   * Start listening for connections
   *
   * @param {...any} [args] - Arguments
   * @throws {Promise<FatalError>} If listening is already started
   * @return {Promise}
   */
  listen (...args) {
    if (this.isListening()) {
      return Promise.reject(new errors.FatalError('Listening is already started'))
    }

    return new Promise(resolve => {
      if (!args.length) {
        this._server.listen(
          this._options.listen.port,
          this._options.listen.host,
          () => resolve()
        )
      } else {
        this._server.listen(...args, () => resolve())
      }
    })
  }

  /**
   * Stop listening for connections
   *
   * @return {Promise}
   */
  close () {
    if (!this.isListening()) {
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      this._server.close(err => {
        if (err) {
          return reject(err)
        }

        return resolve()
      })
    })
  }

  /**
   * Check if server is listening for connections.
   *
   * @return {boolean}
   */
  isListening () {
    return this._server.listening
  }

  /**
   * Make request
   *
   * @private
   * @param {string} mode - URL for the topic to subscribe to or
   * unsubscribe from.
   * @param {string} topic - Topic name
   * @param {Object} options - Topic options
   * @throws {Promise<RequestDenied>} If the hub finds any errors in the request
   * @return {Promise}
   */
  _request (mode, topic, options) {
    if (!isAbsoluteUrl(topic)) {
      topic = this._apiUrl + topic
    }
    if (Object.keys(options).length) {
      topic += '?' + qs.stringify(options)
    }

    let requestOptions = {}
    requestOptions.url = this._hubUrl
    requestOptions.headers = {
      'Client-ID': this._options.client_id
    }
    requestOptions.qs = {
      'hub.callback': this._options.callback,
      'hub.mode': mode,
      'hub.topic': topic,
      'hub.lease_seconds': this._options.lease_seconds
    }
    requestOptions.resolveWithFullResponse = true
    if (this._options.secret) {
      let secret = crypto
        .createHmac('sha256', this._options.secret)
        .update(topic)
        .digest('hex')

      requestOptions.qs['hub.secret'] = secret
    }

    return request
      .post(requestOptions)
      .catch(err => {
        throw new errors.RequestDenied(err)
      })
      .then(response => {
        if (this._options.secret) {
          this._secrets[topic] = requestOptions.qs['hub.secret']
        }
      })
  }

  /**
   * Subscribe to specific topic
   *
   * @param {string} topic - Topic name
   * @param {Object} options - Topic options
   * @throws {RequestDenied} If hub finds any errors in the request
   * @return {Promise}
   */
  subscribe (topic, options = {}) {
    return this._request('subscribe', topic, options)
  }

  /**
   * Unsubscribe from specific topic
   *
   * @param {string} topic - Topic name
   * @throws {RequestDenied} If hub finds any errors in the request
   * @return {Promise}
   */
  unsubscribe (topic, options = {}) {
    return this._request('unsubscribe', topic, options)
  }

  /**
   * Return errors
   */
  get errors () {
    return errors
  }

  /**
   * Process connection updates
   *
   * @private
   * @param {Object} request - Request
   * @param {Object} response - Response
   */
  _processConnection (request, response) {
    const queries = url.parse(request.url, true).query

    switch (queries['hub.mode']) {
      case 'denied':
        response.writeHead(200, { 'Content-Type': 'text/plain' })
        response.end()

        this.emit('denied', queries)
        break
      case 'unsubscribe':
        delete this._secrets[queries['hub.topic']] // Yes, it's needed by design
      case "subscribe": // eslint-disable-line
        response.writeHead(200, { 'Content-Type': 'text/plain' })
        response.end(queries['hub.challenge'])

        this.emit(queries['hub.mode'], queries)
        break
      default:
        response.writeHead(400, { 'Content-Type': 'text/plain' })
        response.end()
    }
  }

  /**
   * Fix fields with date
   *
   * @private
   * @param {string} topic - Topic name
   * @param {Object} data - Request data
   * @return {Object}
   */
  _fixDate (topic, data) {
    switch (topic) {
      case 'users/follows':
        data.timestamp = new Date(data.timestamp)
        break
      case 'streams':
        for (let stream of data.data) {
          stream.started_at = new Date(stream.started_at)
        }
        break
    }

    return data
  }

  /**
   * Process updates
   *
   * @private
   * @param {Object} request - Request
   * @param {Object} response - Response
   */
  _processUpdates (request, response) {
    const links = parseLinkHeader(request.headers.link)
    const endpoint = links && links.self && links.self.url
    const topic = endpoint && url.parse(endpoint, true).pathname.replace('/helix/', '')
    if (!endpoint || !topic) {
      response.writeHead(202, { 'Content-Type': 'text/plain' })
      response.end()
      return
    }

    let signature
    if (this._options.secret) {
      signature =
        request.headers['x-hub-signature'] &&
        request.headers['x-hub-signature'].split('=')[1]

      if (!signature) {
        response.writeHead(202, { 'Content-Type': 'text/plain' })
        response.end()
        return
      }
    }

    let body = ''
    request.on('data', data => {
      body += data

      // Too much data, destroy the connection
      if (body.length > 1e6) {
        body = ''
        response.writeHead(202, { 'Content-Type': 'text/plain' })
        response.end()
        request.connection.destroy()
      }
    })

    request.on('end', () => {
      let data
      try {
        data = JSON.parse(body)
      } catch (err) {
        response.writeHead(202, { 'Content-Type': 'text/plain' })
        response.end()
        return
      }

      if (this._options.secret) {
        let storedSign
        if (this._secrets[endpoint]) {
          storedSign = crypto
            .createHmac('sha256', this._secrets[endpoint])
            .update(body)
            .digest('hex')
        }

        if (storedSign !== signature) {
          response.writeHead(202, { 'Content-Type': 'text/plain' })
          response.end()
          return
        }
      }

      response.writeHead(200, { 'Content-Type': 'text/plain' })
      response.end()

      let payload = {}
      payload.topic = topic
      payload.endpoint = endpoint
      payload.event = this._fixDate(topic, data)

      this.emit(topic, payload)
      this.emit('*', payload)
    })
  }

  /**
   * Request listener
   *
   * @private
   * @param {Object} request - Request
   * @param {Object} response - Response
   */
  _requestListener (request, response) {
    switch (request.method) {
      case 'GET':
        this._processConnection(request, response)
        break
      case 'POST':
        this._processUpdates(request, response)
        break
      default:
        response.writeHead(405, { 'Content-Type': 'text/plain' })
        response.end()
    }
  }
}

module.exports = TwitchWebhook
