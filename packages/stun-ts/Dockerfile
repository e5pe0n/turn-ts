FROM ubuntu:latest AS base
RUN apt-get update && apt-get install -y nftables iproute2 ncat

FROM base AS router
RUN nft add table nat && \
    nft add chain nat postrouting { type nat hook postrouting priority 100 \; } && \
    nft add rule nat postrouting oifname 'eth1' masquerade

FROM base AS client
RUN ip route del default && \
    ip route add default via 172.19.100.200
