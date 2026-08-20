export type RelayTicketPayload = {
    u: string;
    e: string;
    exp: number;
    /** Resume offset in seconds for remux (-ss). */
    s?: number;
};
/** Sign a short-lived playback ticket for the external media relay. */
export declare function signRelayTicket(payload: RelayTicketPayload, secret: string): string;
export declare function buildMediaRelayPlayUrl(opts: {
    relayBaseUrl: string;
    secret: string;
    providerStreamUrl: string;
    containerExtension: string | null | undefined;
    ttlSeconds?: number;
    startPositionSeconds?: number;
}): string;
//# sourceMappingURL=media-relay-ticket.d.ts.map