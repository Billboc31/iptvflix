import { spawn } from 'node:child_process';
let cachedFfmpeg = null;
let cachedFfprobe = null;
function checkBinary(bin) {
    return new Promise((resolve) => {
        const proc = spawn(bin, ['-version'], { stdio: ['ignore', 'ignore', 'ignore'] });
        proc.on('close', (code) => resolve(code === 0));
        proc.on('error', () => resolve(false));
    });
}
/** Cached check — used to avoid choosing HLS modes when the binary is missing. */
export async function isFfmpegAvailable() {
    if (cachedFfmpeg != null)
        return cachedFfmpeg;
    cachedFfmpeg = await checkBinary('ffmpeg');
    return cachedFfmpeg;
}
export async function isFfprobeAvailable() {
    if (cachedFfprobe != null)
        return cachedFfprobe;
    cachedFfprobe = await checkBinary('ffprobe');
    return cachedFfprobe;
}
/** Test-only: reset memoization. */
export function resetFfmpegAvailabilityCache() {
    cachedFfmpeg = null;
    cachedFfprobe = null;
}
//# sourceMappingURL=ffmpeg-availability.js.map