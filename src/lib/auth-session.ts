let redirectingToLogin = false;

export function handleUnauthorized(status: number) {
  if (status !== 401 || typeof window === "undefined") {
    return false;
  }

  localStorage.removeItem("gymplus_access");
  localStorage.removeItem("gymplus_refresh");
  localStorage.removeItem("gymplus_user");
  sessionStorage.setItem("gymplus_auth_message", "نشست شما منقضی شده است. لطفا دوباره وارد شوید.");

  if (!redirectingToLogin && window.location.pathname !== "/login") {
    redirectingToLogin = true;
    window.location.replace("/login?reason=session-expired");
  }

  return true;
}
