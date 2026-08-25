import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
export default function ContinueWatchingOverflowMenu({ onClose, onDetails, onDismiss, triggerRef }) {
    const menuRef = useRef(null);
    const [position, setPosition] = useState(null);
    useLayoutEffect(() => {
        const trigger = triggerRef.current;
        if (!trigger)
            return;
        const rect = trigger.getBoundingClientRect();
        const menuWidth = 208;
        let left = rect.right - menuWidth;
        left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
        setPosition({ top: rect.bottom + 4, left });
    }, [triggerRef]);
    useEffect(() => {
        menuRef.current?.querySelector('[role="menuitem"]')?.focus();
    }, []);
    useEffect(() => {
        function handleKeyDown(e) {
            if (e.key === 'Escape') {
                onClose();
                return;
            }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const menuItems = Array.from(menuRef.current?.querySelectorAll('[role="menuitem"]') ?? []);
                if (menuItems.length === 0)
                    return;
                const idx = menuItems.indexOf(document.activeElement);
                const next = e.key === 'ArrowDown'
                    ? menuItems[(idx + 1) % menuItems.length]
                    : menuItems[(idx - 1 + menuItems.length) % menuItems.length];
                next?.focus();
            }
        }
        function handleClickOutside(e) {
            if (menuRef.current &&
                !menuRef.current.contains(e.target) &&
                !triggerRef.current?.contains(e.target)) {
                onClose();
            }
        }
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose, triggerRef]);
    if (!position)
        return null;
    return createPortal(_jsxs("div", { ref: menuRef, role: "menu", "aria-label": "Options", style: { position: 'fixed', top: position.top, left: position.left, zIndex: 50 }, className: "w-52 max-w-[min(208px,90vw)] bg-[#1a1a24] border border-white/10 rounded-lg shadow-xl py-1", children: [_jsx("button", { type: "button", role: "menuitem", onClick: onDetails, className: "w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white", children: "D\u00E9tails" }), _jsx("button", { type: "button", role: "menuitem", onClick: onDismiss, className: "w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white", children: "Supprimer de Reprendre" })] }), document.body);
}
//# sourceMappingURL=ContinueWatchingOverflowMenu.js.map