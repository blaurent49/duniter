var sha1      = require('sha1');
var async     = require('async');
var merkle    = require('./merkle');
var mongoose  = require('mongoose');
var Amendment = mongoose.model('Amendment');

function Contract(currencyName, initKeys) {

  this.length = 0;
  this.currency = currencyName;
  this.initKeys = initKeys;
  this.monetaryMass = 0;
  this.members = [];
  this.voters = [];
  this.currentHash = "";

  // PUBLIC
  this.feed = function(rawAmendment, done) {
    var obj = this;
    var am = new Amendment();
    am.parse(rawAmendment, function(err) {
      if(!err){
        am.verify(obj.currency, function(errMessage, errCode) {

          var tmpMembers = obj.members.slice();
          var tmpVoters = obj.voters.slice();

          if(!errMessage){

            /*********************************************/
            /*********** Integrity constraints ***********/
            /*********************************************/

            async.waterfall([
              function(callback){

                // 1) Number
                if(parseInt(am.number,10) !== obj.length){
                  callback("Amendment number must be '" + obj.length + "' to be accepted");
                }
                else callback();
              },
              function(callback){

                // 2) Hash
                if(am.number != "0" && am.previousHash != obj.currentHash){
                  callback("Previous hash '" + am.previousHash + "' does not match with current hash of Contract whose value is '" + obj.currentHash + "'");
                }
                else callback();
              },
              function(callback){

                // 3) Merkle of members
                var leavingMembers = am.getLeavingMembers();
                for(i = 0; i < leavingMembers.length; i++){
                  var index = tmpMembers.indexOf(leavingMembers[i]);
                  if(index !== -1)
                    tmpMembers.splice(index, 1);
                  else{
                    callback("Leaving member '"+ leavingMembers[i] + "' was already not in the members list");
                    return;
                  }
                }
                var joiningMembers = am.getNewMembers();
                for(i = 0; i < joiningMembers.length; i++){
                  tmpMembers.push(joiningMembers[i]);
                }
                tmpMembers.sort();

                // Merkle checking
                membersMerkle = merkle(tmpMembers);
                membersMerkle.process(function (err) {
                  if(!err){
                    if(am.membersRoot !== membersMerkle.getRoot())
                      err = "Computed members Merkle '" + membersMerkle.getRoot() + "' does not match Amendment '" + am.membersRoot + "'";
                  }
                  callback(err);
                });
              },
              function(callback){

                // 4) Merkle of voters
                var leavingVoters = am.getLeavingVoters();
                for(i = 0; i < leavingVoters.length; i++){
                  var index = tmpVoters.indexOf(leavingVoters[i]);
                  if(index !== -1)
                    tmpVoters.splice(index, 1);
                  else{
                    callback("Leaving voter '"+ leavingVoters[i] + "' was already not in the voters list");
                    return;
                  }
                  tmpVoters.splice(index, 1);
                }
                var joiningVoters = am.getNewVoters();
                for(i = 0; i < joiningVoters.length; i++){
                  tmpVoters.push(joiningVoters[i]);
                }
                tmpVoters.sort();

                // Merkle checking
                votersMerkle = merkle(tmpVoters);
                votersMerkle.process(function (err) {
                  if(!err){
                    if(am.votersRoot !== votersMerkle.getRoot())
                      err = "Computed voters Merkle '" + votersMerkle.getRoot() + "' does not match Amendment '" + am.votersRoot + "'";
                  }
                  callback(err);
                });
              },
              function(callback){

                // 5) Voting acceptation
                // Case : Amendment 0
                //  * MembersChanges == VotersChanges == initKeys
                if(am.number == "0"){
                  if(am.votersRoot != am.membersRoot){
                    callback("First amendment requires to have the same keys as members and voters.");
                  }
                  else{
                    var initKeysMerkle = merkle(obj.initKeys);
                    initKeysMerkle.process(function (err) {
                      if(!err){
                        if(am.membersRoot !== initKeysMerkle.getRoot())
                          err = "Members must be the same keys as the initKeys used for this server.";
                      }
                      callback(err);
                    });
                  }
                }
                // Case : Amendment 1+
                //  * '-' changes count must be <= (1/3 voters )
                if(am.number != "0"){
                  var leavingVoters = am.getLeavingVoters();
                  if(leavingVoters.length > (1/3) * obj.voters.length)
                    err = "It is required to have at least the approval of 2/3 of the previous voters.";
                  callback(err);
                }
              }
            ], function (err) {

              if(!err){
                // Application of the amendment
                obj.members = tmpMembers;
                obj.voters = tmpVoters;
                if(am.dividend){
                  obj.monetaryMass += obj.members.length * parseInt(am.dividend, 10);
                }
                obj.currentHash = sha1(am.getRaw()).toUpperCase();
                obj.length++;
                done();
              }
              else done(err);
            });
          }
          else done(error(errMessage, errCode));
        });
      }
      else done(error(err));
    });
  };

  function error(message, code) {
    var err = message;
    if(code)
      message += " (" + code + ")";
    return err;
  }

  this.feedAll = function (amendments, done) {
    // Loading Monetary Contract
    var obj = this;
    async.forEachSeries(amendments, function (am, callback) {
      obj.feed(am.getRaw(), callback);
    }, done);
  };
}

module.exports = function (currencyName, initKeys) {
  return new Contract(currencyName, initKeys);
};