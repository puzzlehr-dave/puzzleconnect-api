
import db from 'mongo-convenience';

import users from '../data/admins';
import errors from './errors';

const auth = async (req, res, next) => {
    const token = req.headers.authorization;
    const invalid = () => res.status(400).send({ code: 'auth' });

    if (token) {
        const userToken = await db.findOne('tokens', { token, archived: false });
        if (!userToken) return invalid();

        const user = await db.findOne('users', { _id: db.id(userToken.user) });
        if (!user) return invalid();

        res.locals.uid = user._id.toString();
    } else {
        res.locals.uid = null;
    }

    next();
};

const admin = (req, res, admin = false) => {
    const user = users[req.body.accountEmail];
    if (!user) return sendError(res, errors.auth);
    if (!user.admin && admin) return sendError(res, errors.auth);
    if (user.password !== req.body.accountPassword) return sendError(res, errors.auth);
    return null;
};

const sendError = (res, code) => {
    res.status(400).send({ code });
    return code;
};

export const check = (admin = false) => (req, res, next) => {
    if (auth(req, res, admin)) return;
    next();
};

export default { admin, auth };
