/**
 * This script creates a wallet if none exists, and unlocks the wallet if it does exist
 * We determine if a wallet exists by checking if a password.txt file exists at /root/password.txt
 * In order for LND to run properly, this script must be invoked when the container starts
 *
 * After this script is run, the following files will exist:
 * /root/password.txt
 * /root/mnemonic.txt
 */

const fs = require('fs');
const request = require('request');
const passwordFile = '/root/password.txt';
const mnemonicFile = '/root/mnemonic.txt';
const urlname = process.argv[2];
const restport = process.argv[3];
function convertToBytes(x) {return x.charCodeAt(0);}
let password, endpoint;
let unlocked = false;
let waitBackoff = 6000;
const timeout = 3000;

if (fs.existsSync(passwordFile)) {
  password = fs.readFileSync(passwordFile).toString();
  endpoint = 'unlockwallet';
} else {
  password = Math.random()*100000000000000000 + '' + Math.random()*100000000000000000;
  fs.writeFileSync(passwordFile, password);
  endpoint = 'initwallet';
}

const requestBody = {
  wallet_password: password.split('').map(convertToBytes)
};

const getOptions = (endpoint) => {
  return {
    url: 'https://' + urlname + ':' + restport + '/v1/' + endpoint,
    rejectUnauthorized: false,
    json: true,
    timeout
  };
}

const makeRequest = () => {
  if (!unlocked) console.log('Attempting to ' + endpoint + ' at ' + urlname + ':' + restport);
  const options = getOptions(endpoint);
  if (endpoint === 'initwallet') {
    endpoint = 'unlockwallet'; // once we init the wallet, all ensuing attempts should be unlock attempts.
  }
  options.form = JSON.stringify(requestBody);
  request.post(options, function(error, response, body) {
    if (error && error !== 'Not Found') {
      console.log(error);
    } else if (body && !unlocked) {
      console.log(body);
      unlocked = true;
    }
    setTimeout(makeRequest, waitBackoff);
  });
}

const genSeedThenInit = () => {
  const options = getOptions('genseed');
  console.log('Attempting to generate seed');
  request.get(options, function(error, response, body) {
    requestBody.cipher_seed_mnemonic = body.cipher_seed_mnemonic;
    fs.writeFileSync(mnemonicFile, JSON.stringify(body.cipher_seed_mnemonic));
    makeRequest();
  });
}

if (endpoint === 'initwallet') {
  setTimeout(genSeedThenInit, waitBackoff);
} else {
  setTimeout(makeRequest, waitBackoff);
}

