import type { UserRole } from '../types';

const PRIORITY: [string, UserRole][] = [
  ['Administrator', 'ADMINISTRATOR'],
  ['Room Manager', 'ROOM_MANAGER'],
  ['Employee', 'EMPLOYEE'],
];

export function mapAuth0Role(auth0Roles: string[]): UserRole {
  for (const [auth0Name, appRole] of PRIORITY) {
    if (auth0Roles.includes(auth0Name)) return appRole;
  }
  return 'EMPLOYEE';
}
