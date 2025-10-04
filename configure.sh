#!/bin/sh

(cd ./contract && forge install foundry-rs/forge-std)
(cd ./frontend && npm install)
(cd ./indexer/ && npm install)
