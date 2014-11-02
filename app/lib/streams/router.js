var async    = require('async');
var sha1     = require('sha1');
var util     = require('util');
var stream   = require('stream');

module.exports = function (serverPubkey, conn) {
  return new Router(serverPubkey, conn);
};

function Router (serverPubkey, conn) {

  var Merkle      = conn.model('Merkle');
  var Transaction = conn.model('Transaction');
  var Peer        = conn.model('Peer');

  stream.Transform.call(this, { objectMode: true });

  var that = this;

  this._write = function (obj, enc, done) {
    if (obj.peerTarget) {                        route('peer',        obj, getTargetedButSelf(obj.peerTarget),          done); }
    else if (obj.pubkey && obj.uid) {            route('identity',    obj, getRandomInUPPeers,                          done); }
    else if (obj.userid) {                       route('membership',  obj, getRandomInUPPeers,                          done); }
    else if (obj.type && obj.type == 'Block') {  route('block',       obj, getRandomInUPPeers,                          done); }
    else if (obj.inputs) {                       route('transaction', obj, getRandomInUPPeers,                          done); }
    else if (obj.endpoints) {                    route('peer',        obj, getRandomInAllPeersButPeer(obj.pub),         done); }
    else if (obj.status) {                       route('status',      obj, getTargetedButSelf(obj.to),                  done); }
    else {
      done();
    }
  };

  function route (type, obj, getPeersFunc, done) {
    getPeersFunc(function (err, peers) {
      that.push({
        'type': type,
        'obj': obj,
        'peers': peers || []
      });
      done();
    });
  }

  function getRandomInAllPeersButPeer (pub) {
    return function (done) {
      Peer.getRandomlyWithout([serverPubkey, pub], done);
    };
  };

  function getRandomInUPPeers (done) {
    Peer.getRandomlyUPsWithout([serverPubkey], done);
  };

  /**
  * Get the peer targeted by `to` argument, this node excluded (for not to loop on self).
  */
  function getTargetedButSelf (to) {
    return function (done) {
      if (to == serverPubkey) {
        done(null, []);
      } else {
        Peer.getTheOne(to, function (err, peer) {
          done(err, [peer]);
        });
      }
    };
  }
};

util.inherits(Router, stream.Transform);
