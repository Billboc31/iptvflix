import type { CastMemberResponse } from '@iptvflix/api-contracts';
interface CastRowProps {
    cast: CastMemberResponse[];
    director: string | null;
}
export default function CastRow({ cast, director }: CastRowProps): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=CastRow.d.ts.map