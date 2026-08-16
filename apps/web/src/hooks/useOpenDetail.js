import { useNavigate, useLocation } from 'react-router-dom';
export function useOpenDetail() {
    const navigate = useNavigate();
    const location = useLocation();
    return function openDetail(mediaType, id) {
        const path = mediaType === 'movie' ? `/movies/${id}` : `/series/${id}`;
        navigate(path, { state: { background: location, scrollY: window.scrollY } });
    };
}
//# sourceMappingURL=useOpenDetail.js.map