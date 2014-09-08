IRC Slack Bot
========

Originally forked from https://github.com/rknLA/irc-slack-echo

Broke off the fork planning to customize it beyond what'd be useful to merge
back for a simpler hybrid team/nonteam #galaxyproject communication bridge.

Setup
-----

* Make sure you're running node 0.10.25+.  Other versions might work, but are untested.
* Fork the repo and run `npm install`
* Create a new Incoming Web Hook on Slack (https://your.slack.com/services/new/incoming-webhook)
* Create a new Outgoing Web Hook on Slack and grab the token from it.
* Open the config file and update the parameters.  Mostly, you need to make sure that the Outgoing Web Hook points at the server that gets set up in `lib/slack.js`.
* Update the Outgoing Web Hook with your server info and trigger words. (We use `ircbot` and `!`).
* Find a server to run it on, and `node .`

Note that the user map listens for IRC mentions with an optional @ character,
and automatically wraps the Slack username in <@username> so that Slack sends
notifications appropriately.

