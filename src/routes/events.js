
import express from 'express';
import db from 'mongo-convenience';
import { auth } from 'schema-convenience';
import uuid from '../utils/uuid';
import axios from 'axios';

const events = express.Router();

events.post('/fetch', auth({}, async (result, uid) => {
    const user = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!user) throw 'auth';
    
    const events = await db.find('events', { uid, archived: false });
    
    const results = events.sort((a, b) => b.sortTime - a.sortTime).map(event => ({
        identifier: group.identifier,
        name: group.name,
        lastActivity: group.lastActivity
    }));
    
    return results;
}));

export const add = async (type, event) => {
    
};

groups.post('/add', auth({ name: 'string' }, async (result, uid) => {
    const group = {
        identifier: uuid.generate(),
        uid,
        admins: [uid],
        users: [uid],
        name: result.name,
        lastActivity: null,
        sortActivity: (new Date()).getTime(),
        archived: false,
        date: new Date()
    };
    
    await db.insertOne('groups', group);
    return { identifier: group.identifier, name: group.name };
}));

groups.post('/update', auth({ group: 'string', update: 'object' }, async (result, uid) => {
    const group = await db.findOne('groups', { identifier: result.group, archived: false });
    if (!group) throw 'group-invalid';
    if (!group.admins.includes(uid)) throw 'group-invalid';
    
    if (typeof result.update.name === 'string') {
        await db.updateOne('groups', { _id: group._id }, { $set: { name: result.update.name } });
    }
    
    return { success: true };
}));

groups.post('/archive', auth({ group: 'string' }, async (result, uid) => {
    const group = await db.findOne('groups', { identifier: result.group, archived: false });
    if (!group) throw 'group-invalid';
    if (!group.admins.includes(uid)) throw 'group-invalid';
    
    await db.updateOne('groups', { _id: group._id }, { $set: { archived: true } });
    return { success: true };
}));

groups.post('/users/fetch', auth({ group: 'string' }, async (result, uid) => {
    const group = await db.findOne('groups', { identifier: result.group, archived: false });
    if (!group) throw 'group-invalid';
    if (!group.users.includes(uid)) throw 'group-invalid';
    
    const ids = group.users.map(user => db.id(user));
    const users = await db.find('users', { _id: { $in: ids } });
    
    const results = users.sort((a, b) => (a.profile.firstName || '').localeCompare(b.profile.firstName || '')).map(user => ({
        identifier: user.identifier,
        profile: user.profile
    }));
    
    return results;
}));

groups.post('/users/add', auth({ group: 'string', user: 'string' }, async (result, uid) => {
    const group = await db.findOne('groups', { identifier: result.group, archived: false });
    if (!group) throw 'group-invalid';
    if (!group.admins.includes(uid)) throw 'group-invalid';
    
    const user = await db.findOne('users', { identifier: result.user, archived: false });
    if (!user) throw 'user-invalid';
    
    await db.updateOne('users', { _id: user._id }, { $addToSet: { groups: group._id.toString() } });
    await db.updateOne('groups', { _id: group._id }, { $addToSet: { users: user._id.toString() } });
    
    return { success: true };
}));

groups.post('/users/remove', auth({ group: 'string', user: 'string' }, async (result, uid) => {
    const group = await db.findOne('groups', { identifier: result.group, archived: false });
    if (!group) throw 'group-invalid';
    if (!group.admins.includes(uid)) throw 'group-invalid';
    
    const user = await db.findOne('users', { identifier: result.user, archived: false });
    if (!user) throw 'user-invalid';
    
    await db.updateOne('users', { _id: user._id }, { $pull: { groups: group._id.toString() } });
    await db.updateOne('groups', { _id: group._id }, { $pull: { users: user._id.toString() } });
    
    return { success: true };
}));

groups.post('/users/list/phone', auth({ contacts: 'object' }, async (result, uid) => {

}));

const waiting = {};

export const processWaiting = async (authType, authUid) => {
    const user = await db.findOne('users', { authType, authUid, archived: false });
    if (!user) return true;
    
    const waitingIdentifiers = waiting[`${authType}-${authUid}`];
    if (!waitingIdentifiers) return true;
    
    for (const identifier of waitingIdentifiers) {
        try {
            const group = await db.findOne('groups', { _id: db.id(identifier), archived: false });
            if (!group) continue;
            
            await db.updateOne('users', { _id: user._id }, { $addToSet: { groups: group._id.toString() } });
            await db.updateOne('groups', { _id: group._id }, { $addToSet: { users: user._id.toString() } });
        } catch (e) {}
    }
    
    return true;
};

groups.post('/users/add/phone', auth({ group: 'string', country: 'string', phone: 'string' }, async (result, uid) => {
    const group = await db.findOne('groups', { identifier: result.group, archived: false });
    if (!group) throw 'group-invalid';
    if (!group.admins.includes(uid)) throw 'group-invalid';
    
    const authUid = result.country.replace(/\D/g, '') + '|' + result.phone.replace(/\D/g, '');
    const user = await db.findOne('users', { authType: 'phone', authUid, archived: false });
    
    if (user) {
        await db.updateOne('users', { _id: user._id }, { $addToSet: { groups: group._id.toString() } });
        await db.updateOne('groups', { _id: group._id }, { $addToSet: { users: user._id.toString() } });
        return { success: true };
    }
    
    if (waiting[`phone-${authUid}`]) {
        waiting[`phone-${authUid}`].push(group._id.toString());
    } else {
        waiting[`phone-${authUid}`] = [group._id.toString()];
    }
    
    return { success: true };
}));

export default groups;

