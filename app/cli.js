"use strict";

const co = require('co');
const logger = require('../app/lib/logger')('cli');
const async = require('async');
const Q = require('q');
const _ = require('underscore');
const contacter = require('../app/lib/contacter');
const directory = require('../app/lib/system/directory');
const wizard = require('../app/lib/wizard');
const multicaster = require('../app/lib/streams/multicaster');
const keyring = require('../app/lib/crypto/keyring');
const base58 = require('../app/lib/crypto/base58');
const pjson = require('../package.json');
const duniter = require('../index');
const Peer = require('../app/lib/entity/peer');
const Block = require('../app/lib/entity/block');
const constants = require('../app/lib/constants');

module.exports = () => {
}

function proveAndSend(program, server, block, issuer, difficulty, host, port, done) {
  var BlockchainService = server.BlockchainService;
  async.waterfall([
    function (next) {
      block.issuer = issuer;
      program.show && console.log(block.getRawSigned());
      co(function*(){
        try {
          const proven = yield BlockchainService.prove(block, difficulty);
          next(null, proven);
        } catch(e) {
          next(e);
        }
      });
    },
    function (block, next) {
      var peer = new Peer({
        endpoints: [['BASIC_MERKLED_API', host, port].join(' ')]
      });
      program.show && console.log(block.getRawSigned());
      logger.info('Posted block ' + block.quickDescription());
      co(function*(){
        try {
          yield multicaster(server.conf).sendBlock(peer, block);
          next();
        } catch(e) {
          next(e);
        }
      });
    }
  ], done);
}

function startWizard(service, step, server, conf, done) {
  var wiz = wizard(server);
  var task = {
    'currency': wiz.configCurrency,
    'basic': wiz.configBasic,
    'pow': wiz.configPoW,
    'network': wiz.configNetwork,
    'network-reconfigure': wiz.configNetworkReconfigure,
    'key': wiz.configKey,
    'ucp': wiz.configUCP
  };
  var wizDo = task[step] || wiz.configAll;
  async.waterfall([
    function (next) {
      wizDo(conf, next);
    },
    function (next) {
      co(function*(){
        try {
          yield server.dal.saveConf(conf);
          logger.debug("Configuration saved.");
          next();
        } catch(e) {
          next(e);
        }
      });
    },
    function (next) {
      // Check config
      service(function (key, server, conf) {
        next();
      })(null, null);
    }
  ], done);
}

function commandLineConf(program, conf) {

  conf = conf || {};
  conf.sync = conf.sync || {};
  var cli = {
    currency: program.currency,
    cpu: program.cpu,
    server: {
      port: program.port,
      ipv4address: program.ipv4,
      ipv6address: program.ipv6,
      salt: program.salt,
      passwd: program.passwd,
      remote: {
        host: program.remoteh,
        ipv4: program.remote4,
        ipv6: program.remote6,
        port: program.remotep
      }
    },
    db: {
      mport: program.mport,
      mdb: program.mdb,
      home: program.home
    },
    net: {
      upnp: program.upnp,
      noupnp: program.noupnp
    },
    logs: {
      http: program.httplogs,
      nohttp: program.nohttplogs
    },
    endpoints: [],
    rmEndpoints: [],
    ucp: {
      rootoffset: program.rootoffset,
      sigPeriod: program.sigPeriod,
      sigStock: program.sigStock,
      sigWindow: program.sigWindow,
      idtyWindow: program.idtyWindow,
      msWindow: program.msWindow,
      sigValidity: program.sigValidity,
      sigQty: program.sigQty,
      msValidity: program.msValidity,
      powZeroMin: program.powZeroMin,
      powPeriod: program.powPeriod,
      powDelay: program.powDelay,
      participate: program.participate,
      ud0: program.ud0,
      c: program.growth,
      dt: program.dt,
      incDateMin: program.incDateMin,
      medtblocks: program.medtblocks,
      dtdiffeval: program.dtdiffeval,
      avgGenTime: program.avgGenTime
    },
    isolate: program.isolate,
    forksize: program.forksize,
    nofork: program.nofork,
    timeout: program.timeout
  };

  // Update conf
  if (cli.currency)                         conf.currency = cli.currency;
  if (cli.server.ipv4address)               conf.ipv4 = cli.server.ipv4address;
  if (cli.server.ipv6address)               conf.ipv6 = cli.server.ipv6address;
  if (cli.server.port)                      conf.port = cli.server.port;
  if (cli.server.salt)                      conf.salt = cli.server.salt;
  if (cli.server.passwd != undefined)       conf.passwd = cli.server.passwd;
  if (cli.server.remote.host != undefined)  conf.remotehost = cli.server.remote.host;
  if (cli.server.remote.ipv4 != undefined)  conf.remoteipv4 = cli.server.remote.ipv4;
  if (cli.server.remote.ipv6 != undefined)  conf.remoteipv6 = cli.server.remote.ipv6;
  if (cli.server.remote.port != undefined)  conf.remoteport = cli.server.remote.port;
  if (cli.ucp.rootoffset)                   conf.rootoffset = cli.ucp.rootoffset;
  if (cli.ucp.sigPeriod)                    conf.sigPeriod = cli.ucp.sigPeriod;
  if (cli.ucp.sigStock)                     conf.sigStock = cli.ucp.sigStock;
  if (cli.ucp.sigWindow)                    conf.sigWindow = cli.ucp.sigWindow;
  if (cli.ucp.idtyWindow)                   conf.idtyWindow = cli.ucp.idtyWindow;
  if (cli.ucp.msWindow)                     conf.msWindow = cli.ucp.msWindow;
  if (cli.ucp.sigValidity)                  conf.sigValidity = cli.ucp.sigValidity;
  if (cli.ucp.msValidity)                   conf.msValidity = cli.ucp.msValidity;
  if (cli.ucp.sigQty)                       conf.sigQty = cli.ucp.sigQty;
  if (cli.ucp.msValidity)                   conf.msValidity = cli.ucp.msValidity;
  if (cli.ucp.powZeroMin)                   conf.powZeroMin = cli.ucp.powZeroMin;
  if (cli.ucp.powPeriod)                    conf.powPeriod = cli.ucp.powPeriod;
  if (cli.ucp.powDelay)                     conf.powDelay = cli.ucp.powDelay;
  if (cli.ucp.participate)                  conf.participate = cli.ucp.participate == 'Y';
  if (cli.ucp.dt)                           conf.dt = cli.ucp.dt;
  if (cli.ucp.c)                            conf.c = cli.ucp.c;
  if (cli.ucp.ud0)                          conf.ud0 = cli.ucp.ud0;
  if (cli.ucp.incDateMin)                   conf.incDateMin = cli.ucp.incDateMin;
  if (cli.ucp.medtblocks)                   conf.medianTimeBlocks = cli.ucp.medtblocks;
  if (cli.ucp.avgGenTime)                   conf.avgGenTime = cli.ucp.avgGenTime;
  if (cli.ucp.dtdiffeval)                   conf.dtDiffEval = cli.ucp.dtdiffeval;
  if (cli.net.upnp)                         conf.upnp = true;
  if (cli.net.noupnp)                       conf.upnp = false;
  if (cli.cpu)                              conf.cpu = Math.max(0.01, Math.min(1.0, cli.cpu));
  if (cli.logs.http)                        conf.httplogs = true;
  if (cli.logs.nohttp)                      conf.httplogs = false;
  if (cli.db.mport)                         conf.mport = cli.db.mport;
  if (cli.db.home)                          conf.home = cli.db.home;
  if (cli.db.mdb)                           conf.mdb = cli.db.mdb;
  if (cli.isolate)                          conf.isolate = cli.isolate;
  if (cli.timeout)                          conf.timeout = cli.timeout;
  if (cli.forksize != null)                 conf.forksize = cli.forksize;

  // Specific internal settings
  conf.createNext = true;
  return _(conf).extend({routing: true});
}

