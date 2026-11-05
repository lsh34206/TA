import type { Request } from 'express';
import type { Role } from '../store/types.js';

export interface AuthUser {
  id: number;
  loginId: string;
  name: string;
  role: Role;
  /** 'YYYY-MM-DD' */
  hireDate: string;
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
}
