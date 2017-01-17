"use strict";

const _ = require('underscore');
const co = require('co');
const async = require('async');
const constants = require('../lib/constants');
const Peer = require('../lib/entity/peer');

module.exports = {
  duniter: {
    service: {
      neutral: new Crawler()
    }
  }
}

/**
 * Service which triggers the server's peering generation (actualization of the Peer document).
 * @constructor
 */
function Crawler() {

  const peerCrawler = new PeerCrawler();

  this.startService = (server, conf) => [
    peerCrawler.startService(server, conf)
  ];

  this.stopService = () => [
    peerCrawler.stopService()
  ];
}

function PeerCrawler() {
}
