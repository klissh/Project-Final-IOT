import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.5"], // Allow access from mobile/local network device
};

export default nextConfig;
