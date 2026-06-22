const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Exclude jest temporary directories that Metro tries to watch and fails on
config.watchFolders = (config.watchFolders ?? []).filter(Boolean);
config.resolver = {
  ...config.resolver,
  blockList: [
    // Block jest globals temp dirs — they're created/deleted during installs
    /node_modules\/\.pnpm\/@jest\+globals@[^/]+\/node_modules\/@jest\/globals_tmp_.*/,
  ],
};

module.exports = config;
