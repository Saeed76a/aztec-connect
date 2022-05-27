import { AccountId } from '@aztec/barretenberg/account_id';
import { GrumpkinAddress } from '@aztec/barretenberg/address';
import { EventEmitter } from 'events';
import { LevelUp } from 'levelup';
import { CoreSdkOptions, CoreSdkSerializedInterface, CoreSdkServerStub, SdkEvent } from '../../core_sdk';
import { NoteJson } from '../../note';
import {
  accountProofInputFromJson,
  AccountProofInputJson,
  joinSplitProofInputFromJson,
  JoinSplitProofInputJson,
  proofOutputFromJson,
  ProofOutputJson,
} from '../../proofs';
import { MemorySerialQueue } from '../../serial_queue';

/**
 * Implements the standard CoreSdkSerializedInterface.
 * Check permission for apis that access user data.
 * If permission has been granted for the origin, it then forwards the calls onto a CoreSdkServerStub.
 */
export class CaramelCoreSdk extends EventEmitter implements CoreSdkSerializedInterface {
  private serialQueue = new MemorySerialQueue();

  constructor(private core: CoreSdkServerStub, private origin: string, private leveldb: LevelUp) {
    super();

    // Broadcast all core sdk events.
    for (const e in SdkEvent) {
      const event = (SdkEvent as any)[e];
      this.core.on(event, (...args: any[]) => this.emit(event, ...args));
    }
  }

  public async init(options: CoreSdkOptions) {
    await this.core.init(options);
  }

  public async run() {
    await this.core.run();
  }

  public async destroy() {
    await this.core.destroy();
    await this.leveldb.close();
  }

  public async getLocalStatus() {
    return this.core.getLocalStatus();
  }

  public async getRemoteStatus() {
    return this.core.getRemoteStatus();
  }

  public async getTxFees(assetId: number) {
    return this.core.getTxFees(assetId);
  }

  public async getDefiFees(bridgeId: string) {
    return this.core.getDefiFees(bridgeId);
  }

  public async getLatestAccountNonce(publicKey: string) {
    return this.core.getLatestAccountNonce(publicKey);
  }

  public async getRemoteLatestAccountNonce(publicKey: string) {
    return this.core.getLatestAccountNonce(publicKey);
  }

  public async getLatestAliasNonce(alias: string) {
    return this.core.getLatestAliasNonce(alias);
  }

  public async getRemoteLatestAliasNonce(alias: string) {
    return this.core.getRemoteLatestAliasNonce(alias);
  }

  public async getAccountId(alias: string, accountNonce?: number) {
    return this.core.getAccountId(alias, accountNonce);
  }

  public async getRemoteAccountId(alias: string, accountNonce?: number) {
    return this.core.getRemoteAccountId(alias, accountNonce);
  }

  public async isAliasAvailable(alias: string) {
    return this.core.isAliasAvailable(alias);
  }

  public async isRemoteAliasAvailable(alias: string) {
    return this.core.isRemoteAliasAvailable(alias);
  }

  public async computeAliasHash(alias: string) {
    return this.core.computeAliasHash(alias);
  }

  public async createDepositProof(
    assetId: number,
    publicInput: string,
    privateOutput: string,
    noteRecipient: string,
    publicOwner: string,
    txRefNo: number,
  ) {
    return this.core.createDepositProof(assetId, publicInput, privateOutput, noteRecipient, publicOwner, txRefNo);
  }

  public async createPaymentProofInput(
    userId: string,
    assetId: number,
    publicInput: string,
    publicOutput: string,
    privateInput: string,
    recipientPrivateOutput: string,
    senderPrivateOutput: string,
    noteRecipient: string | undefined,
    publicOwner: string | undefined,
    spendingPublicKey: string,
    allowChain: number,
  ) {
    await this.checkPermission(userId);
    return this.core.createPaymentProofInput(
      userId,
      assetId,
      publicInput,
      publicOutput,
      privateInput,
      recipientPrivateOutput,
      senderPrivateOutput,
      noteRecipient,
      publicOwner,
      spendingPublicKey,
      allowChain,
    );
  }

  public async createPaymentProof(input: JoinSplitProofInputJson, txRefNo: number) {
    const {
      tx: { outputNotes },
    } = joinSplitProofInputFromJson(input);
    const userId = new AccountId(outputNotes[1].ownerPubKey, outputNotes[1].accountNonce);
    await this.checkPermission(userId.toString());
    return this.core.createPaymentProof(input, txRefNo);
  }

