const TwitchWebhook = require('twitch-webhook');

const client_id = process.env.CLIENT_ID;
if (!client_id) {
  throw new Error('Twitch Client ID not provided');
}

const callback = process.env.CALLBACK;
if (!callback) {
    throw new Error('Callback URL not provided');
}

const twitchWebhook = new TwitchWebhook({
    client_id,
    callback,
    secret: 'hello human :)',
    listen: {
        autoStart: true,
    }
})

twitchWebhook.on('*', (obj) => {
    console.log(obj);
});

twitchWebhook.subscribe('users/follows', {
    to_id: '12826'
});

twitchWebhook.subscribe('streams', {
    user_id: '12826',
});

process.on('exit', (code) => {
    console.log(`Exit with code ${code}`);
    twitchWebhook.unsubscribe('users/follows', {
        to_id: '12826'
    });
    twitchWebhook.unsubscribe('streams', {
        user_id: '12826'
    });
});