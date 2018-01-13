const TwitchWebhook = require('twitch-webhook')

const clientId = process.env.CLIENT_ID
if (!clientId) {
  throw new Error('Twitch Client ID not provided')
}
const callback = process.env.CALLBACK
if (!callback) {
  throw new Error('Callback URL not provided')
}

const twitchWebhook = new TwitchWebhook({
  client_id: clientId,
  callback,
  secret: 'hello human Kappa',
  listen: {
    autoStart: true
  }
})

// set listener for all topics
twitchWebhook.on('*', ({ topic, options, endpoint, event }) => {
  console.log(topic, options, endpoint, event)
})

// subscribe to "users/follows" topic
twitchWebhook.subscribe('users/follows', {
  first: 1,
  to_id: '12826' // ID of Twitch Chanell ¯\_(ツ)_/¯
})
// subscribe to "streams" topic
twitchWebhook.subscribe('streams', {
  user_id: '12826'
})

// renew the subscription when it expires
twitchWebhook.on('unsubscibe', (obj) => {
  twitchWebhook.subscribe(obj['hub.topic'])
})

process.on('SIGINT', () => {
  // unsubscribe from all topics
  twitchWebhook.unsubscribe('*')

  process.exit(0)
})
