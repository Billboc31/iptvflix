import { listDevices, renameDevice, revokeDevice, DeviceNotFoundError } from '../services/device.service.js';
export async function devicesRoutes(app) {
    app.get('/devices', async () => {
        return listDevices();
    });
    app.patch('/devices/:id', async (request, reply) => {
        const { name } = request.body;
        if (!name || typeof name !== 'string') {
            return reply.status(400).send({ error: 'name is required' });
        }
        try {
            return await renameDevice(request.params.id, name);
        }
        catch (err) {
            if (err instanceof DeviceNotFoundError) {
                return reply.status(404).send({ error: err.message });
            }
            throw err;
        }
    });
    app.delete('/devices/:id', async (request, reply) => {
        try {
            await revokeDevice(request.params.id);
            return reply.status(204).send();
        }
        catch (err) {
            if (err instanceof DeviceNotFoundError) {
                return reply.status(404).send({ error: err.message });
            }
            throw err;
        }
    });
}
//# sourceMappingURL=devices.js.map