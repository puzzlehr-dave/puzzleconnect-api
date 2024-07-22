
import express from 'express';
import db from 'mongo-convenience';
import { auth } from 'schema-convenience';
import pinger from '../utils/pinger';
import notifications from '../services/notifications';

const groups = express.Router();

groups.post('/fetch', auth({}, async (result, uid) => {
    const adminUser = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!adminUser) throw 'user-invalid';
    if (!adminUser.admin) throw 'admin-invalid';
    
    const groups = await db.find('groups', { archived: false });
    
    const results = groups
        .map(group => ({ _id: group._id, name: group.name, public: group.public }))
        .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    
    return results;
}));

groups.post('/search', auth({ search: 'string' }, async (result, uid) => {
    const user = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!user) throw 'user-invalid';
    
    if (result.search.length < 3) return [];
    
    const groups = await db.project('groups', { $text: { $search: result.search }, archived: false }, { _id: 1, name: 1, public: 1 });
    
    const results = groups
        .map(group => ({ _id: group._id, name: group.name, public: group.public }))
        .filter(group => !user.admin ? group.public : true);
    
    return results;
}));

groups.post('/members', auth({ group: 'string' }, async (result, uid) => {
    const adminUser = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!adminUser) throw 'user-invalid';

    const group = await db.findOne('groups', { _id: db.id(result.group), archived: false });
    if (!group) throw 'invalid-group';
    if (!group.users.includes(uid) && !adminUser.admin) throw 'permission-invalid';
    
    const userIds = group.users.map(user => db.id(user));
    
    const users = await db.find('users', { _id: { $in: userIds }, archived: false });
    
    const results = users.map(user => ({
        _id: user._id,
        email: adminUser.admin ? user.email : null,
        phone: adminUser.admin ? user.phone : null,
        firstName: user.firstName,
        lastName: user.lastName,
        photo: user.photo,
        thumbnail: user.thumbnail,
        groupData: user.groupData[group._id.toString()] || null,
        admin: group.admins.includes(user._id.toString())
    }));
    
    return results;
}));

groups.post('/update', auth({ group: 'string', update: 'object' }, async (result, uid) => {
    const adminUser = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!adminUser) throw 'user-invalid';

    const group = await db.findOne('groups', { _id: db.id(result.group), archived: false });
    if (!group) throw 'invalid-group';
    if (group.uid !== uid && !adminUser.admin) throw 'permission-invalid';
    
    const update = {};
    
    if (typeof result.update.name === 'string') {
        update.name = result.update.name;
        update.searchName = result.update.name.trim().toLowerCase();
    }
    
    if (typeof result.update.public === 'boolean') {
        update.public = result.update.public;
    }
    
    await db.updateOne('groups', { _id: db.id(result.group) }, { $set: update });
    return { success: true };
}));

groups.post('/add', auth({ name: 'string', options: 'object' }, async (result, uid) => {
    const adminUser = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!adminUser) throw 'user-invalid';
    if (result.name.length < 2) throw 'name-invalid';
    
    const publicGroup = result.options.public ? true : false;

    const groupResult = await db.insertOne('groups', {
        ...result,
        uid,
        admins: [uid],
        searchName: result.name.trim().toLowerCase(),
        requests: [],
        users: [uid],
        public: publicGroup,
        allowWithoutRequest: false,
        allowAnalytics: false,
        archived: false,
        date: new Date()
    });
    
    // if (!user.groupData[result.group]) await db.updateOne('users', { _id: adminUser._id }, { $set: { [`groupData.${result.group}`]: {} } });
    
    const update = {};
    
    update[`groupData.${groupResult._id.toString()}.title`] = null;
    
    if (Object.keys(update).length) await db.updateOne('users', { _id: db.id(uid) }, { $set: update });
    
    await db.updateOne('users', { _id: db.id(uid) }, { $addToSet: { groups: groupResult._id.toString() } });
    
    return { _id: groupResult._id, name: groupResult.name, public: groupResult.public };
}));

