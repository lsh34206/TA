import type { User } from '../store/types.js';
import type { AuthUser } from './auth.types.js';

export const toAuthUser = (user: User): AuthUser => ({
  id: user.id,
  loginId: user.loginId,
  name: user.name,
  role: user.role,
  hireDate: user.hireDate,
});
