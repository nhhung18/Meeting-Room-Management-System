import { describe, test, expect } from 'vitest';
import { mapAuth0Role } from './roleMapper';

describe('mapAuth0Role', () => {
  test('maps Administrator to ADMINISTRATOR', () => {
    expect(mapAuth0Role(['Administrator'])).toBe('ADMINISTRATOR');
  });

  test('maps Room Manager to ROOM_MANAGER', () => {
    expect(mapAuth0Role(['Room Manager'])).toBe('ROOM_MANAGER');
  });

  test('maps Employee to EMPLOYEE', () => {
    expect(mapAuth0Role(['Employee'])).toBe('EMPLOYEE');
  });

  test('defaults to EMPLOYEE for unknown roles', () => {
    expect(mapAuth0Role([])).toBe('EMPLOYEE');
    expect(mapAuth0Role(['SomeOtherRole'])).toBe('EMPLOYEE');
  });

  test('picks highest privilege when multiple roles present', () => {
    expect(mapAuth0Role(['Employee', 'Administrator'])).toBe('ADMINISTRATOR');
    expect(mapAuth0Role(['Employee', 'Room Manager'])).toBe('ROOM_MANAGER');
  });
});
