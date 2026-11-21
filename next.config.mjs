/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // The database drivers are loaded at run time, not bundled.
  serverExternalPackages: ['postgres', '@electric-sql/pglite', 'mysql2'],
  // cPanel hosting runs a self-contained build (STANDALONE=1 npm run build).
  ...(process.env.STANDALONE ? { output: 'standalone' } : {}),
  async headers() {
    return [
      // Preview deployment: keep search engines out until launch.
      // Demo and staging copies stay out of search engines; the live address (sosfoundation.org.pk) does not send this.
      { source: '/(.*)', missing: [{ type: 'host', value: '(www\\.)?sosfoundation\\.org\\.pk' }], headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
      { source: '/assets/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800' }] },
    ];
  },
};
export default nextConfig;
