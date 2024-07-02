
import express from 'express';
import db from 'mongo-convenience';
import { auth } from 'schema-convenience';
import dateUtils from '../utils/date';
import words from '../utils/words';
import notifications from '../services/notifications';

const badges = express.Router();

badges.post('/fetch', auth({ group: 'string', type: 'string' }, async (result, uid) => {
    const user = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!user) throw 'user-invalid';
    
    const group = await db.findOne('groups', { _id: db.id(result.group), archived: false });
    if (!group) throw 'group-invalid';
    if (!group.users.includes(uid) && !user.admin) throw 'group-invalid';
    
    if (!['badge', 'award'].includes(result.type)) throw 'type-invalid';
    
    const badges = await db.find('badges', { group: result.group, type: result.type, archived: false });

    return badges.map(badge => ({
        _id: badge._id,
        name: badge.name,
        secondaryInfo: badge.secondaryInfo
    }));
}));

badges.post('/earned', auth({ group: 'string', user: 'string' }, async (result, uid) => {
    const user = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!user) throw 'user-invalid';
    
    const group = await db.findOne('groups', { _id: db.id(result.group), archived: false });
    if (!group) throw 'group-invalid';
    if (!group.users.includes(uid)) throw 'group-invalid';
    
    const to = await db.findOne('users', { _id: db.id(result.user.length ? result.user : uid), archived: false });
    if (!to || !group.users.includes(to._id.toString())) throw 'user-invalid';
    console.log(to);
    const identifiers = to.badges[result.group] || [];
    console.log(to.badges);
    
    const badges = await db.find('badges', { _id: { $in: identifiers.map(id => db.id(id)) }, archived: false });
    
    return badges.map(badge => ({
        _id: badge._id,
        name: badge.name,
        secondaryInfo: badge.secondaryInfo
    }));
}));

badges.post('/awards', auth({ group: 'string', user: 'string' }, async (result, uid) => {
    const user = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!user) throw 'user-invalid';
    
    const group = await db.findOne('groups', { _id: db.id(result.group), archived: false });
    if (!group) throw 'group-invalid';
    if (!group.users.includes(uid)) throw 'group-invalid';
    
    const to = await db.findOne('users', { _id: db.id(result.user.length ? result.user : uid), archived: false });
    if (!to || !group.users.includes(to._id.toString())) throw 'user-invalid';
    
    const awardCount = {};
    
    console.log('get awards', group._id.toString(), to._id.toString());
    const awards = await db.find('awards', { group: group._id.toString(), to: to._id.toString(), archived: false });
    
    for (const award of awards) {
        awardCount[award.badge] = (awardCount[award.badge] || 0) + 1;
    }
    
    const badges = await db.find('badges', { _id: { $in: Object.keys(awardCount).map(id => db.id(id)) }, type: 'award', archived: false });
    
    return badges.map(badge => ({
        _id: badge._id,
        name: badge.name,
        secondaryInfo: badge.secondaryInfo,
        count: awardCount[badge._id.toString()] || 0
    }));
}));

badges.post('/compliments', auth({ group: 'string', user: 'string' }, async (result, uid) => {
    const user = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!user) throw 'user-invalid';
    
    const group = await db.findOne('groups', { _id: db.id(result.group), archived: false });
    if (!group) throw 'group-invalid';
    if (!group.users.includes(uid)) throw 'group-invalid';
    
    const to = await db.findOne('users', { _id: db.id(result.user.length ? result.user : uid), archived: false });
    if (!to || !group.users.includes(to._id.toString())) throw 'user-invalid';
    
    const compliments = await db.find('compliments', { group: group._id.toString(), to: to._id.toString(), archived: false });
    
    const userIds = compliments.map(compliment => compliment.uid);
    const users = await db.find('users', { _id: { $in: userIds.map(id => db.id(id)) }, archived: false });
    const idUsers = users.reduce((results, user) => ({ ...results, [user._id.toString()]: user }), {});
    
    const complimentUser = user => ({
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        photo: user.photo,
        thumbnail: user.thumbnail
    });
    
    return compliments.map(compliment => ({
        _id: compliment._id,
        content: compliment.content,
        user: idUsers[compliment.uid] ? complimentUser(idUsers[compliment.uid]) : null,
        date: compliment.date
    }));
}));

