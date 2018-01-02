const TwitchWebhook = require('../src/index')
const errors = require('../src/errors')
const helpers = require('./helpers')
const assert = require('assert')
const Promise = require('bluebird')
const crypto = require('crypto')
const url = require('url')
const path = require('path')
const fs = require('fs')

const clientId = process.env.CLIENT_ID

if (!clientId) {
  throw new Error('Twitch Client ID not provided')
}

let callback = process.env.CALLBACK || 'https://216.58.210.174/' // Google IP ¯\_(ツ)_/¯
if (callback.substr(-1) !== '/') { // for full coverage ¯\_(ツ)_/¯
  callback += '/'
};

let defaultPort = process.env.PORT || 9108
const webhookPort = defaultPort++
const testPort = defaultPort++
const securePort = defaultPort++
const apiPort = defaultPort++
const offlinePort = defaultPort++
const timeout = 10 * 1000
const secret = 'test secret :)'

describe('TwitchWebhook', () => {
  let twitchWebhook
  let testWebhook
  let secureWebhook
  let offlineWebhook

  before(() => {
    twitchWebhook = new TwitchWebhook({
      client_id: clientId,
      callback,
      listen: {
        host: '127.0.0.1',
        port: webhookPort
      },
      lease_seconds: 0
    })

    offlineWebhook = new TwitchWebhook({
      client_id: clientId,
      callback,
      listen: {
        host: '127.0.0.1',
        port: offlinePort,
        autoStart: false
      },
      lease_seconds: 0
    })
  })

  before(() => {
    return helpers.startMockedServer(apiPort)
      .then(() => {
        testWebhook = new TwitchWebhook({
          client_id: clientId,
          callback,
          listen: {
            host: '127.0.0.1',
            port: testPort
          },
          baseApiUrl: `http://127.0.0.1:${apiPort}/`
        })

        secureWebhook = new TwitchWebhook({
          client_id: clientId,
          callback,
          secret,
          listen: {
            host: '127.0.0.1',
            port: securePort
          },
          baseApiUrl: `http://127.0.0.1:${apiPort}/`
        })
      })
  })

  it('should contain errors', (done) => {
    assert(twitchWebhook.errors instanceof Object)
    assert(twitchWebhook.errors.FatalError === errors.FatalError)
    assert(twitchWebhook.errors.RequestDenied === errors.RequestDenied)
    done()
  })

  it('should throw FatalError if the Twitch Client ID is not provided', (done) => {
    try {
      new TwitchWebhook({ // eslint-disable-line no-new
        listen: false
      })
      done(new Error('expected error'))
    } catch (err) {
      assert(err instanceof errors.FatalError)
      assert(err.message === 'Twitch Client ID not provided!')
      done()
    }
  })

  it('should throw FatalError if the Callback URL is not provided', (done) => {
    try {
      new TwitchWebhook({ // eslint-disable-line no-new
        client_id: clientId,
        listen: false
      })
      done(new Error('expected error'))
    } catch (err) {
      assert(err instanceof errors.FatalError)
      assert(err.message === 'Callback URL not provided!')
      done()
    }
  })

  it('should automaticaly start listening by default', () => {
    assert(twitchWebhook.isListening())
    return helpers.hasStartedListening(`http://127.0.0.1:${webhookPort}`)
  })

  it('should not automaticaly start listening if "autoStart" is false', () => {
    assert(offlineWebhook.isListening() === false)
    return helpers.hasStoppedListening(`http://127.0.0.1:${offlinePort}`)
  })

  it('should set "host" and "post" if one of them is undefined', (done) => {
    const tempWebhook = new TwitchWebhook({
      client_id: clientId,
      callback,
      lease_seconds: 0
    })

    tempWebhook.on('listening', () => {
      helpers.hasStartedListening(`http://0.0.0.0:8443/`)
      .then(() => done())
      .catch(done)
      .finally(() => tempWebhook.close())
    })
  })

  it('should add trailing slash to base url of api if it does not exist', () => {
    const tempWebhook = new TwitchWebhook({
      client_id: clientId,
      callback,
      baseApiUrl: `http://127.0.0.1:${apiPort}`
    })

    tempWebhook.subscribe('test')
      .catch((err) => {
        throw new Error('unexpected error in #subscribe: ' + err.message)
      })
      .then(() => {
        helpers.checkRequestToMockedServer((element) => {
          const params = url.parse(element, true).query
          return params['hub.topic'] === `http://127.0.0.1:${apiPort}/test`
        })
      })
      .finally(() => tempWebhook.close())
  })

  it('should add trailing slash to callback if it does not exist', () => {
    const tempWebhook = new TwitchWebhook({
      client_id: clientId,
      callback: `http://127.0.0.1:${offlinePort}`,
      baseApiUrl: `http://127.0.0.1:${apiPort}`
    })

    tempWebhook.subscribe('test')
      .catch((err) => {
        throw new Error('unexpected error in #subscribe: ' + err.message)
      })
      .then(() => {
        helpers.checkRequestToMockedServer((element) => {
          const params = url.parse(element, true).query
          return params['hub.callback'] === `http://127.0.0.1:${offlinePort}/`
        })
      })
      .finally(() => tempWebhook.close())
  })

  it('should create https server if "https" is defined', () => {
    const key = fs.readFileSync(path.resolve('test/cert/key.pem'))
    const cert = fs.readFileSync(path.resolve('test/cert/cert.pem'))

    const httpsWebhook = new TwitchWebhook({
      client_id: clientId,
      callback,
      listen: {
        host: '127.0.0.1',
        port: offlinePort
      },
      lease_seconds: 0,
      https: {
        key,
        cert
      }
    })

    return helpers.checkResponseCode(
      {
        url: `https://127.0.0.1:${offlinePort}`,
        strictSSL: false
      },
      400
    ).finally(() => httpsWebhook.close())
  })

  describe('webhook', () => {
    describe('GET method', () => {
      it('returns 400 error code if the request is malformed', () => {
        return helpers.checkResponseCode(
          {
            url: `http://127.0.0.1:${testPort}`
          },
          400
        )
      })

      it('returns 200 response code if "hub.mode" query is "denied"', () => {
        return helpers.checkResponseCode(
          {
            url: `http://127.0.0.1:${testPort}`,
            qs: {
              'hub.mode': 'denied'
            }
          },
          200
        )
      })

      it('returns 200 response code and "hub.challenge" if "hub.mode" query is "subscribe" or "unsubscribe"', () => {
        const modes = ['subscribe', 'unsubscribe']
        const challenge = 'HzSGH_h04Cgl6VbDJm7IyXSNSlrhaLvBi9eft3bw'

        return Promise.each(modes, mode => {
          return helpers.checkResponseCode(
            {
              url: `http://127.0.0.1:${testPort}`,
              qs: {
                'hub.mode': mode,
                'hub.challenge': challenge
              }
            },
            200
          ).then(response => {
            if (!response.body) {
              throw new Error('expected "hub.challenge"')
            }

            assert(response.body, challenge)
          })
        })
      })
    })

    describe('POST method', () => {
      it('returns 202 response code if topic is missing', () => {
        return helpers.checkResponseCode(
          {
            url: `http://127.0.0.1:${testPort}`,
            method: 'POST'
          },
          202
        )
      })

      it('returns 202 response code if topic is incorrect', () => {
        return helpers.checkResponseCode(
          {
            url: `http://127.0.0.1:${testPort}`,
            method: 'POST',
            headers: {
              link: `<http://127.0.0.1:${apiPort}/>; rel="self"`
            }
          },
          202
        )
      })

      it('returns 202 response code if request is very large', () => {
        const largeText = '0'.repeat(1e7)

        return helpers.checkResponseCode(
          {
            url: `http://127.0.0.1:${testPort}`,
            method: 'POST',
            headers: {
              link: `<http://127.0.0.1:${apiPort}/test?param=value>; rel="self"`
            },
            body: largeText
          },
          202
        )
      })

      it('returns 202 response code if json is malformed', () => {
        return helpers.checkResponseCode(
          {
            url: `http://127.0.0.1:${testPort}`,
            method: 'POST',
            headers: {
              link: `<http://127.0.0.1:${apiPort}/test?param=value>; rel="self"`
            },
            body: 'text,'
          },
          202
        )
      })

      it('returns 200 response code if everything is ok', () => {
        return helpers.checkResponseCode(
          {
            url: `http://127.0.0.1:${testPort}`,
            method: 'POST',
            headers: {
              link: `<http://127.0.0.1:${apiPort}/test?param=value>; rel="self"`
            },
            json: {}
          },
          200
        )
      })

      describe('secret support', () => {
        it('returns 202 response code if "x-hub-signature" header is missing', () => {
          return helpers.checkResponseCode(
            {
              url: `http://127.0.0.1:${securePort}`,
              method: 'POST',
              headers: {
                link: `<http://127.0.0.1:${apiPort}/test?param=value>; rel="self"`
              }
            },
            202
          )
        })

        it('returns 202 response code if "x-hub-signature" header is incorrect', () => {
          return helpers.checkResponseCode(
            {
              url: `http://127.0.0.1:${securePort}`,
              method: 'POST',
              headers: {
                link: `<http://127.0.0.1:${apiPort}/test?param=value>; rel="self"`,
                'x-hub-signature': 'sha256=text'
              },
              json: {}
            },
            202
          )
        })

        it('returns 200 response code if everything is ok', () => {
          // first step
          const storedSign = crypto
            .createHmac('sha256', secret)
            .update(`http://127.0.0.1:${apiPort}/test?param=value`)
            .digest('hex')

          // second step
          const body = JSON.stringify({
            test: true
          })
          const signature = crypto
            .createHmac('sha256', storedSign)
            .update(body)
            .digest('hex')

          return secureWebhook.subscribe('test', {
            param: 'value'
          }).catch((err) => {
            throw new Error('unexpected error in #subscribe: ' + err.message)
          }).then(() => {
            return helpers.checkResponseCode(
              {
                url: `http://127.0.0.1:${securePort}`,
                method: 'POST',
                headers: {
                  link: `<http://127.0.0.1:${apiPort}/test?param=value>; rel="self"`,
                  'x-hub-signature': 'sha256=' + signature
                },
                body
              },
              200
            )
          })
        })
      })
    })

    it('only accepts POST and GET methods', () => {
      const methods = ['PUT', 'DELETE', 'OPTIONS']

      return Promise.each(methods, method => {
        return helpers.checkResponseCode(
          {
            url: `http://127.0.0.1:${testPort}`,
            method
          },
          405
        )
      })
    })
  })

  describe('events', () => {
    it('emits "denied" event if request with denied status was received', (done) => {
      let query = {
        'hub.mode': 'denied'
      }
      testWebhook.once('denied', (obj) => {
        assert(typeof obj === 'object')
        assert.deepEqual(obj, query)
        done()
      })

      helpers.sendRequest({
        url: `http://127.0.0.1:${testPort}`,
        qs: query
      })
    })

    it('emits "subscribe" event if the subscribe request was received', (done) => {
      let query = {
        'hub.mode': 'subscribe',
        'hub.challenge': 'HzSGH_h04Cgl6VbDJm7IyXSNSlrhaLvBi9eft3bw'
      }
      testWebhook.once('subscribe', (obj) => {
        assert(typeof obj === 'object')
        assert.deepEqual(obj, query)
        done()
      })

      helpers.sendRequest({
        url: `http://127.0.0.1:${testPort}`,
        qs: query
      })
    })

    it('emits "unsubscribe" event if the unsubscribe request was received', (done) => {
      let query = {
        'hub.mode': 'unsubscribe',
        'hub.challenge': 'HzSGH_h04Cgl6VbDJm7IyXSNSlrhaLvBi9eft3bw'
      }
      testWebhook.once('unsubscribe', (obj) => {
        assert(typeof obj === 'object')
        assert.deepEqual(obj, query)
        done()
      })

      helpers.sendRequest({
        url: `http://127.0.0.1:${testPort}`,
        qs: query
      })
    })

    it('emits "*" event if request with topic was received', (done) => {
      const body = {
        test: true
      }
      testWebhook.once('*', (obj) => {
        assert(typeof obj === 'object')
        assert(obj.topic === 'test')
        assert(obj.endpoint === `http://127.0.0.1:${apiPort}/test?param=value`)
        assert.deepEqual(obj.event, body)
        done()
      })

      helpers.sendRequest({
        url: `http://127.0.0.1:${testPort}`,
        method: 'POST',
        headers: {
          link: `<http://127.0.0.1:${apiPort}/test?param=value>; rel="self"`
        },
        json: body
      })
    })

    it('emits event with the topic name if request with topic was received', (done) => {
      const body = {
        test: true
      }
      testWebhook.once('test', (obj) => {
        assert(typeof obj === 'object')
        assert(obj.topic === 'test')
        assert(obj.endpoint === `http://127.0.0.1:${apiPort}/test?param=value`)
        assert.deepEqual(obj.event, body)
        done()
      })

      helpers.sendRequest({
        url: `http://127.0.0.1:${testPort}`,
        method: 'POST',
        headers: {
          link: `<http://127.0.0.1:${apiPort}/test?param=value>; rel="self"`
        },
        json: body
      })
    })

    describe('emits "webhook-error" event if incorrect request was received', () => {
      it('should emit if topic is missing', (done) => {
        testWebhook.once('webhook-error', (err) => {
          assert(err instanceof errors.WebhookError)
          assert(err.message === 'Topic is missing or incorrect')
          done()
        })

        helpers.sendRequest({
          url: `http://127.0.0.1:${testPort}`,
          method: 'POST'
        })
      })

      it('should emit if topic is incorrect', (done) => {
        testWebhook.once('webhook-error', (err) => {
          assert(err instanceof errors.WebhookError)
          assert(err.message === 'Topic is missing or incorrect')
          done()
        })

        helpers.sendRequest({
          url: `http://127.0.0.1:${testPort}`,
          method: 'POST',
          headers: {
            link: `<http://127.0.0.1:${apiPort}/>; rel="self"`
          }
        })
      })

      it('should emit if request is very large', (done) => {
        const largeText = '0'.repeat(1e7)
        testWebhook.once('webhook-error', (err) => {
          assert(err instanceof errors.WebhookError)
          assert(err.message === 'Request is very large')
          done()
        })

        helpers.sendRequest({
          url: `http://127.0.0.1:${testPort}`,
          method: 'POST',
          headers: {
            link: `<http://127.0.0.1:${apiPort}/test?param=value>; rel="self"`
          },
          body: largeText
        })
      })

      it('should emit if json is malformed', (done) => {
        testWebhook.once('webhook-error', (err) => {
          assert(err instanceof errors.WebhookError)
          assert(err.message === 'JSON is malformed')
          done()
        })

        helpers.sendRequest({
          url: `http://127.0.0.1:${testPort}`,
          method: 'POST',
          headers: {
            link: `<http://127.0.0.1:${apiPort}/test?param=value>; rel="self"`
          },
          body: 'text,'
        })
      })

      describe('secret support', () => {
        it('should emit if "x-hub-signature" header is missing', (done) => {
          secureWebhook.once('webhook-error', (err) => {
            assert(err instanceof errors.WebhookError)
            assert(err.message === '"x-hub-signature" is missing')
            done()
          })

          helpers.sendRequest({
            url: `http://127.0.0.1:${securePort}`,
            method: 'POST',
            headers: {
              link: `<http://127.0.0.1:${apiPort}/test?param=value>; rel="self"`
            }
          })
        })

        it('should emit if "x-hub-signature" header is incorrect', (done) => {
          secureWebhook.once('webhook-error', (err) => {
            assert(err instanceof errors.WebhookError)
            assert(err.message === '"x-hub-signature" is incorrect')
            done()
          })

          helpers.sendRequest({
            url: `http://127.0.0.1:${securePort}`,
            method: 'POST',
            headers: {
              link: `<http://127.0.0.1:${apiPort}/test?param=value>; rel="self"`,
              'x-hub-signature': 'sha256=text'
            },
            json: {}
          })
        })
      })
    })
  })

  describe('date fix', () => {
    it('should fix "timestamp" field in "users/follows" topic', (done) => {
      twitchWebhook.once('users/follows', ({event}) => {
        assert(event.timestamp instanceof Date)
        done()
      })

      helpers.sendRequest({
        url: `http://127.0.0.1:${webhookPort}`,
        method: 'POST',
        headers: {
          link: '<https://api.twitch.tv/helix/users/follows?to_id=1337>; rel="self"'
        },
        json: {
          timestamp: '2017-08-07T13:52:14.403795077Z'
        }
      })
    })

    it('should fix "started_at" fields in "streams" topic', (done) => {
      twitchWebhook.once('streams', ({event}) => {
        for (let stream of event.data) {
          assert(stream['started_at'] instanceof Date)
        }

        done()
      })

      helpers.sendRequest({
        url: `http://127.0.0.1:${webhookPort}`,
        method: 'POST',
        headers: {
          link: '<https://api.twitch.tv/helix/streams?user_id=5678>; rel="self"'
        },
        json: {
          data: [{
            'started_at': '2017-12-01T10:09:45Z'
          }, {
            'started_at': '2017-12-02T11:49:47Z'
          }]
        }
      })
    })
  })

  describe('#listen', () => {
    afterEach(() => offlineWebhook.close())

    it('should throw FatalError if the listener is already running', () => {
      return twitchWebhook.listen(offlinePort).catch(err => {
        assert(err instanceof errors.FatalError)
        assert(err.message === 'Listening is already started')
      })
    })

    it('starts listening with defined port and host', () => {
      return offlineWebhook.listen()
    })

    it('starts listening with options', () => {
      return offlineWebhook.listen(offlinePort)
    })
  })

  describe.skip('#close', () => {})

  describe('#isListening', () => {
    it('returns true if listening is started', () => {
      assert(twitchWebhook.isListening())
      return helpers.hasStartedListening(`http://127.0.0.1:${webhookPort}`)
    })

    it('returns false if listening is not started', () => {
      assert(offlineWebhook.isListening() === false)
      return helpers.hasStoppedListening(`http://127.0.0.1:${offlinePort}`)
    })
  })

  describe('#unsubscribe', () => {
    it('should throw RequestDenied if the request status is bad', function () {
      this.timeout(timeout)

      return twitchWebhook.unsubscribe('streams').catch(err => {
        assert(err instanceof errors.RequestDenied)
        assert(typeof err.response === 'object')
      })
    })

    it('should return nothing if everything is ok', function () {
      this.timeout(timeout)

      return twitchWebhook.unsubscribe('streams', {
        user_id: 123
      })
    })

    it('should not supplement link if topic url is absolute', function () {
      this.timeout(timeout)

      return twitchWebhook.unsubscribe('https://api.twitch.tv/helix/streams', {
        user_id: 123
      })
    })

    it('should not supplement link if topic options is not exists', function () {
      this.timeout(timeout)

      return twitchWebhook.unsubscribe('https://api.twitch.tv/helix/streams?user_id=123')
    })
  })

  describe('#subscribe', () => {
    it('should throw RequestDenied if the request status is bad', function () {
      this.timeout(timeout)

      return twitchWebhook.subscribe('streams').catch(err => {
        assert(err instanceof errors.RequestDenied)
        assert(typeof err.response === 'object')
      })
    })

    it('should return nothing if everything is ok', function () {
      this.timeout(timeout)

      return twitchWebhook.subscribe('streams', {
        user_id: 123
      })
    })

    it('should not supplement link if topic url is absolute', function () {
      this.timeout(timeout)

      return twitchWebhook.subscribe('https://api.twitch.tv/helix/streams', {
        user_id: 123
      })
    })

    it('should not supplement link if topic options is not exists', function () {
      this.timeout(timeout)

      return twitchWebhook.subscribe('streams?user_id=123')
    })
  })

  after(function () {
    if (twitchWebhook) {
      return twitchWebhook.close()
    } else {
      this.skip()
    }
  })

  after(function () {
    if (secureWebhook) {
      return secureWebhook.close()
    } else {
      this.skip()
    }
  })

  after(function () {
    if (testWebhook) {
      return testWebhook.close()
    } else {
      this.skip()
    }
  })
})
