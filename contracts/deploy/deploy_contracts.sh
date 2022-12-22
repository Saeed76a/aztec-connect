#!/bin/bash
set -e

# Do not deploy if a mainnet deployment
case $VERSION_TAG in
  testnet)
    export ETHEREUM_HOST=$TF_VAR_TEST_NET_RPC_URL
    export PRIVATE_KEY=$TF_VAR_TEST_NET_ROOT_PRIVATE_KEY
    export DEPLOYER_ADDRESS=$TF_VAR_TEST_NET_DEPLOYER_ADDRESS 
    ;;
  dev)
    export ETHEREUM_HOST=$TF_VAR_DEV_NET_RPC_URL
    export PRIVATE_KEY=$TF_VAR_DEV_NET_ROOT_PRIVATE_KEY
    export DEPLOYER_ADDRESS=$TF_VAR_DEV_NET_DEPLOYER_ADDRESS 
    ;;
  *)
    echo "No configuration for VERSION_TAG=$VERSION_TAG, skipping contract deployment."
    exit 0
    ;;
esac

LAST_COMMIT=$(last_successful_commit contracts $DEPLOY_TAG-deployed)

if [ -z "$LAST_COMMIT" ]; then
  echo "No successful last deploy found. Change .redeploy to manually trigger a deployment."
elif changed $LAST_COMMIT "contracts/deploy/$VERSION_TAG"; then
  echo "Redeploying contracts..."

  if [[ $ETHEREUM_HOST == *"tenderly"* ]]; then
    # If on a tenderly fork, increase the balance of the Deployer, faucet and rollup provider, 24 is the number of 0s of eth to provide the account
    ./deploy/tenderly_increase_balance.sh $ETHEREUM_HOST 24 "\"$DEPLOYER_ADDRESS\",\"$TF_VAR_FAUCET_OPERATOR_ADDRESS\""
  fi 

  mkdir -p serve
  # Contract addresses will be mounted in the serve directory
  docker run \
    -v $(pwd)/serve:/usr/src/contracts/serve \
    -e ETHEREUM_HOST=$ETHEREUM_HOST -e PRIVATE_KEY=$PRIVATE_KEY -e DEPLOY_CONTRACTS=true -e UPGRADE=true -e network=None -e simulateAdmin=false \
    278380418400.dkr.ecr.eu-west-2.amazonaws.com/contracts:$COMMIT_HASH

  # Write the contract addresses as terraform variables 
  for KEY in ROLLUP_CONTRACT_ADDRESS PERMIT_HELPER_CONTRACT_ADDRESS GAS_PRICE_FEED_CONTRACT_ADDRESS DAI_PRICE_FEED_CONTRACT_ADDRESS FEE_DISTRIBUTOR_ADDRESS BRIDGE_DATA_PROVIDER_CONTRACT_ADDRESS; do
    VALUE=$(jq -r .$KEY ./serve/contract_addresses.json)
    export TF_VAR_$KEY=$VALUE
  done
  export TF_VAR_PRICE_FEED_CONTRACT_ADDRESSES="$TF_VAR_GAS_PRICE_FEED_CONTRACT_ADDRESS,$TF_VAR_DAI_PRICE_FEED_CONTRACT_ADDRESS" 

  # Write state variables
  deploy_terraform contracts
fi

tag_remote_image contracts cache-$COMMIT_HASH cache-$COMMIT_HASH-$DEPLOY_TAG-deployed