const wait = time => new Promise(resolve => setTimeout(() => { resolve() }, time));

badges.post('/award', auth({ group: 'string', badge: 'string', to: 'string' }, async (result, uid) => {
    const user = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!user) throw 'user-invalid';
    
    console.log('group', result.group);
    
    const group = await db.findOne('groups', { _id: db.id(result.group), archived: false });
    if (!group) throw 'group-invalid';
    console.log('group', group.users, result.to);
    if (!group.users.includes(uid) || !group.users.includes(result.to)) throw 'group-invalid';
    
    const to = await db.findOne('users', { _id: db.id(result.to), archived: false });
    if (!to) throw 'to-invalid';
    
    const badge = await db.findOne('badges', { _id: db.id(result.badge), archived: false });
    if (!badge || badge.type !== 'award' || badge.group !== group._id.toString()) throw 'badge-invalid';
    
    const award = {
        uid,
        group: group._id.toString(),
        badge: badge._id.toString(),
        to: to._id.toString(),
        archived: false,
        date: new Date()
    };
    
    await db.insertOne('awards', award);
    runAwards(result.group, result.to, user);
    notifications.earnedAward(to.pnTokens, badge, user);
    return { success: true };
}));

badges.post('/compliment', auth({ group: 'string', content: 'string', to: 'string' }, async (result, uid) => {
    const user = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!user) throw 'user-invalid';
    
    const group = await db.findOne('groups', { _id: db.id(result.group), archived: false });
    if (!group) throw 'group-invalid';
    if (!group.users.includes(uid) || !group.users.includes(result.to)) throw 'group-invalid';
    
    const to = await db.findOne('users', { _id: db.id(result.to), archived: false });
    if (!to) throw 'to-invalid';
    
    const compliment = {
        uid,
        group: group._id.toString(),
        to: to._id.toString(),
        content: result.content,
        archived: false,
        date: new Date()
    };
    
    await db.insertOne('compliments', compliment);
    return { success: true };
}));

const schema = {
    group: 'string',
    name: 'string',
    type: 'string',
    query: 'object',
    secondaryInfo: 'object'
};

const allowed = 'QWERTYUIOPASDFGHJKLZXCVBNM qwertyuiopasdfghjklzxcvbnm 1234567890'.split('');

const badgeQueue = [];

const nextBadge = async () => {
    if (!badgeQueue.length) return;
    const next = badgeQueue[0];
    
    const group = next.group;
    const uid = next.uid;
    const badge = next.badge;
    
    let badgeData = null;
    
    try {
        const user = await db.findOne('users', { _id: db.id(uid), archived: false });
        
        try {
            badgeData = await db.findOne('badges', { _id: db.id(badge), archived: false });
        } catch (e) {
            
        }
        
        console.log('check badges');
        if (!user.badges[group]) {
        console.log('check badges update');
            await db.updateOne('users', { _id: user._id }, { $set: { [`badges.${group}`]: [badge] } });
            console.log('check badges update done');
            notifications.earnedBadge(user.pnTokens, badgeData);
            // console.log('Awarded a ' + badge + ' to ' + user._id);
        } else {
            if (!user.badges[group].includes(badge)) {
            console.log('check badges includes');
                await db.updateOne('users', { _id: user._id }, { $addToSet: { [`badges.${group}`]: badge } });
                console.log('check badges includes done');
                notifications.earnedBadge(user.pnTokens, badgeData);
                // console.log('Awarded b ' + badge + ' to ' + user._id);
            }
        }
    } catch (e) {}
    
    badgeQueue.shift();
    nextBadge();
};

const queueBadge = (group, uid, badge) => {
    badgeQueue.push({ group, uid, badge });
    if (badgeQueue.length === 1) nextBadge();
};

