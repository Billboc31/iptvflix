import { listGenres } from '../lib/api.js';
import { useApi } from './useApi.js';
export function useGenres() {
    const { data, loading } = useApi(listGenres);
    return { genres: data ?? [], loading };
}
//# sourceMappingURL=useGenres.js.map