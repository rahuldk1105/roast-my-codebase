import { getPermissions } from "./auth.js";

export function getUser(token: string) {
  return { id: "1", name: "Test", permissions: getPermissions("1") };
}