const runAwards = async (group, user) => {
    // await wait(5000);
    
    try {
        const badges = await db.find('badges', { group, type: 'badge', archived: false });
        const awards = await db.find('awards', { group, to: user, archived: false });
        
        const results = [];
        
        for (const badge of badges) {
            const queryAwards = badge.query.awards;
            if (!queryAwards || typeof queryAwards !== 'object' || queryAwards.constructor !== Array || !queryAwards.length) continue;
            
            let valid = true;
            
            for (const queryAward of queryAwards) {
                let count = 0;
                
                const from = new Date(queryAward.from);
                const to = new Date(queryAward.to);
                
                for (const award of awards) {
                    if (!valid || award.badge !== queryAward.badge) continue;
                    
                    const date = new Date(award.date);
                    const dateValid = date.getTime() >= from.getTime() && date.getTime() <= to.getTime();
                    if (!dateValid) continue;
                    
                    count += 1;
                }
                
                if (count < queryAward.value) valid = false;
            }
            
            if (valid) results.push(badge._id.toString());
        }
        
        for (const result of results) {
            queueBadge(group, user, result);
        }
    } catch (e) {
        console.log('error running awards');
        console.log(e);
    }
};

// runAwards('65406e8bf9134425b97d7a5c', '653816eef28712bcf2c9b17f');

badges.post('/add', auth(schema, async (result, uid) => {
    const user = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!user) throw 'user-invalid';
    if (!user.admin) throw 'admin-invalid';
    
    const group = await db.findOne('groups', { _id: db.id(result.group), archived: false });
    if (!group) throw 'group-invalid';
    if (group.uid !== uid && !group.admins.includes(uid) && !user.admin) throw 'permission-invalid';
    
    if (!['award', 'badge'].includes(result.type)) throw 'type-invalid';
    
    if (result.type === 'badge') {
        const query = typeof result.query === 'object' && result.query.constructor === Object ? result.query : null;
        if (!query) throw 'query-invalid';
        
        const awards = typeof query.awards === 'object' && query.awards.constructor === Array ? query.awards : null;
        
        let newQuery = {};
        
        if (awards) {
            if (!newQuery.awards) newQuery.awards = [];
            
            const results = [];
            
            for (const award of awards) {
                const badge = await db.findOne('badges', { _id: db.id(award.badge), group: group._id.toString(), type: 'award', archived: false });
                if (!badge) continue;
                
                if (typeof award.badge !== 'string') continue;
                if (typeof award.value !== 'number' || isNaN(award.value) || !isFinite(award.value) || award.value < 1) continue;
                
                const from = typeof award.from === 'string' ? award.from : null;
                const to = typeof award.to === 'string' ? award.to : null;
                if (isNaN(Date.parse(from)) || isNaN(Date.parse(to))) continue;
                
                newQuery.awards.push({ badge: award.badge, value: award.value, from, to });
            }
        }
        
        const badge = {
            group: result.group,
            type: result.type,
            name: result.name,
            query: newQuery,
            secondaryInfo: result.secondaryInfo,
            archived: false,
            date: new Date()
        };
        
        await db.insertOne('badges', badge);
        
        return { _id: badge._id, name: badge.name, secondaryInfo: badge.secondaryInfo };
    }
    
    const info = result.secondaryInfo;
    
    const secondary = {
        description: typeof info.description === 'string' ? info.description : '',
        thumbnail: typeof info.thumbnail === 'string' ? info.thumbnail : '',
        photo: typeof info.photo === 'string' ? info.photo : '',
    };
    
    const badge = {
        group: result.group,
        type: result.type,
        name: result.name,
        query: {},
        secondaryInfo: secondary,
        archived: false,
        date: new Date()
    };
    
    await db.insertOne('badges', badge);
    
    return { _id: badge._id, name: badge.name, secondaryInfo: badge.secondaryInfo };
}));

