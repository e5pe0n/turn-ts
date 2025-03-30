type DefaultServerConfig = {
  // TODO: nonce should be generated randomly regularly
  nonce: string;
  host: string;
  port: number;
  software: string;
  maxLifetimeSec: number;
};

// TODO: enable to set config from environment variables
export const defaultServerConfig = {
  nonce: "nonce",
  host: "127.0.0.1",
  port: 3478,
  software: "@e5pe0n/turn-ts@0.0.0 server",
  maxLifetimeSec: 3600,
} as const satisfies DefaultServerConfig;