  public async createAccountProofSigningData(
    signingPubKey: string,
    alias: string,
    accountNonce: number,
    migrate: boolean,
    accountPublicKey: string,
    newAccountPublicKey?: string,
    newSigningPubKey1?: string,
    newSigningPubKey2?: string,
  ) {
    return this.core.createAccountProofSigningData(
      signingPubKey,
      alias,
      accountNonce,
      migrate,
      accountPublicKey,
      newAccountPublicKey,
      newSigningPubKey1,
      newSigningPubKey2,
    );
  }

  public async createAccountProofInput(
    userId: string,
    aliasHash: string,
    migrate: boolean,
    signingPublicKey: string,
    newSigningPublicKey1: string | undefined,
    newSigningPublicKey2: string | undefined,
    newAccountPrivateKey: Uint8Array | undefined,
  ) {
    // TODO: Uncomment after new accounting system.
    // await this.checkPermission(userId);
    return this.core.createAccountProofInput(
      userId,
      aliasHash,
      migrate,
      signingPublicKey,
      newSigningPublicKey1,
      newSigningPublicKey2,
      newAccountPrivateKey,
    );
  }

  public async createAccountProof(input: AccountProofInputJson, txRefNo: number) {
    const {
      tx: { accountAliasId, accountPublicKey },
    } = accountProofInputFromJson(input);
    const userId = new AccountId(accountPublicKey, accountAliasId.accountNonce);
    await this.checkPermission(userId.toString());
    return this.core.createAccountProof(input, txRefNo);
  }

  public async createDefiProofInput(
    userId: string,
    bridgeId: string,
    depositValue: string,
    inputNotes: NoteJson[],
    spendingPublicKey: string,
  ) {
    await this.checkPermission(userId);
    return this.core.createDefiProofInput(userId, bridgeId, depositValue, inputNotes, spendingPublicKey);
  }

  public async createDefiProof(input: JoinSplitProofInputJson, txRefNo: number) {
    const {
      tx: { outputNotes },
    } = joinSplitProofInputFromJson(input);
    const userId = new AccountId(outputNotes[1].ownerPubKey, outputNotes[1].accountNonce);
    await this.checkPermission(userId.toString());
    return this.core.createDefiProof(input, txRefNo);
  }

  public async sendProofs(proofs: ProofOutputJson[]) {
    // TODO: Add back once new accounting system.
    // const {
    //   tx: { userId },
    // } = proofOutputFromJson(proofs[0]);
    // await this.checkPermission(userId.toString());
    return this.core.sendProofs(proofs);
  }

  public async awaitSynchronised() {
    await this.core.awaitSynchronised();
  }

  public async isUserSynching(userId: string) {
    await this.checkPermission(userId);
    return this.core.isUserSynching(userId);
  }

  public async awaitUserSynchronised(userId: string) {
    await this.checkPermission(userId);
    await this.core.awaitUserSynchronised(userId);
  }

  public async awaitSettlement(txId: string, timeout?: number) {
    await this.core.awaitSettlement(txId, timeout);
  }

  public async awaitDefiDepositCompletion(txId: string, timeout?: number) {
    await this.core.awaitDefiDepositCompletion(txId, timeout);
  }

  public async awaitDefiFinalisation(txId: string, timeout?: number) {
    await this.core.awaitDefiFinalisation(txId, timeout);
  }

  public async awaitDefiSettlement(txId: string, timeout?: number) {
    await this.core.awaitDefiSettlement(txId, timeout);
  }

  public async getDefiInteractionNonce(txId: string) {
    return this.core.getDefiInteractionNonce(txId);
  }

  public async userExists(userId: string) {
    return (await this.hasPermission(userId)) && (await this.core.userExists(userId));
  }

  public async getUserData(userId: string) {
    await this.checkPermission(userId);
    return this.core.getUserData(userId);
  }

  public async getUsersData() {
    const usersData = await this.core.getUsersData();
    const permissions = await Promise.all(usersData.map(u => this.hasPermission(u.id)));
    return usersData.filter((_, i) => permissions[i]);
  }

