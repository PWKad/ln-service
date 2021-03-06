const {test} = require('tap');

const closeChannel = require('./../../closeChannel');
const {createCluster} = require('./../macros');
const {delay} = require('./../macros');
const getChannels = require('./../../getChannels');
const getPeers = require('./../../getPeers');
const getPendingChannels = require('./../../getPendingChannels');
const openChannel = require('./../../openChannel');

const channelCapacityTokens = 1e6;
const confirmationCount = 20;
const defaultFee = 1e3;
const defaultVout = 0;
const giftTokens = 1e4;
const spendableRatio = 0.99;

// Getting pending channels should show pending channels
test(`Get pending channels`, async ({end, equal}) => {
  const cluster = await createCluster({});

  const {lnd} = cluster.control;

  await delay(3000);

  const coopChan = await openChannel({
    lnd,
    chain_fee_tokens_per_vbyte: defaultFee,
    give_tokens: giftTokens,
    local_tokens: channelCapacityTokens,
    partner_public_key: cluster.target_node_public_key,
    socket: `${cluster.target.listen_ip}:${cluster.target.listen_port}`,
  });

  await delay(3000);

  await cluster.generate({count: confirmationCount});

  await delay(3000);

  const niceClose = await closeChannel({
    lnd: cluster.target.lnd,
    public_key: cluster.target_node_public_key,
    socket: `${cluster.target.listen_ip}:${cluster.target.listen_port}`,
    tokens_per_vbyte: defaultFee,
    transaction_id: coopChan.transaction_id,
    transaction_vout: coopChan.transaction_vout,
  });

  await delay(3000);

  await cluster.generate({count: 6, node: cluster.target});

  const [coopClose] = (await getPendingChannels({lnd})).pending_channels;

  equal(coopClose.close_transaction_id, niceClose.transaction_id, 'End tx id');
  equal(coopClose.is_active, false, 'Ended');
  equal(coopClose.is_closing, true, 'Closing');
  equal(coopClose.is_opening, false, 'Not Opening');
  equal(coopClose.local_balance, 979950, 'Original balance');
  equal(coopClose.partner_public_key, cluster.target_node_public_key, 'pubk');
  equal(coopClose.pending_balance, undefined, 'Not waiting on balance');
  equal(coopClose.received, 0, 'Never received');
  equal(coopClose.recovered_tokens, undefined, 'Nothing to recover in sweep');
  equal(coopClose.remote_balance, 0, 'Opposing channel balance nil');
  equal(coopClose.sent, 0, 'Never sent anything');
  equal(coopClose.timelock_expiration, undefined, 'No timelock in coop mode');
  equal(coopClose.transaction_id, coopChan.transaction_id, 'funding tx id');
  equal(coopClose.transaction_vout, coopChan.transaction_vout, 'funding vout');
  equal(coopClose.type, 'channel', 'Cooperative closing channel is a channel');

  await cluster.kill({});

  return end();
});

