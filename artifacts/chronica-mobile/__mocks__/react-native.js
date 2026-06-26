// Minimal jest mock for react-native — engine/storage tests only need Platform.OS.
module.exports = {
  Platform: { OS: 'ios', select: (obj) => obj.ios ?? obj.default },
};
