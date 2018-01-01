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
        port
      }
    })

    offlineWebhook = new TwitchWebhook({
      client_id,
      callback,
      listen: {
        host: '127.0.0.1',
        port: freePort,
        autoStart: false
      }
    })
  })

  it('should contain errors', (done) => {
    assert(twitchWebhook.errors instanceof Object);
    done()
  })

  it('should throw FatalError if the Twitch Client ID is not provided', (done) => {
    try {
      let testWebhook = new TwitchWebhook();
      done(new Error('expected error'))
    } catch (err) {
      assert(err instanceof errors.FatalError);
      done()
    }
  })

  it('should throw FatalError if the Callback URL is not provided', (done) => {
    try {
      let testWebhook = new TwitchWebhook({
        client_id
      });
      done(new Error('expected error'))
    } catch (err) {
      assert(err instanceof errors.FatalError);
      done()
    }
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
                throw new Error('expected "hub.challenge"')
              }
            })
        })
      })
    })

    describe('POST method', () => {
      it('returns 202 response code if data is very large', () => {
        const largeText = '0'.repeat(1e7)

        return helpers.checkResponseCode(
          {
            url: `http://127.0.0.1:${port}`,
            method: 'POST',
            body: largeText
          },
          202
        )
      })

      it('returns 202 response code if json is malformed', () => {
        return helpers.checkResponseCode(
          {
            url: `http://127.0.0.1:${port}`,
            method: 'POST',
            body: 'text,'
          },
          202
        )
      })

      it('returns 202 error code if topic is missing', () => {
        return helpers.checkResponseCode(
          {
            url: `http://127.0.0.1:${port}`,
            method: 'POST'
          },
          202
        )
      })

      it('returns 202 error code if topic is incorrect', () => {
        return helpers.checkResponseCode(
          {
            url: `http://127.0.0.1:${port}`,
            method: 'POST',
            headers: {
              link: '<https://api.twitch.tv/helix/>; rel="self"'
            }
          },
          202
        )
      })

      it('returns 200 response code if everything is ok', () => {
        return helpers.checkResponseCode(
          {
            url: `http://127.0.0.1:${port}`,
            method: 'POST',
            headers: {
              link: '<https://api.twitch.tv/helix/users/follows?to_id=1337>; rel="self"'
            },
            json: {}
          },
          200
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

  describe('events', () => {
    it('emits "denied" event if request with denied status was received', (done) => {
      twitchWebhook.once(
        'denied',
        () => done()
      )
      
      helpers.sendRequest(
        {
          url: `http://127.0.0.1:${port}`,
          qs: {
            'hub.mode': 'denied',
            'hub.topic': 'https://api.twitch.tv/helix/users/follows?to_id=1337',
            'hub.reason': 'unauthorized'
          }
        }
      );
    })

    it('emits "subscribe" event if the subscribe request was received', (done) => {
      twitchWebhook.once(
        'subscribe',
        () => done()
      )
      
      helpers.sendRequest(
        {
          url: `http://127.0.0.1:${port}`,
          qs: {
            'hub.mode': 'subscribe',
            'hub.topic': 'https://api.twitch.tv/helix/users/follows?to_id=1337',
            'hub.lease_seconds': 864000,
            'hub.challenge': 'HzSGH_h04Cgl6VbDJm7IyXSNSlrhaLvBi9eft3bw'
          }
        }
      );
    })

    it('emits "unsubscribe" event if the unsubscribe request was received', (done) => {
      twitchWebhook.once(
        'unsubscribe',
        () => done()
      )
      
      helpers.sendRequest(
        {
          url: `http://127.0.0.1:${port}`,
          qs: {
            'hub.mode': 'unsubscribe',
            'hub.topic': 'https://api.twitch.tv/helix/users/follows?to_id=1337',
            'hub.lease_seconds': 864000,
            'hub.challenge': 'HzSGH_h04Cgl6VbDJm7IyXSNSlrhaLvBi9eft3bw'
          }
        }
      );
    })

    it('emits "*" event if request with topic was received', (done) => {
      twitchWebhook.once(
        '*',
        () => done()
      )

      helpers.sendRequest(
        {
          url: `http://127.0.0.1:${port}`,
          method: 'POST',
          headers: {
            link: '<https://api.twitch.tv/helix/test>; rel="self"'
          },
          json: {}
        }
      )
    })
  })

  describe('date fix', () => {
    it('should fix "timestamp" field in "users/follows" topic', (done) => {
      twitchWebhook.once('users/follows', ({event}) => {
        assert(event.timestamp instanceof Date)
        done()
      })

      helpers.sendRequest(
        {
          url: `http://127.0.0.1:${port}`,
          method: 'POST',
          headers: {
            link: '<https://api.twitch.tv/helix/users/follows?to_id=1337>; rel="self"'
          },
          json: {
            id: "436c70bb-a52f-4a6a-b4cc-6c57bc2ad227",
            topic: "https://api.twitch.tv/helix/users/follows?to_id=1337",
            type: "create",
            data: {
                from_id: 1336,
                to_id: 1337
            },
            timestamp: "2017-08-07T13:52:14.403795077Z"
          }
        },
        200
      )
    })

    it('should fix "started_at" fields in "streams" topic', (done) => {
      twitchWebhook.once('streams', ({event}) => {
        for (let stream of event.data) {
          assert(stream['started_at'] instanceof Date)
        }
      
        done()
      })

      helpers.sendRequest(
        {
          url: `http://127.0.0.1:${port}`,
          method: 'POST',
          headers: {
            link: '<https://api.twitch.tv/helix/streams?user_id=5678>; rel="self"'
          },
          json: {
            data: [{
              id: '0123456789',
              user_id: 5678,
              game_id: 21779,
              community_ids: [],
              type: 'live',
              title: 'Best Stream Ever',
              'viewer_count': 417,
              'started_at': '2017-12-01T10:09:45Z',
              language: 'en',
              'thumbnail_url': 'https://link/to/thumbnail.jpg',
            }]
          }
        }
      )
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

  describe('#unsubscribe', () => {
    it('should throw RequestDenied if the request status is bad', function () {
      this.timeout(timeout)

      return twitchWebhook.unsubscribe('streams').catch(err => {
        assert(err instanceof errors.RequestDenied)
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
      })
    })

    it('should return nothing if everything is ok', function () {
      this.timeout(timeout)

      return twitchWebhook.subscribe('streams', {
        user_id: 123
      }).then(() => {
        return twitchWebhook.unsubscribe('streams', {
          user_id: 123
        })
      })
    })

    it('should not supplement link if topic url is absolute', function () {
      this.timeout(timeout)

      return twitchWebhook.subscribe('https://api.twitch.tv/helix/streams', {
        user_id: 123
      }).then(() => {
        return twitchWebhook.unsubscribe('https://api.twitch.tv/helix/streams', {
          user_id: 123
        })
      })
    })

    it('should not supplement link if topic options is not exists', function () {
      this.timeout(timeout)

      return twitchWebhook.subscribe('streams?user_id=123').then(() => {
        return twitchWebhook.unsubscribe('streams?user_id=123')
      })
    })
  })

  after(() => {
    return twitchWebhook.close()
  })
})
