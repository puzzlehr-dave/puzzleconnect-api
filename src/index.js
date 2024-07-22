
import express from 'express';
import config from './utils/config';

import auth from './routes/auth';
import chat from './routes/chat';
import groups from './routes/groups';
import questions from './routes/questions';
import badges from './routes/badges';
import notifications from './routes/notifications';

const app = express();
config(app);

// MARK: Routes
app.use('/auth', auth);
app.use('/chat', chat);
app.use('/groups', groups);
app.use('/questions', questions);
app.use('/badges', badges);
app.use('/notifications', notifications);

// notificationsService.test('8f484ced58714f6efd9530ef1491b53c9440ef46846597545008a52d1436ce8a');

app.listen(9898, () => console.log('Node server running on port 9898'));
