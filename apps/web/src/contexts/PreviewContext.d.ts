type PreviewContextValue = {
    activeId: string | null;
    activeKey: string | null;
    activate: (id: string, key: string) => void;
    deactivate: () => void;
};
export declare const PreviewContext: import("react").Context<PreviewContextValue>;
export declare function PreviewProvider({ children }: {
    children: React.ReactNode;
}): import("react").JSX.Element;
export declare function usePreview(): PreviewContextValue;
export {};
//# sourceMappingURL=PreviewContext.d.ts.map