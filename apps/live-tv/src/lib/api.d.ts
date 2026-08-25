import type { LoginResponse, MeResponse, ProfileResponse, SelectProfileResponse, ChannelResponse } from '@iptvflix/api-contracts';
export declare function getStoredAuthToken(): string | null;
export declare function setStoredAuthToken(token: string): void;
export declare function clearStoredAuthToken(): void;
export declare class ApiError extends Error {
    readonly status: number;
    constructor(status: number, message: string);
}
export declare function login(username: string, password: string): Promise<LoginResponse>;
export declare function logout(): Promise<{
    ok: true;
}>;
export declare function getMe(): Promise<MeResponse>;
export declare function listProfiles(): Promise<ProfileResponse[]>;
export declare function selectProfile(profileId: string): Promise<SelectProfileResponse>;
export declare function listChannels(): Promise<ChannelResponse[]>;
//# sourceMappingURL=api.d.ts.map