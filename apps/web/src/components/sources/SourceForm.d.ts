import type { SourceResponse, CreateSourceBody, UpdateSourceBody } from '@iptvflix/api-contracts';
type SourceFormProps = {
    initial?: SourceResponse;
    onSubmit: (body: CreateSourceBody | UpdateSourceBody) => Promise<void>;
    onTest?: (id: string) => Promise<{
        ok: boolean;
        message: string;
    }>;
    onClose: () => void;
};
export default function SourceForm({ initial, onSubmit, onTest, onClose }: SourceFormProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=SourceForm.d.ts.map