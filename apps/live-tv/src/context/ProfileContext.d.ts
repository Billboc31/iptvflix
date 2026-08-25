import type { ProfileResponse } from '@iptvflix/api-contracts';
type ProfileState = {
    currentProfile: ProfileResponse | null;
    profiles: ProfileResponse[];
    isLoading: boolean;
    selectProfile: (profileId: string) => Promise<void>;
};
export declare function ProfileProvider({ children }: {
    children: React.ReactNode;
}): import("react").JSX.Element;
export declare function useProfile(): ProfileState;
export {};
//# sourceMappingURL=ProfileContext.d.ts.map