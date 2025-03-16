#!/bin/bash

nft add table nat && \
  nft add chain nat postrouting { type nat hook postrouting priority 100 \; } && \
  nft add rule nat postrouting oifname 'eth1' masquerade
