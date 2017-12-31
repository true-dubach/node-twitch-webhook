const TwitchWebhook = require('../src/index')
const errors = require('../src/errors')
const helpers = require('./helpers')
const assert = require('assert')
const Promise = require('bluebird')
const request = require('request-promise')

const client_id = process.env.CLIENT_ID

if (!client_id) {
  throw new Error('Twitch Client ID not provided')
}

const port = process.env.PORT || 9108
const freePort = port + 1
const timeout = 10 * 1000

const callback = process.env.CALLBACK || 'https://216.58.210.174/'

describe('TwitchWebhook', () => {
  let twitchWebhook
  let offlineWebhook

  before(() => {
    twitchWebhook = new TwitchWebhook({
      client_id,
      callback,
      listen: {
        host: '127.0.0.1',
        port,
        autoStart: true
      }
    })

    offlineWebhook = new TwitchWebhook({
      client_id,
      callback,
      listen: {
        host: '127.0.0.1',
        port: freePort
      }
    })
  })

  it('should automaticaly start listening by default', () => {
    assert.equal(twitchWebhook.isListening(), true)
    return helpers.hasStartedListening(`http://127.0.0.1:${port}`)
  })

  it('should not automaticaly start listening if "autoStart" is false', () => {
    assert.equal(offlineWebhook.isListening(), false)
    return helpers.hasStoppedListening(`http://127.0.0.1:${freePort}`)
  })

  describe('webhook', () => {
    describe('GET method', () => {
      it('returns 400 error code if the request is malformed', () => {
        return helpers.checkResponseCode(
          {
            url: `http://127.0.0.1:${port}`
          },
          400
        )
      })

      it('returns 200 response code if request with denied status was received', () => {
        return helpers.checkResponseCode(
          {
            url: `http://127.0.0.1:${port}`,
            qs: {
              'hub.mode': 'denied',
              'hub.topic': 'https://api.twitch.tv/helix/users/follows?to_id=1337',
              'hub.reason': 'unauthorized'
            }
          },
          200
        )
      })

      it('returns 200 response code and "hub.challenge" if the subscribe or unsubscribe request was received', () => {
        const modes = ['subscribe', 'unsubscribe']

        return Promise.each(modes, mode => {
          return helpers
            .checkResponseCode(
            {
              url: `http://127.0.0.1:${port}`,
              qs: {
                'hub.mode': mode,
                'hub.topic': 'https://api.twitch.tv/helix/users/follows?to_id=1337',
                'hub.lease_seconds': 864000,
                'hub.challenge': 'HzSGH_h04Cgl6VbDJm7IyXSNSlrhaLvBi9eft3bw'
              }
            },
              200
            )
            .then(response => {
              if (!response.body) {
                throw new Error('expeced "hub.challenge"')
              }
            })
        })
      })
    })

    describe('POST method', () => {
      it('returns 413 error code if data is very large', () => {
        const largeText = '0'.repeat(1e7)

        let check = helpers.checkResponseCode(
          {
            url: `http://127.0.0.1:${port}`,
            method: 'POST',
            body: largeText
          },
          413
        )

        return check
      })

      it('returns 400 error code if json is malformed', function () {
        this.timeout(timeout)

        return helpers.checkResponseCode(
          {
            url: `http://127.0.0.1:${port}`,
            method: 'POST',
            body: 'text,'
          },
          400
        )
      })

      it('returns 400 error code if topic is missing', () => {
        return helpers.checkResponseCode(
          {
            url: `http://127.0.0.1:${port}`,
            method: 'POST'
          },
          400
        )
      })

      it('returns 204 response code if everything is ok', () => {
        return helpers.checkResponseCode(
          {
            url: `http://127.0.0.1:${port}`,
            method: 'POST',
            json: {
              topic: 'https://api.twitch.tv/helix/users/follows?to_id=1337'
            }
          },
          204
        )
      })
    })

    it('only accepts POST and GET methods', () => {
      const methods = ['PUT', 'DELETE', 'OPTIONS']

      return Promise.each(methods, method => {
        return helpers.checkResponseCode(
          {
            url: `http://127.0.0.1:${port}`,
            method
          },
          405
        )
      })
    })
  })

  describe('#listen', () => {
    afterEach(() => offlineWebhook.close())

    it('should throw FatalError if the listener is already running', () => {
      return twitchWebhook.listen(freePort).catch(err => {
        assert(err instanceof errors.FatalError)
      })
    })

    it('starts listening with defined port and host', () => {
      return offlineWebhook.listen()
    })

    it('starts listening with options', () => {
      return offlineWebhook.listen(freePort)
    })
  })

  describe.skip('#close', () => {})

  describe('#isListening', () => {
    it('returns true if listening is started', () => {
      assert.equal(twitchWebhook.isListening(), true)
      return helpers.hasStartedListening(`http://127.0.0.1:${port}`)
    })

    it('returns false if listening is not started', () => {
      assert.equal(offlineWebhook.isListening(), false)
      return helpers.hasStoppedListening(`http://127.0.0.1:${freePort}`)
    })
  })

  describe.skip('#subscribe', () => {})

  describe('#unsubscribe', () => {
    it('should throw FatalError if the request status is bad', function () {
      this.timeout(timeout)

      return twitchWebhook.unsubscribe('streams').catch(err => {
        assert(err instanceof errors.FatalError)
      })
    })

    it('should throw RequestDenied if request status is denied', function () {
      this.timeout(timeout)

      return twitchWebhook
        .unsubscribe('streams', {
          user_id: 123
        })
        .catch(err => {
          assert(err instanceof errors.RequestDenied)
        })
    })

    it('should return nothing if everything is ok', function () {
      this.timeout(timeout)

      return twitchWebhook.unsubscribe('streams', {
        user_id: 123
      })
    })
  })

  after(() => {
    return twitchWebhook.close()
  })
})
