
import db from 'mongo-convenience';

const configure = async () => {
    try {
        const notificationData = await db.findOne('notificationData', {});
        if (!notificationData) await db.insertOne('notificationData', { type: 'default' });
    } catch (e) {}
};

export default { configure };
