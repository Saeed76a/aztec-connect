import { createEthSdk, EthereumSdk, EthereumSdkUser, EthAddress, EthereumProvider, EthersAdapter } from 'aztec2-sdk';
import { randomBytes } from 'crypto';
import { EventEmitter } from 'events';
import { JsonRpcProvider } from '@ethersproject/providers';

jest.setTimeout(10 * 60 * 1000);
EventEmitter.defaultMaxListeners = 30;

const { ETHEREUM_HOST = 'http://localhost:8545', ROLLUP_HOST = 'http://localhost:8081' } = process.env;

describe('end-to-end account tests', () => {
  let provider: EthereumProvider;
  let sdk: EthereumSdk;
  let userAddress: EthAddress;
  let users: EthereumSdkUser[];

  beforeAll(async () => {
    // Init sdk.
    const ethersProvider = new JsonRpcProvider(ETHEREUM_HOST);
    provider = new EthersAdapter(ethersProvider);
    sdk = await createEthSdk(provider, ROLLUP_HOST, {
      syncInstances: false,
      saveProvingKey: false,
      clearDb: true,
      dbPath: ':memory:',
    });
    await sdk.init();
    await sdk.awaitSynchronised();

    // Get accounts and signers.
    userAddress = EthAddress.fromString((await ethersProvider.listAccounts())[0]);
    await sdk.addUser(userAddress);
  });

  afterAll(async () => {
    await sdk.destroy();
  });

  it('should create and recover account, add and remove signing keys.', async () => {
    const thirdPartySigner = sdk.createSchnorrSigner(randomBytes(32));
    const recoveryPayloads = await users[0].generateAccountRecoveryData([thirdPartySigner.getPublicKey()]);

    // Create a new account.
    const alias = 'pebble';
    const userSigner = sdk.createSchnorrSigner(randomBytes(32));
    const { recoveryPublicKey } = recoveryPayloads[0];
    const txHash = await users[0].createAccount(userSigner.getPublicKey(), recoveryPublicKey, alias);
    await sdk.awaitSettlement(userAddress, txHash, 300);

    expect(await sdk.getAddressFromAlias(alias)).toEqual(users[0].getUserData().publicKey);

    // Recover account.
    const recoverTxHash = await users[0].recoverAccount(recoveryPayloads[0]);
    await sdk.awaitSettlement(userAddress, recoverTxHash, 300);

    // Add new signing key.
    const newSigner = sdk.createSchnorrSigner(randomBytes(32));
    const addKeyTxHash = await users[0].addSigningKey(newSigner.getPublicKey(), thirdPartySigner);
    await sdk.awaitSettlement(userAddress, addKeyTxHash, 300);

    // Remove 3rd party's signing key.
    const removeTxHash = await users[0].removeSigningKey(thirdPartySigner.getPublicKey(), newSigner);
    await sdk.awaitSettlement(userAddress, removeTxHash, 300);

    // Should not be able to do anything if key is removed.
    const anotherSigner = sdk.createSchnorrSigner(randomBytes(32));
    await expect(users[0].addSigningKey(anotherSigner.getPublicKey(), thirdPartySigner)).rejects.toThrow();
  });
});
