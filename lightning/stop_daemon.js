const asyncAuto = require('async/auto');
const asyncRetry = require('async/retry');

const getWalletInfo = require('./get_wallet_info');
const {returnResult} = require('./../async-util');

const connectionFailureMessage = 'FailedToConnectToDaemon';
const interval = retryCount => 10 * Math.pow(2, retryCount);
const times = 10;

/** Stop the Lightning daemon.

  {
    lnd: <LND GRPC API Object>
  }
*/
module.exports = ({lnd}, cbk) => {
  return asyncAuto({
    // Check arguments
    validate: cbk => {
      if (!lnd || !lnd.stopDaemon) {
        return cbk([400, 'ExpectedLndToStopDaemon']);
      }

      return cbk();
    },

    // Stop the daemon
    stopDaemon: ['validate', ({}, cbk) => {
      return lnd.stopDaemon({}, err => {
        if (!!err) {
          return cbk([503, 'UnexpectedErrorStoppingLightningDaemon', err]);
        }

        return cbk();
      });
    }],

    // Poll wallet info until it fails to know when the daemon is really off
    waitForGetInfoFailure: ['stopDaemon', ({stopDaemon}, cbk) => {
      return asyncRetry({interval, times}, cbk => {
        return getWalletInfo({lnd}, err => {
          if (!Array.isArray(err)) {
            return cbk([503, 'FailedToStopDaemon']);
          }

          const [, message] = err;

          if (message !== 'FailedToConnectToDaemon') {
            return cbk([503, 'ExpectedDaemonShutdown']);
          }

          return cbk();
        });
      },
      cbk);
    }],
  },
  returnResult({}, cbk));
};

