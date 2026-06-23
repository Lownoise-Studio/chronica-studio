// Jest mock for expo-file-system/build/legacy
// Engine tests don't use file system; this prevents module resolution errors.
module.exports = {
  documentDirectory: '/mock/documents/',
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  copyAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  readAsStringAsync: jest.fn().mockResolvedValue(''),
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true }),
};
