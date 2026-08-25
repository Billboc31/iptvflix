import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:3000';
    return {
        plugins: [react(), tailwindcss()],
        server: {
            host: '0.0.0.0',
            port: 5174,
            strictPort: true,
            proxy: {
                '/api': {
                    target: apiProxyTarget,
                    rewrite: (path) => path.replace(/^\/api/, ''),
                },
            },
        },
    };
});
//# sourceMappingURL=vite.config.js.map