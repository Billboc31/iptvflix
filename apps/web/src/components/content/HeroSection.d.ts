type HeroSectionProps = {
    title: string;
    synopsis?: string | null;
    backdropUrl?: string | null;
    onDetails?: () => void;
    onAddToList?: () => void;
};
export default function HeroSection({ title, synopsis, backdropUrl, onDetails, onAddToList, }: HeroSectionProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=HeroSection.d.ts.map