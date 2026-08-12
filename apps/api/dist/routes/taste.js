import { getTaste, buildTaste } from '../services/profile-taste-service.js';
import { DEFAULT_PROFILE_ID } from '../services/profile-service.js';
export async function tasteRoutes(app) {
    app.get('/taste', async () => {
        return getTaste(DEFAULT_PROFILE_ID);
    });
    app.post('/taste/rebuild', async () => {
        return buildTaste(DEFAULT_PROFILE_ID);
    });
}
//# sourceMappingURL=taste.js.map