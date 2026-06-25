import { getUser } from "./user.js";

export function authenticate(token: string) {
  const user = getUser(token);
  return user;
}

export function getPermissions(userId: string) {
  return ["read", "write"];
}
