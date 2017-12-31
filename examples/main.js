const TwitchWebhook = require('twitch-webhook')

const { CLIENT_ID, CALLBACK } = process.env

if (!CLIENT_ID) {
  throw new Error('Twitch Client ID not provided')
}

if (!CALLBACK) {
  throw new Error('Callback URL not provided')
}

const twitchWebhook = new TwitchWebhook({
  client_id: CLIENT_ID,
  callback: CALLBACK,
  secret: 'hello human Kappa',
  listen: {
    autoStart: true
  }
})

twitchWebhook.on('*', ({ topic, event }) => {
  console.log(event)
})

twitchWebhook.subscribe('users/follows', {
  to_id: '12826'
})

twitchWebhook.subscribe('streams', {
  user_id: '12826'
})

process.on('exit', code => {
  console.log(`Exit with code ${code}`)

  twitchWebhook.unsubscribe('users/follows', {
    to_id: '12826'
  })

  twitchWebhook.unsubscribe('streams', {
    user_id: '12826'
  })
})
