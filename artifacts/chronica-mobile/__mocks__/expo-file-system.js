module.exports = {
  File: jest.fn().mockImplementation(() => ({
    exists: true,
    info: jest.fn().mockReturnValue({ size: 0 }),
    bytes: jest.fn().mockResolvedValue(new Uint8Array()),
    create: jest.fn(),
    write: jest.fn(),
  })),
};
