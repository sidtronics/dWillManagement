#!/bin/sh

# Start local ethereum node (anvil)
anvil --quiet &

sleep 2

# Deploy contract
(
    cd ./contract && 
    forge script script/DecentralizedWillManager.s.sol \
    --rpc-url http://127.0.0.1:8545 --broadcast \
    --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
)

# Start indexer service
(cd ./indexer && rm -f wills.db && npm run dev) &

# Start frontend
(cd ./frontend && npm start)
