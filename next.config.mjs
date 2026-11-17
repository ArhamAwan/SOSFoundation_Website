/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // The database drivers are loaded at run time, not bundled.
  serverExternalPackages: ['postgres', '@electric-sql/pglite'],
  async headers() {
    return [
      // Preview deployment: keep search engines out until launch.
      { source: '/(.*)', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
      { source: '/assets/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800' }] },
    ];
  },
};
export default nextConfig;
