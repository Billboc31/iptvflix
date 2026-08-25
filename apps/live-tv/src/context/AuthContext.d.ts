type AuthState = {
    isAuthenticated: boolean;
    username: string | null;
    isLoading: boolean;
    login: (username: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
};
export declare function AuthProvider({ children }: {
    children: React.ReactNode;
}): import("react").JSX.Element;
export declare function useAuth(): AuthState;
export declare function clearLastProfileId(): void;
export {};
//# sourceMappingURL=AuthContext.d.ts.map