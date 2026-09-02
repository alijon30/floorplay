import { describe, it, expect } from 'vitest';
import { APP_NAME } from '../config';

describe('scaffold', () => {
  it('exposes the app name', () => {
    expect(APP_NAME).toBe('Floorplay');
  });
});
