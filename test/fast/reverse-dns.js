const co = require('co');
const should = require('should');
const network = require('../../app/lib/system/network');

describe('DNS', () => {

  it('should be able to resolve a DNS for IP of duniter.org', () => co(function *() {
    const dnsName = yield network.getReverseDNS("51.255.197.83");
    should.exist(dnsName);
    dnsName.should.equal('83.ip-51-255-197.eu');
  }));
});
