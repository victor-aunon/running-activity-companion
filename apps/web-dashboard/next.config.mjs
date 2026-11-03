/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const relayPort = process.env.WS_PORT || '3001';
    return [
      {
        source: '/api/session/stream',
        destination: `http://127.0.0.1:${relayPort}/api/session/stream`,
      },
      {
        source: '/api/session/cheer',
        destination: `http://127.0.0.1:${relayPort}/api/session/cheer`,
      },
      {
        source: '/api/session/path',
        destination: `http://127.0.0.1:${relayPort}/api/session/path`,
      },
    ];
  },
  webpack: (config) => {
    config.watchOptions = {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/apps/android-companion/**',
        '**/apps/garmin-fenix7s/**',
        '**/specs/**',
      ],
    };
    return config;
  },
};

export default nextConfig;
