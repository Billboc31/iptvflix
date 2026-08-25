import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
export default function MediaDetailShell({ onClose, scrollY, children }) {
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    useEffect(() => {
        const savedScroll = scrollY ?? 0;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        function handleKeyDown(e) {
            if (e.key === 'Escape')
                onCloseRef.current();
        }
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = prevOverflow;
            document.removeEventListener('keydown', handleKeyDown);
            window.scrollTo(0, savedScroll);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return createPortal(_jsxs("div", { className: "fixed inset-0 z-50 flex items-start justify-center", role: "dialog", "aria-modal": "true", children: [_jsx("div", { className: "absolute inset-0 bg-black/70", onClick: onClose, "aria-hidden": "true" }), _jsxs("div", { className: [
                    'relative z-10 bg-[#0a0a0f] overflow-y-auto',
                    // Mobile: full-screen
                    'w-full h-full',
                    // Desktop: centered modal with margins
                    'md:w-[min(82vw,1100px)] md:h-[90vh] md:mt-[5vh] md:rounded-xl',
                ].join(' '), tabIndex: -1, children: [_jsx("button", { onClick: onClose, "aria-label": "Fermer", className: "absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-black/70 text-white text-xl leading-none flex items-center justify-center hover:bg-black/90 transition-colors border border-white/20", children: "\u2715" }), children] })] }), document.body);
}
//# sourceMappingURL=MediaDetailShell.js.map