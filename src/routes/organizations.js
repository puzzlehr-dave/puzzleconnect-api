
import express from 'express';
import db from 'mongo-convenience';
import { respond, auth } from 'schema-convenience';
import admins from '../data/admins';
import dateUtils from '../utils/date';

const organizations = express.Router();

const addOrganization = {
    name: 'string',
    cron: 'string'
};

organizations.post('/add', respond(addOrganization, async result => {
    if (result.cron !== admins.analytics.auth) throw 'admin-invalid';

    const organization = {
        name: result.name,
        admins: [],
        groups: [],
        analyticsRange: { from: null, to: null },
        analytics: [],
        updatedDate: null,
        date: new Date()
    };

    await db.insertOne('organizations', organization);
    return { success: true };
}));

organizations.post('/admins/add', respond({ organization: 'string', user: 'string', cron: 'string' }, async result => {
    if (result.cron !== admins.analytics.auth) throw 'admin-invalid';

    const user = await db.findOne('users', { _id: db.id(result.user) });
    if (!user) throw 'user-invalid';

    const organization = await db.findOne('organizations', { _id: db.id(result.organization) });
    if (!organization) throw 'organization-invalid';

    await db.updateOne('organizations', { _id: db.id(result.organization) }, { $addToSet: { admins: result.user } });
    return { success: true };
}));

organizations.post('/groups/add', respond({ organization: 'string', group: 'string', cron: 'string' }, async result => {
    if (result.cron !== admins.analytics.auth) throw 'admin-invalid';

    const organization = await db.findOne('organizations', { _id: db.id(result.organization) });
    if (!organization) throw 'organization-invalid';

    const group = await db.findOne('groups', { _id: db.id(result.group) });
    if (!group) throw 'group-invalid';

    await db.updateOne('organizations', { _id: db.id(result.organization) }, { $addToSet: { groups: result.group } });
    return { success: true };
}));

organizations.post('/fetch', auth({}, async (result, uid) => {
    const organizations = await db.find('organizations', { admins: uid });
    
    return organizations.map(organization => ({
        _id: organization._id,
        name: organization.name
    }));
}));

organizations.post('/pull', auth({ organization: 'string' }, async (result, uid) => {
    const organization = await db.findOne('organizations', { _id: db.id(result.organization) });
    if (!organization) throw 'organization-invalid';
    if (!organization.admins.includes(uid)) throw 'invalid-admin';
    
    return {
        _id: organization._id,
        name: organization.name,
        analytics: organization.analytics,
        updatedDate: organization.updatedDate
    };
}));

export default organizations;
