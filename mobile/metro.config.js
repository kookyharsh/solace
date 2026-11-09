/* eslint-disable @typescript-eslint/no-require-imports -- Metro loads this config as CommonJS. */
const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

module.exports = withUniwindConfig(getDefaultConfig(__dirname), {
  cssEntryFile: './global.css',
});
