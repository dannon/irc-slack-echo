var _ = require('underscore');
var Hapi = require('hapi');
var https = require('https');

var config = require('../config');
var mapping = require('./mapping');

var ircClient;

var slackPostOptions = {
  hostname: config.slack.host,
  port: 443,
  path: '/services/hooks/incoming-webhook?token=' + config.slack.incomingWebhookToken,
  method: 'POST'
};

var sendToSlack = function(content) {
  // Stupid hack to prevent slack->irc->back_to_slack echo.  If content starts
  // with [{config.irc.channel}], ignore it.
  var postContent;
  if (typeof content == 'string' || content instanceof String){
      // Just a regular string, send it to slack as default user.
      postContent = {
          text: content
      };
  } else {
      if (content.message.lastIndexOf("[" +config.irc.channel +"] " + config.irc.nick) === 0){
          return;
      }
      postContent = {
        channel: content.channel,
        username: content.username,
        text: content.message
      };
  }
  var postBody = JSON.stringify(postContent);

  var options = slackPostOptions;
  options.headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postBody)
  };
  var req = https.request(options, function(res) {
    res.setEncoding('utf8');
    res.on('data', function(d) {
      console.log('body: ' + d);
    });
  });

  req.write(postBody);
  req.end();
};

module.exports = {

  sendEcho: sendToSlack,

  /* set the IRC client for the outgoing webhook listener */
  setClient: function(client) {
    ircClient = client;
    server.start(function() {
      console.log("Outgoing webhook listener started.");
    });
  }
};

/* Slack Outgoing Web Hook listening server */

var server = new Hapi.Server(config.slack.outgoingWebhookServer.interface, config.slack.outgoingWebhookServer.port, {
  location: config.slack.outgoingWebhookServer.domain,
});

server.route({
  path: config.slack.outgoingWebhookServer.hookPath,
  method: 'POST',
  handler: function(request, reply) {
    if (config.slack.outgoingWebhookToken.indexOf(request.payload.token) !== -1){
        if (request.payload.user_id !== 'USLACKBOT'){
          // USLACKBOT is the slackbot user who will echo in the slack channel, ignore them.
          handleSlackInput(request.payload);
        }
        reply('ok');
    } else {
      reply(Hapi.error.unauthorized('Bad Token'));
    }
  }
});

server.route({
  path: '/',
  method: 'GET',
  handler: function(request, reply) {
    reply("Oh, hi. What are _you_ doing here?");
  }
});


/* slack response methods */
var slackBotMethods = {
  'ping': function() {
    // don't care about args here
    return "pong";
  },

  'say': function(context) {
    var messageText = context.commandless_words.join(' ');
    //messageText = mapping.ircToSlack(messageText);
    messageText = mapping.slackToIRC(messageText);
    var composed = "["+ context.user_name + "] " + messageText;
    ircClient.say("#" + context.channel_name, composed);
    return "[" + context.channel + "] " + config.irc.nick + ": " + composed;
  },

  'link': function(context) {
    var response;
    switch(context.commandless_words.length) {
      case 1:
        response = mapping.link("<@" + context.user_id + ">",
                                context.commandless_words[0]);
        break;
      case 2:
        response = mapping.link(context.commandless_words[0],
                                context.commandless_words[1]);
        break;
      default:
        response = "I guess I should tell you how to use link..";
        break;
    }

    if (response) {
      sendToSlack(response);
    }
  },

  'unlink': function(context) {
    var response;
    switch(context.commandless_words.length) {
      case 0:
        // no args, unlink all
        response = mapping.unlink(context.user_name);
        break;
      case 1:
        // 1 arg, unlink my slack name from the passed irc name
        response = mapping.unlink(context.user_name,
                                  context.commandless_words[0]);
        break;
      case 2:
        // 2 args, slack name first, irc name second
        response = mapping.unlink(context.commandless_words[0],
                                  context.commandless_words[1]);
        break;
      default:
        response = "I guess I should tell you how to unlink..";
        break;
    }
    if (response) {
      sendToSlack(response);
    }
  },

  'show': function(context) {
    var response;
    switch(context.commandless_words.length) {
      case 0:
        response = mapping.list();
        break;
    }
    if (response) {
      sendToSlack(response);
    }
  },
};

var handleSlackInput = function(payload) {
  if (ircClient) {
    // remove trigger word
    var words, response;
    if (payload.trigger_word){
        var deTriggered = payload.text.slice(payload.trigger_word.length);
        words = deTriggered.split(' ');
    }
    else {
        words = payload.text.split(' ');
    }

    if (words[0] == ':') {
      words = words.slice(1);
    }

    if (words[0].lastIndexOf("!") === 0){
        // This is a command(!), parse it and dispatch
        var command = words[0].slice(1);
        payload.commandless_words = words.slice(1);
        if (_.has(slackBotMethods, command)) {
          response = slackBotMethods[command](payload);
          if (response) {
            sendToSlack(response);
          }
        }
    }else{
        // Not a command, echo the text.
        payload.commandless_words = words;
        response = slackBotMethods.say(payload);
        /*if (response){
            sendToSlack(response);
        }*/
    }
  }
};
