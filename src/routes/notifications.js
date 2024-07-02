
import express from 'express';
import db from 'mongo-convenience';
import { auth } from 'schema-convenience';

const notifications = express.Router();

notifications.post('/tokens/update', auth({ token: 'string' }, async (result, uid) => {
    await db.updateOne('users', { _id: db.id(uid) }, { $addToSet: { pnTokens: result.token } });
    return { success: true };
}));

export default notifications;
