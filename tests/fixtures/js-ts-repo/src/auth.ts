import { refreshSession } from "./session";

export function loginUser(name: string) {
  return refreshSession(name);
}

export class AuthService {
  validateToken(token: string) {
    return token.length > 0;
  }
}
