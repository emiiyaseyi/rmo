/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  allowedDevOrigins: ['dsnrmo.free-tunnelapi.app', 'http://localhost:3000'],
  experimental: {
    serverActions: {
      allowedOrigins: ['dsnrmo.free-tunnelapi.app'],
    },
  },
};

export default nextConfig;
