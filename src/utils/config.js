
import db from 'mongo-convenience';
import bodyParser from 'body-parser';
import cors from './cors';
import auth from './auth';
import notificationData from './notificationData';
import pinger from '../utils/pinger';

export default async app => {
    app.use('*', cors);
    app.use(auth.auth);
    app.use(bodyParser.json());

    await db.connect('main-db');
    await db.index('groups', 'searchName', 'text');
    
    await notificationData.configure();

    pinger.setup();
};
