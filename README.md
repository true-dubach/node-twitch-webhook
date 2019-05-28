# Node.js Twitch Helix Webhooks

[![Build Status](https://travis-ci.org/true-dubach/node-twitch-webhook.svg?branch=master)](https://travis-ci.org/true-dubach/node-twitch-webhook)
[![Coverage Status](https://coveralls.io/repos/github/true-dubach/node-twitch-webhook/badge.svg?branch=master)](https://coveralls.io/github/true-dubach/node-twitch-webhook?branch=master)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![dependencies Status](https://david-dm.org/true-dubach/node-twitch-webhook/status.svg)](https://david-dm.org/true-dubach/node-twitch-webhook)
[![devDependencies Status](https://david-dm.org/true-dubach/node-twitch-webhook/dev-status.svg)](https://david-dm.org/true-dubach/node-twitch-webhook?type=dev)
[![Node version](https://img.shields.io/node/v/twitch-webhook.svg?style=flat)](http://nodejs.org/download/)
[![Read the Docs (version)](https://img.shields.io/readthedocs/pip/stable.svg)](https://true-dubach.github.io/node-twitch-webhook/)
[![https://nodei.co/npm/twitch-webhook.png?downloads=true&downloadRank=true&stars=true](https://nodei.co/npm/twitch-webhook.png?downloads=true&downloadRank=true&stars=true)](https://www.npmjs.com/package/twitch-webhook)

Little Node.js module to interact with new [Twitch Helix API Webhooks](https://dev.twitch.tv/docs/api/webhooks-reference).

## Install

```bash
npm install --save twitch-webhook
```

## Usage

_**Note**: Twitch will return old payload for "users/follows" topic
if `{first: 1}` is not specified_

```js
const TwitchWebhook = require('twitch-webhook')

const twitchWebhook = new TwitchWebhook({
  client_id: 'Your Twitch Client ID',
  callback: 'Your Callback URL',
  secret: 'It\'s a secret', // default: false
  lease_seconds: 259200,    // default: 864000 (maximum value)
  listen: {
    port: 8080,             // default: 8443
    host: '127.0.0.1',      // default: 0.0.0.0
    autoStart: false        // default: true
  }
})

// set listener for all topics
twitchWebhook.on('*', ({ topic, options, endpoint, event }) => {
  // topic name, for example "streams"
  console.log(topic)
  // topic options, for example "{user_id: 12826}"
  console.log(options)
  // full topic URL, for example
  // "https://api.twitch.tv/helix/streams?user_id=12826"
  console.log(endpoint)
  // topic data, timestamps are automatically converted to Date
  console.log(event)
})

// set listener for topic
twitchWebhook.on('users/follows', ({ event }) => {
  console.log(event)
})

// subscribe to topic
twitchWebhook.subscribe('users/follows', {
  first: 1,
  from_id: 12826 // ID of Twitch Channel ¯\_(ツ)_/¯
})

// renew the subscription when it expires
twitchWebhook.on('unsubscribe', (obj) => {
  twitchWebhook.subscribe(obj['hub.topic'])
})

// tell Twitch that we no longer listen
// otherwise it will try to send events to a down app
process.on('SIGINT', () => {
  // unsubscribe from all topics
  twitchWebhook.unsubscribe('*')

  // or unsubscribe from each one individually
  twitchWebhook.unsubscribe('users/follows', {
    first: 1,
    to_id: 12826
  })

  process.exit(0)
})
```

## Documentation

[API Reference](https://true-dubach.github.io/node-twitch-webhook)
