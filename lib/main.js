var irc = require('irc');

var ircCommands = require('./ircCommands');
var mapping = require('./mapping');
var slack = require('./slack');

var config = require('../config');


/*
 * Set up the IRC client
 */
var _ = require('underscore');

var list_of_irc_channels = _.map(config.channels, function(element){return element.channel;});

var client = new irc.Client(config.irc.server, config.irc.nick, {
  channels: list_of_irc_channels,
  port: 6697,
  debug: true,
  showErrors: true,
  secure: true,
  autoConnect: false,
  autoRejoin: true,
  retryCount: 3
});

slack.setClient(client);


/*
 * Set up the IRC listeners
 */

client.addListener('message', function(from, to, message) {
  var room = to;
  console.log(from + ' => ' + room + ': ' + message);

  // propagate the message to slack, even if it was a command
  message = mapping.ircToSlack(message);
  slack.sendEcho({'message': message,
                  'username': from,
                  'channel': room});
  // handle any commands
  var botResponse = ircCommands.handleCommand(from, to, message);
  if (botResponse) {
    client.say(config.irc.channel, botResponse);
    slack.sendEcho("[" + room + "] " + config.irc.nick + ": " + botResponse);
  }
});

client.addListener('error', function(message) {
  console.log("ERROR: " + message);
});

console.log("Connecting to IRC");
client.connect(function(){
  console.log("connect called back", arguments);
});
