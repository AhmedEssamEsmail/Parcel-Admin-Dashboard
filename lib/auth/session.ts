import { cookies } from "next/headers";

import { parseAccessScope } from "@/lib/auth/access";
import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return parseAccessScope(cookieStore.get(AUTH_COOKIE_NAME)?.value) !== null;
}