  public async derivePublicKey(privateKey: Uint8Array) {
    return this.core.derivePublicKey(privateKey);
  }

  public async constructSignature(message: Uint8Array, privateKey: Uint8Array) {
    return this.core.constructSignature(message, privateKey);
  }

  public async addUser(privateKey: Uint8Array, accountNonce?: number, noSync?: boolean) {
    return this.serialQueue.push(async () => {
      let addUserError: Error;
      try {
        const userData = await this.core.addUser(privateKey, accountNonce, noSync);
        await this.addPermission(userData.id);
        return userData;
      } catch (e: any) {
        // User probably already exists.
        addUserError = e;
      }

      // Get user data.
      // It will throw if the user doesn't exist, which means something went wrong while calling core.addUser().
      const publicKey = await this.core.derivePublicKey(privateKey);
      const nonce = accountNonce ?? (await this.core.getLatestAccountNonce(publicKey));
      const userId = new AccountId(GrumpkinAddress.fromString(publicKey), nonce).toString();
      try {
        const userData = await this.core.getUserData(userId);
        await this.addPermission(userId);
        return userData;
      } catch (e) {
        throw addUserError;
      }
    });
  }

  public async removeUser(userId: string) {
    return this.serialQueue.push(async () => {
      await this.checkPermission(userId);
      const domains = await this.getUserDomains(userId);
      if (domains.length === 1) {
        await this.core.removeUser(userId);
      }
      await this.removePermission(userId);
    });
  }

  public async getSigningKeys(userId: string) {
    await this.checkPermission(userId);
    return this.core.getSigningKeys(userId);
  }

  public async getBalances(userId: string) {
    await this.checkPermission(userId);
    return this.core.getBalances(userId);
  }

  public async getBalance(assetId: number, userId: string) {
    await this.checkPermission(userId);
    return this.core.getBalance(assetId, userId);
  }

  public async getSpendableSum(assetId: number, userId: string, excludePendingNotes?: boolean) {
    await this.checkPermission(userId);
    return this.core.getSpendableSum(assetId, userId, excludePendingNotes);
  }

  public async getSpendableSums(userId: string, excludePendingNotes?: boolean) {
    await this.checkPermission(userId);
    return this.core.getSpendableSums(userId, excludePendingNotes);
  }

  public async getMaxSpendableValue(assetId: number, userId: string, numNotes?: number, excludePendingNotes?: boolean) {
    await this.checkPermission(userId);
    return this.core.getMaxSpendableValue(assetId, userId, numNotes, excludePendingNotes);
  }

  public async pickNotes(userId: string, assetId: number, value: string, excludePendingNotes?: boolean) {
    await this.checkPermission(userId);
    return this.core.pickNotes(userId, assetId, value, excludePendingNotes);
  }

  public async pickNote(userId: string, assetId: number, value: string, excludePendingNotes?: boolean) {
    await this.checkPermission(userId);
    return this.core.pickNote(userId, assetId, value, excludePendingNotes);
  }

  public async getUserTxs(userId: string) {
    await this.checkPermission(userId);
    return this.core.getUserTxs(userId);
  }

  public async getRemoteUnsettledAccountTxs() {
    return this.core.getRemoteUnsettledAccountTxs();
  }

  public async getRemoteUnsettledPaymentTxs() {
    return this.core.getRemoteUnsettledPaymentTxs();
  }

  private async checkPermission(userId: string) {
    if (!(await this.hasPermission(userId))) {
      throw new Error(`User not permitted: ${userId}`);
    }
  }

  private async hasPermission(userId: string): Promise<boolean> {
    const domains = await this.getUserDomains(userId);
    return domains.includes(this.origin);
  }

  private async addPermission(userId: string) {
    const domains = await this.getUserDomains(userId);
    await this.updateUserDomains(userId, [...domains, this.origin]);
  }

  private async removePermission(userId: string) {
    const domains = (await this.getUserDomains(userId)).filter(d => d !== this.origin);
    await this.updateUserDomains(userId, domains);
  }

  private async updateUserDomains(userId: string, domains: string[]) {
    await this.leveldb.put(userId, Buffer.from(JSON.stringify(domains)));
  }

  private async getUserDomains(userId: string): Promise<string[]> {
    return this.leveldb
      .get(userId)
      .then(buf => JSON.parse(buf.toString()))
      .catch(() => []);
  }
}
