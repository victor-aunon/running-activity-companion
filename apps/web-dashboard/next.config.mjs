/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
