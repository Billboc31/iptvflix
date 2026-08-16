import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { ApiError } from '../lib/api.js';
export default function LoginPage() {
    const { login, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    if (isAuthenticated) {
        navigate('/', { replace: true });
        return null;
    }
    async function handleSubmit(e) {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);
        try {
            await login(username, password);
            navigate('/');
        }
        catch (err) {
            if (err instanceof ApiError && err.status === 401) {
                setError('Invalid username or password');
            }
            else {
                setError('Login failed. Please try again.');
            }
        }
        finally {
            setIsSubmitting(false);
        }
    }
    return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-black", children: _jsxs("div", { className: "w-full max-w-sm p-8 bg-zinc-900 rounded-lg shadow-lg", children: [_jsx("h1", { className: "text-2xl font-bold text-white mb-6", children: "IPTVFlix" }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-zinc-400 mb-1", htmlFor: "username", children: "Username" }), _jsx("input", { id: "username", type: "text", value: username, onChange: (e) => setUsername(e.target.value), className: "w-full px-3 py-2 bg-zinc-800 text-white rounded border border-zinc-700 focus:outline-none focus:border-zinc-500", required: true, autoComplete: "username" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-zinc-400 mb-1", htmlFor: "password", children: "Password" }), _jsx("input", { id: "password", type: "password", value: password, onChange: (e) => setPassword(e.target.value), className: "w-full px-3 py-2 bg-zinc-800 text-white rounded border border-zinc-700 focus:outline-none focus:border-zinc-500", required: true, autoComplete: "current-password" })] }), error && _jsx("p", { className: "text-red-400 text-sm", children: error }), _jsx("button", { type: "submit", disabled: isSubmitting, className: "w-full py-2 bg-white text-black font-semibold rounded hover:bg-zinc-200 disabled:opacity-50 transition-opacity", children: isSubmitting ? 'Signing in…' : 'Sign in' })] })] }) }));
}
//# sourceMappingURL=LoginPage.js.map