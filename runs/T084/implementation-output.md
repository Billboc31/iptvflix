Done. Added 3 test files (9 tests total, all green) addressing the P1 blocker from the review:

- **`AuthContext.test.tsx`** — boot flow: `getMe` success sets `isAuthenticated=true`; `getMe` failure sets `isAuthenticated=false, isLoading=false`; login transition from unauthenticated to authenticated
- **`ProtectedRoute.test.tsx`** — spinner during loading; redirect to `/login` when not authenticated; renders children when authenticated
- **`LoginPage.test.tsx`** — successful submit navigates to `/`; 401 shows "Invalid username or password"; network error shows "Login failed. Please try again."

The full web test suite remains at 501 passing. The smoke test (P5) still requires manual validation against a live environment.