/**
 * Super basic server with only its home path set
 * @param program
 * @param callback
 * @param useDefaultConf
 * @returns {Function}
 */
function server(program, callback, useDefaultConf) {
  return function () {
    var cbArgs = arguments;
    var dbName = program.mdb || "duniter_default";
    var dbHome = program.home;

    const home = directory.getHome(dbName, dbHome);
    var server = duniter(home, program.memory === true, commandLineConf(program));

    cbArgs.length--;
    cbArgs[cbArgs.length++] = server;
    cbArgs[cbArgs.length++] = server.conf;
    return callback.apply(this, cbArgs);
  };
}

function parsePercent(s) {
  var f = parseFloat(s);
  return isNaN(f) ? 0 : f;
}

function needsToBeLaunchedByScript() {
    logger.error('This command must not be launched directly, using duniter.sh script');
    return Promise.resolve();
}

function configure(program, server, conf) {
  return co(function *() {
    if (typeof server == "string" || typeof conf == "string") {
      throw constants.ERRORS.CLI_CALLERR_CONFIG;
    }
    let wiz = wizard();
    // UPnP override
    if (program.noupnp === true) {
      conf.upnp = false;
    }
    if (program.upnp === true) {
      conf.upnp = true;
    }
    // Network autoconf
    const autoconfNet = program.autoconf
      || !(conf.ipv4 || conf.ipv6)
      || !(conf.remoteipv4 || conf.remoteipv6 || conf.remotehost)
      || !(conf.port && conf.remoteport);
    if (autoconfNet) {
      yield Q.nbind(wiz.networkReconfiguration, wiz)(conf, autoconfNet, program.noupnp);
    }
    const hasSaltPasswdKey = conf.salt && conf.passwd;
    const hasKeyPair = conf.pair && conf.pair.pub && conf.pair.sec;
    const autoconfKey = program.autoconf || (!hasSaltPasswdKey && !hasKeyPair);
    if (autoconfKey) {
      yield Q.nbind(wiz.keyReconfigure, wiz)(conf, autoconfKey);
    }
    // Try to add an endpoint if provided
    if (program.addep) {
      if (conf.endpoints.indexOf(program.addep) === -1) {
        conf.endpoints.push(program.addep);
      }
      // Remove it from "to be removed" list
      const indexInRemove = conf.rmEndpoints.indexOf(program.addep);
      if (indexInRemove !== -1) {
        conf.rmEndpoints.splice(indexInRemove, 1);
      }
    }
    // Try to remove an endpoint if provided
    if (program.remep) {
      if (conf.rmEndpoints.indexOf(program.remep) === -1) {
        conf.rmEndpoints.push(program.remep);
      }
      // Remove it from "to be added" list
      const indexInToAdd = conf.endpoints.indexOf(program.remep);
      if (indexInToAdd !== -1) {
        conf.endpoints.splice(indexInToAdd, 1);
      }
    }
    return server.dal.saveConf(conf)
      .then(function () {
        try {
          logger.debug("Configuration saved.");
          return conf;
        } catch (e) {
          logger.error("Configuration could not be saved: " + e);
          throw Error(e);
        }
      });
  });
}
