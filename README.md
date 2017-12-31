# Node.js Twitch Helix Webhooks

[![Build Status](https://travis-ci.org/true-dubach/node-twitch-webhook.svg?branch=master)](https://travis-ci.org/true-dubach/node-twitch-webhook)
[![Coverage Status](https://coveralls.io/repos/github/true-dubach/node-twitch-webhook/badge.svg?branch=master)](https://coveralls.io/github/true-dubach/node-twitch-webhook?branch=master)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![dependencies Status](https://david-dm.org/true-dubach/node-twitch-webhook/status.svg)](https://david-dm.org/true-dubach/node-twitch-webhook)
[![devDependencies Status](https://david-dm.org/true-dubach/node-twitch-webhook/dev-status.svg)](https://david-dm.org/true-dubach/node-twitch-webhook?type=dev)
[![Node version](https://img.shields.io/node/v/twitch-webhook.svg?style=flat)](http://nodejs.org/download/)
[![Read the Docs (version)](https://img.shields.io/readthedocs/pip/stable.svg)](https://true-dubach.github.io/node-twitch-webhook/)
[![https://nodei.co/npm/twitch-webhook.png?downloads=true&downloadRank=true&stars=true](https://nodei.co/npm/twitch-webhook.png?downloads=true&downloadRank=true&stars=true)](https://www.npmjs.com/package/twitch-webhook)

## Installation

Install with NPM:

`npm install --save twitch-webhook`

## Usage

```
const TwitchWebhook = require('twitch-webhook')

const twitchWebhook = new TwitchWebhook({
    client_id: 'Your Twitch Client ID',
    callback: 'Your Callback URL',
    secret: 'It\'s a secret',
    listen: { 
        port: 8080,         // default: 8443
        host: '127.0.0.1',  // default: 0.0.0.0
        autoStart: false    // default: true
    }
})

twitchWebhook.on('streams', ({ topic, event }) => {
    console.log(event)
})

twitchWebhook.on('users/follows', ({ topic, event }) => {
    console.log(event)
})

twitchWebhook.on('*', ({ topic, event }) => {
    console.log(event)
})

twitchWebhook.subscribe('users/follows', {
    from_id: 'User id'
})

twitchWebhook.subscribe('streams', {
    user_id: 'User id'
})
```

## Documentation

<a href="https://true-dubach.github.io/node-twitch-webhook">API Reference</a>