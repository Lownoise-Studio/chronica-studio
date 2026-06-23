import {
  isUriLike,
  normalizeAssetUri,
  resolveAssetUri,
  resolveSceneAudioUri,
  resolveSceneBackgroundUri,
} from '../engine/asset-resolver';
import { ProjectAsset } from '../engine/types';

const assets: ProjectAsset[] = [
  {
    id: 'a1',
    name: 'forest.jpg',
    type: 'image',
    uri: 'file:///data/user/0/app/files/pse_assets/p1/forest.jpg',
    mimeType: 'image/jpeg',
    size: 1000,
    importedAt: '',
  },
  {
    id: 'a2',
    name: 'theme.mp3',
    type: 'audio',
    uri: 'file:///data/user/0/app/files/pse_assets/p1/theme.mp3',
    mimeType: 'audio/mpeg',
    size: 2000,
    importedAt: '',
  },
];

describe('normalizeAssetUri', () => {
  test('adds file:// prefix to absolute paths', () => {
    expect(normalizeAssetUri('/var/mobile/photo.jpg')).toBe(
      'file:///var/mobile/photo.jpg',
    );
  });

  test('preserves existing schemes', () => {
    expect(normalizeAssetUri('file:///already/file.jpg')).toBe(
      'file:///already/file.jpg',
    );
    expect(normalizeAssetUri('content://media/external/images/1')).toBe(
      'content://media/external/images/1',
    );
  });
});

describe('isUriLike', () => {
  test('detects uri-like strings', () => {
    expect(isUriLike('file:///x')).toBe(true);
    expect(isUriLike('/absolute/path')).toBe(true);
    expect(isUriLike('forest.jpg')).toBe(false);
  });
});

describe('resolveAssetUri', () => {
  test('resolves by asset name', () => {
    expect(resolveAssetUri(assets, 'forest.jpg')).toBe(
      'file:///data/user/0/app/files/pse_assets/p1/forest.jpg',
    );
  });

  test('resolves case-insensitively', () => {
    expect(resolveAssetUri(assets, 'Forest.JPG')).toBe(
      'file:///data/user/0/app/files/pse_assets/p1/forest.jpg',
    );
  });

  test('resolves by asset id', () => {
    expect(resolveAssetUri(assets, 'a1')).toBe(
      'file:///data/user/0/app/files/pse_assets/p1/forest.jpg',
    );
  });

  test('returns undefined for unknown name', () => {
    expect(resolveAssetUri(assets, 'missing.png')).toBeUndefined();
  });

  test('passes through raw uri references', () => {
    expect(resolveAssetUri([], '/tmp/direct.jpg')).toBe('file:///tmp/direct.jpg');
  });
});

describe('resolveSceneBackgroundUri', () => {
  test('ignores non-image assets', () => {
    expect(resolveSceneBackgroundUri(assets, 'theme.mp3')).toBeUndefined();
    expect(resolveSceneBackgroundUri(assets, 'forest.jpg')).toBeTruthy();
  });
});

describe('resolveSceneAudioUri', () => {
  test('ignores non-audio assets', () => {
    expect(resolveSceneAudioUri(assets, 'forest.jpg')).toBeUndefined();
    expect(resolveSceneAudioUri(assets, 'theme.mp3')).toBeTruthy();
  });
});
