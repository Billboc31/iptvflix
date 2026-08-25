import type { ProfileResponse } from '@iptvflix/api-contracts';
type ProfileState = {
    currentProfile: ProfileResponse | null;
    profiles: ProfileResponse[];
    profileVersion: number;
    isLoading: boolean;
    selectProfile: (profileId: string) => Promise<void>;
    refreshProfiles: () => Promise<void>;
};
export declare function ProfileProvider({ children }: {
    children: React.ReactNode;
}): import("react").JSX.Element;
export declare function useProfile(): ProfileState;
export declare function clearLastProfileId(): void;
export {};
//# sourceMappingURL=ProfileContext.d.ts.map