groups.post('/join', auth({ group: 'string' }, async (result, uid) => {
    const group = await db.findOne('groups', { _id: db.id(result.group), archived: false });
    if (!group) throw 'group-invalid';

    if (group.allowWithoutRequest) { // or invited with admin yea maybe not on user here
        await db.updateOne('users', { _id: db.id(uid) }, { $addToSet: { groups: result.group } });
        await db.updateOne('groups', { _id: db.id(result.group) }, { $addToSet: { users: uid } });
    } else {
        await db.updateOne('groups', { _id: db.id(result.group) }, { $addToSet: { requests: uid } });
    }

    const notification = {
        title: group.name || '',
        message: 'A new member wants to join your group!'
    };

    const adminIds = group.admins.map(admin => db.id(admin));
    const adminUsers = await db.project('users', { _id: { $in: adminIds } }, { _id: 1, firstName: 1, lastName: 1, pnTokens: 1 });
    adminUsers.forEach(admin => notifications.alert(admin, notification));

    return { success: true };
}));

groups.post('/accept', auth({ group: 'string', user: 'string' }, async (result, uid) => {
    const group = await db.findOne('groups', { _id: db.id(result.group), archived: false });
    if (!group) throw 'group-invalid';
    if (group.uid !== uid && !group.admins.includes(uid)) throw 'permission-invalid';
    if (!group.requests.includes(result.user)) throw 'request-invalid';

    await db.updateOne('users', { _id: db.id(result.user) }, { $addToSet: { groups: result.group } });
    await db.updateOne('groups', { _id: db.id(result.group) }, { $addToSet: { users: result.user }, $pull: { requests: result.user } });

    pinger.notify(result.user);

    return { success: true };
}));

groups.post('/put', auth({ group: 'string', user: 'string', data: 'object' }, async (result, uid) => {
    const adminUser = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!adminUser) throw 'user-invalid';
    if (!adminUser.admin) throw 'admin-invalid';
    
    const group = await db.findOne('groups', { _id: db.id(result.group), archived: false });
    if (!group) throw 'group-invalid';
    
    const user = await db.findOne('users', { _id: db.id(result.user), archived: false });
    if (!user) throw 'user-invalid';
    
    if (!user.groups.includes(result.group)) {
        await db.updateOne('users', { _id: db.id(result.user) }, { $addToSet: { groups: result.group } });
    }
    
    if (!group.users.includes(result.user)) {
        await db.updateOne('groups', { _id: db.id(result.group) }, { $addToSet: { users: result.user }, $pull: { requests: result.user } });
    }
    
    if (typeof result.data.admin === 'boolean' && result.data.admin) {
        if (!group.admins.includes(result.user)) {
            await db.updateOne('groups', { _id: db.id(result.group) }, { $addToSet: { admins: result.user } });
        }
    }
    
    if (typeof result.data.admin === 'boolean' && !result.data.admin) {
        if (group.admins.includes(result.user)) {
            await db.updateOne('groups', { _id: db.id(result.group) }, { $pull: { admins: result.user } });
        }
    }
    
    // if (!user.groupData[result.group]) await db.updateOne('users', { _id: user._id }, { $set: { [`groupData.${result.group}`]: {} } });
    
    const update = {};
    
    if (typeof result.data.title === 'string') {
        update[`groupData.${result.group}.title`] = result.data.title;
    }
    
    if (Object.keys(update).length) await db.updateOne('users', { _id: user._id }, { $set: update });
    
    const updated = await db.findOne('users', { _id: user._id, archived: false });
    if (!updated) throw 'user-invalid';
    
    // pinger.notify(result.user);

    return {
        _id: updated._id,
        email: updated.email,
        phone: updated.phone,
        firstName: updated.firstName,
        lastName: updated.lastName,
        photo: updated.photo,
        thumbnail: updated.thumbnail,
        groupData: updated.groupData[group._id.toString()] || null
    };
}));

groups.post('/leave', auth({ group: 'string' }, async (result, uid) => {
    const group = await db.findOne('groups', { _id: db.id(result.group), archived: false });
    if (!group) throw 'group-invalid';
    if (group.uid === uid) throw 'author-invalid'; // just delete your group plz

    await db.updateOne('users', { _id: db.id(uid) }, { $pull: { groups: result.group } });
    await db.updateOne('groups', { _id: db.id(result.group) }, { $pull: { users: uid, requests: uid } });

    return { success: true };
}));