badges.post('/update', auth({ badge: 'string', update: 'object' }, async (result, uid) => {
    const user = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!user) throw 'user-invalid';
    if (!user.admin) throw 'admin-invalid';
    
    const badge = await db.findOne('badges', { _id: db.id(result.badge), archived: false });
    if (!badge) throw 'badge-invalid';

    const update = {};

    if (result.update.name && typeof result.update.name === 'string') update.name = result.update.name;
    
    const secondaryInfo = result.update.secondaryInfo;
    
    if (secondaryInfo) {
        if (typeof secondaryInfo.description === 'string') update['secondaryInfo.description'] = secondaryInfo.description;
        if (typeof secondaryInfo.thumbnail === 'string') update['secondaryInfo.thumbnail'] = secondaryInfo.thumbnail;
        if (typeof secondaryInfo.photo === 'string') update['secondaryInfo.photo'] = secondaryInfo.photo;
    }
    
    if (Object.keys(update).length) {
        await db.updateOne('badges', { _id: db.id(result.badge) }, { $set: update });
    }
    
    const updated = await db.findOne('badges', { _id: db.id(result.badge), archived: false });
    if (!updated) throw 'badge-invalid';

    return { _id: updated._id, name: updated.name, secondaryInfo: updated.secondaryInfo };
}));

// Warning: This will not delete badges from users who earned them, only going forward people can't earn this

badges.post('/archive', auth({ badge: 'string' }, async (result, uid) => {
    const user = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!user) throw 'user-invalid';
    
    const badge = await db.findOne('badges', { _id: db.id(result.badge), archived: false });
    if (!badge) throw 'badge-invalid';
    
    const group = await db.findOne('groups', { _id: db.id(badge.group), archived: false });
    if (!group) throw 'group-invalid';
    if (group.uid !== uid && !group.admins.includes(uid) && !user.admin) throw 'permission-invalid';

    await db.updateOne('badges', { _id: db.id(result.badge) }, { $set: { archived: true } });
    return { success: true };
}));

const badgeList = async (group, earnedQuestion, earned) => {
    const badges = await db.find('badges', { group: group._id.toString(), archived: false });
    const idBadges = badges.reduce((map, current) => ({ ...map, [current._id.toString()]: current }));
    const users = await db.find('users', { _id: { $in: group.users.map(user => db.id(user)) }, archived: false });
    
    const badgeUsers = users.map(user => ({ ...user, badgeData: (user.badges[group._id.toString()] || []).map(id => idBadges[id]).filter(badge => badge) }));
    const queryWords = earnedQuestion.split(' ').filter(word => !words.includes(word) && word !== 'badge' && !earned.includes(word)).join(' ');
    
    const someMatch = badgeUsers.filter(user => {
        const matches = user.badgeData.filter(badge => queryWords.includes(badge.name.toLowerCase()));
        return matches.length;
    });
    
    const sortedBadgeUsers = badgeUsers.sort((a, b) => {
        const badgesA = a.badgeData.filter(badge => queryWords.includes(badge.name.toLowerCase()));
        const badgesB = b.badgeData.filter(badge => queryWords.includes(badge.name.toLowerCase()));
        return badgesA.length > badgesB.length ? -1 : 1;
    }).filter(user => {
        const matches = user.badgeData.filter(badge => queryWords.includes(badge.name.toLowerCase()));
        return someMatch.length ? (matches.length > 0) : true;
    });
    
    const list = sortedBadgeUsers.map(user => ({
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        photo: user.photo,
        thumbnail: user.thumbnail,
        badgeData: user.badgeData.sort((a, b) => {
            const badgesA = queryWords.includes(a.name.toLowerCase());
            return badgesA ? -1 : 1;
        }).map(data => ({ _id: data._id, name: data.name, secondaryInfo: data.secondaryInfo }))
    }));
    
    return list.sort((a, b) => a.badgeData.length > b.badgeData.length ? -1 : 1);
};

badges.post('/leaderboard', auth({ group: 'string' }, async (result, uid) => {
    const user = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!user) throw 'user-invalid';
    
    const group = await db.findOne('groups', { _id: db.id(result.group), archived: false });
    if (!group) throw 'group-invalid';
    if (group.uid !== uid && !group.admins.includes(uid) && !user.admin) throw 'permission-invalid';
    
    const results = await badgeList(group, 'top badge earners', ['top badge earners']);
    return results;
}));

export default badges;
