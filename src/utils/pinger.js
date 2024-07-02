
import db from 'mongo-convenience';
import WebSocket from 'ws';

const connections = {};

const setup = () => {
    const server = new WebSocket.Server({ port: 3001 });

    server.on('connection', ws => {
        let uid = null;

        ws.on('message', async message => {
            const data = recieveData(message);

            if (!data) return;
            if (data.type !== 'subscribe') return;
            if (!data.token || !data.token.length) return;
            
            const token = await db.findOne('tokens', { token: data.token });
            if (!token) return;
            
            uid = token.user;
            connections[uid] = ws;
        });

        ws.on('close', () => { connections[uid] = null });
    });
};

const notify = uid => {
    if (!connections[uid]) return;
    sendData(connections[uid], { type: 'refetch' });
};

const sendData = (ws, obj) => {
    try {
        const data = JSON.stringify(obj);
        ws.send(data);
    } catch (e) {}
};

const recieveData = data => {
    try {
        return JSON.parse(data);
    } catch (e) {
        return {};
    }
};

export default { setup, notify };