groups.post('/transfer', auth({ group: 'string', user: 'string' }, async (result, uid) => {
    const adminUser = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!adminUser) throw 'user-invalid';

    const newUser = await db.findOne('users', { _id: db.id(result.user) });
    if (!newUser) throw 'user-invalid';

    const group = await db.findOne('groups', { _id: db.id(result.group), archived: false });
    if (!group) throw 'group-invalid';
    if (group.uid !== uid && !adminUser.admin) throw 'permission-invalid';

    await db.updateOne('users', { _id: db.id(result.user) }, { $addToSet: { groups: result.group } });
    await db.updateOne('groups', { _id: db.id(result.group) }, { $addToSet: { admins: result.user, users: result.user }, $set: { uid: result.user }, $pull: { requests: result.user } });
    
    return { success: true };
}));

groups.post('/kick', auth({ user: 'string', group: 'string' }, async (result, uid) => {
    const adminUser = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!adminUser) throw 'user-invalid';

    const group = await db.findOne('groups', { _id: db.id(result.group), archived: false });
    if (!group) throw 'group-invalid';
    if (!group.admins.includes(uid) && !adminUser.admin) throw 'permission-invalid';
    if (result.user === group.uid) throw 'admin-invalid';

    await db.updateOne('users', { _id: db.id(result.user) }, { $pull: { groups: result.group } });
    await db.updateOne('groups', { _id: db.id(result.group) }, { $pull: { users: result.user, requests: result.user, admins: result.user } });

    return { success: true };
}));

groups.post('/promote', auth({ group: 'string', user: 'string' }, async (result, uid) => {
    const adminUser = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!adminUser) throw 'user-invalid';

    const newUser = await db.findOne('users', { _id: db.id(result.user) });
    if (!newUser) throw 'user-invalid';

    const group = await db.findOne('groups', { _id: db.id(result.group), archived: false });
    if (!group) throw 'group-invalid';
    if (group.uid !== uid && !adminUser.admin) throw 'permission-invalid';
    
    await db.updateOne('users', { _id: db.id(result.user) }, { $addToSet: { groups: result.group } });
    await db.updateOne('groups', { _id: db.id(result.group) }, { $addToSet: { admins: result.user, users: result.user } });
    
    return { success: true };
}));

groups.post('/demote', auth({ group: 'string', user: 'string' }, async (result, uid) => {
    const adminUser = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!adminUser) throw 'user-invalid';

    const newUser = await db.findOne('users', { _id: db.id(result.user) });
    if (!newUser) throw 'user-invalid';

    const group = await db.findOne('groups', { _id: db.id(result.group), archived: false });
    if (!group) throw 'group-invalid';
    if (group.uid !== uid && !adminUser.admin) throw 'permission-invalid';
    
    await db.updateOne('groups', { _id: db.id(result.group) }, { $pull: { admins: result.user } });
    
    return { success: true };
}));

groups.post('/delete', auth({ group: 'string' }, async (result, uid) => {
    const adminUser = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!adminUser) throw 'user-invalid';
    
    const group = await db.findOne('groups', { _id: db.id(result.group), archived: false });
    if (!group) throw 'group-invalid';
    if (group.uid !== uid && !adminUser.admin) throw 'permission-invalid';

    const users = group.users.map(user => db.id(user));

    await db.updateOne('users', { _id: { $in: users } }, { $pull: { groups: result.group } });
    await db.updateOne('groups', { _id: db.id(result.group) }, { $set: { archived: true } });

    return { success: true };
}));

const wait = time => new Promise(resolve => setTimeout(() => { resolve() }, time)); 

const restore = async id => {
    await wait(5000);
    
    try {
        const group = await db.findOne('groups', { _id: db.id(id), archived: true });
        if (!group) throw 'group-invalid';
        
        await db.updateOne('users', { _id: { $in: group.users.map(user => db.id(user)) } }, { $addToSet: { groups: id } });
        await db.updateOne('groups', { _id: db.id(id) }, { $set: { archived: false } });
        
        console.log('Restored group');
    } catch (e) {
        console.log(e);
        console.log('Could not restore group');
    }
};

// restore('65406e8bf9134425b97d7a5c');

