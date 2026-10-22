/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:5001/api/:path*',
      },
      {
        source: '/signatures/:path*',
        destination: 'http://127.0.0.1:5001/signatures/:path*',
      },
    ];
  },
};

export default nextConfig;