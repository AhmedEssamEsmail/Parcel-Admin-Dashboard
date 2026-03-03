import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME, AUTH_COOKIE_VALUE } from "@/lib/auth/constants";

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE_NAME)?.value === AUTH_COOKIE_VALUE;
}