groups.post('/posts', auth({ group: 'string', type: 'string', filter: 'object' }, async (result, uid) => {
    const group = await db.findOne('groups', { _id: db.id(result.group), archived: false });
    if (!group) throw 'group-invalid';
    if (!group.users.includes(uid)) throw 'group-invalid';
    
    const filtered = typeof result.filter.to === 'string' ? { to: result.filter.to } : {};
    const posts = await db.find('posts', { group: result.group, type: result.type, archived: false, ...filtered });
    
    const uids = [...posts.map(post => db.id(post.uid)), ...posts.map(post => db.id(post.to)).filter(uid => uid)];
    
    const users = await db.find('users', { _id: { $in: uids }, archived: false });
    const idUsers = users.reduce((a, c) => ({ ...a, [c._id.toString()]: c }), {});
    
    const badges = await db.find('badges', { _id: { $in: posts.filter(post => post.badge).map(post => db.id(post.badge)) } });
    const idBadges = badges.reduce((a, c) => ({ ...a, [c._id.toString()]: c }), {});
    
    const postUser = user => ({
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        photo: user.photo,
        thumbnail: user.thumbnail,
        groupData: user.groupData[group._id.toString()] || null
    });
    
    const postBadge = badge => ({
        _id: badge._id,
        name: badge.name,
        secondaryInfo: badge.secondaryInfo
    });
    
    // filtering here
    // .filter(post => idUsers[post.uid])
    
    return posts.sort((a, b) => (new Date(b.date)) - (new Date(a.date))).map(post => ({
        _id: post._id,
        user: postUser(idUsers[post.uid]),
        type: post.type,
        content: post.content,
        badge: post.badge && idBadges[post.badge] ? postBadge(idBadges[post.badge]) : null,
        to: post.to && post.badge && idUsers[post.to] ? postUser(idUsers[post.to]) : null,
        date: post.date
    }));
}));

groups.post('/post', auth({ group: 'string', type: 'string', content: 'string', badge: 'object' }, async (result, uid) => {
    const group = await db.findOne('groups', { _id: db.id(result.group), archived: false });
    if (!group) throw 'group-invalid';
    if (!group.users.includes(uid)) throw 'group-invalid';
    
    const user = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!user) throw 'user-invalid';
    
    if (!['post', 'badge'].includes(result.type)) throw 'type-invalid';
    
    let badge = null;
    let recipient = null;
    
    if (result.type === 'badge') {
        if (typeof result.badge._id !== 'string' || typeof result.badge.to !== 'string') throw 'badge-invalid';
        
        const existingBadge = await db.findOne('badges', { _id: db.id(result.badge._id), archived: false });
        if (!existingBadge) throw 'badge-invalid';
        
        const existingUser = await db.findOne('users', { _id: db.id(result.badge.to), archived: false });
        if (!existingUser) throw 'to-invalid';
        if (!existingUser.groups.includes(group._id.toString())) throw 'user-invalid';
        
        badge = existingBadge;
        recipient = existingUser;
    }
    
    const post = {
        uid,
        group: group._id.toString(),
        type: result.type,
        content: result.content,
        badge: badge ? badge._id.toString() : null,
        to: badge ? recipient._id.toString() : null,
        archived: false,
        date: new Date()
    };

    await db.insertOne('posts', post);
    
    return {
        _id: post._id,
        user: {
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            photo: user.photo,
            thumbnail: user.thumbnail,
            groupData: user.groupData[group._id.toString()] || null
        },
        type: post.type,
        content: post.content,
        badge: badge ? {
            _id: badge._id,
            name: badge.name,
            secondaryInfo: badge.secondaryInfo
        } : null,
        to: recipient ? {
            _id: recipient._id,
            firstName: recipient.firstName,
            lastName: recipient.lastName,
            photo: recipient.photo,
            thumbnail: recipient.thumbnail,
            groupData: recipient.groupData[group._id.toString()] || null
        } : null,
        date: post.date
    };
}));

groups.post('/archive', auth({ post: 'string' }, async (result, uid) => {
    const post = await db.findOne('posts', { _id: db.id(result.post), uid, archived: false });
    if (!post) throw 'post-invalid';
    
    await db.updateOne('posts', { _id: post._id }, { $set: { archived: true } });
    return { success: true };
}));

export default groups;
