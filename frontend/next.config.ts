import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';
import path from 'node:path';

const apiProxyTarget = (process.env.API_PROXY_TARGET ?? 'http://localhost:3000').replace(/\/+$/u, '');

export default function nextConfig(phase: string): NextConfig {
  return {
    output: 'standalone',
    outputFileTracingRoot: path.resolve(process.cwd(), '..'),
    // Uploads are streamed through the Next proxy and may be as large as 1 GiB.
    experimental: { middlewareClientMaxBodySize: '1gb' },
    // Keep the running development server independent from production builds and E2E tests.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
    async rewrites() {
      return [
        { source: '/api/:path*', destination: `${apiProxyTarget}/api/:path*` },
        { source: '/graphql', destination: `${apiProxyTarget}/graphql` },
      ];
    },
  };
}
