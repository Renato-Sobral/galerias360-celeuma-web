// next.config.mjs

/** @type {import('next').NextConfig} */
const nextConfig = {
  //output: 'export', // 👈 habilita exportação estática
  async redirects() {
    return [
      {
        source: "/dashboard/:path*",
        destination: "/login",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;