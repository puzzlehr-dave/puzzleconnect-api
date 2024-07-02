
import express from 'express';
import db from 'mongo-convenience';
import { auth, respond } from 'schema-convenience';

import hasher from '../utils/hasher';
import validate from '../utils/validate';
import generateToken from '../utils/token';
import messaging from '../services/messaging';
import axios from 'axios';

const authentication = express.Router();

const emailCodes = {};
const phoneCodes = {};



const requestVerification = async (phone) => {
    const sinchUrl = 'https://verification.api.sinch.com/verification/v1/verifications';
    
    try {
        const data = {
            identity: {
                type: 'number',
                endpoint: '+' + phone
            },
            method: 'sms'
        };

        const headers = {
            'Authorization': `Basic ZDExMzIyNzgtYWE2Zi00YzliLTk0N2ItNjhmNzQ0ZjEyYzAzOnhKRUp2cndDN1VxemMrbjhVb0tVRmc9PQ==`,
            'Content-Type': 'application/json',
            'Accept-Language': 'en-US'
        };
        
        await axios.post(sinchUrl, data, { headers });
        console.log('sent verification');
        return true;
    } catch (e) {
        console.log(e);
        return false;
    }
};

const completeVerification = async (phone, code) => {
    const sinchUrl = 'https://verification.api.sinch.com/verification/v1/verifications';
    
    try {
        const data = {
            sms: { code: code.toString() },
            method: 'sms'
        };

        const headers = {
            'Authorization': `Basic ZDExMzIyNzgtYWE2Zi00YzliLTk0N2ItNjhmNzQ0ZjEyYzAzOnhKRUp2cndDN1VxemMrbjhVb0tVRmc9PQ==`,
            'Content-Type': 'application/json',
            'Accept-Language': 'en-US'
        };
        
        const response = await axios.put(sinchUrl + '/number/+' + phone.split(' ').join(''), data, { headers });
        console.log('completed verification', response.data);
        return response.data.status === 'SUCCESSFUL';
    } catch (e) {
        console.log(e);
        return false;
    }
};





authentication.post('/verify/email', respond({ email: 'string' }, async result => {
    const user = await db.findOne('users', { email: result.email, archived: false });
    if (!user) return { success: false, userNotFound: true };
    
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    emailCodes[user.email] = user.email === 'appreview@geeky.media' ? '1234' : code;
    
    console.log('Send verification code', user.email, emailCodes[user.email]);
    
    setTimeout(() => {
        if (emailCodes[result.email]) delete emailCodes[result.email];
    }, 60000);
    
    return { success: true, userNotFound: false };
}));

const sendTextCode = async (identifier, message) => {
    console.log('Send code', identifier, message);
    
    if (identifier === '14072837660') identifier = '14072837661';
    
    try {
        const result = await axios.post('https://microservices.geekydevelopment.com/debug/text', { auth: 'yCCihY3UN1Eb8YfcTSdsFiRu2SPYK0MY', phone: identifier, message });
    } catch (e) {}
};

authentication.post('/verify/phone', respond({ phone: 'string' }, async result => {
    const user = await db.findOne('users', { phone: result.phone, archived: false });
    if (!user) return { success: false, userNotFound: true };
    
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    phoneCodes[user.phone] = user.phone === '12775383783' ? '1234' : code;
    
    console.log('Send verification code', user.phone, phoneCodes[user.phone]);
    // sendTextCode(user.phone, 'Your code is ' + phoneCodes[user.phone]);
    requestVerification(user.phone);
    
    setTimeout(() => {
        if (phoneCodes[result.phone]) delete phoneCodes[result.phone];
    }, 60000);
    
    return { success: true, userNotFound: false };
}));

authentication.post('/email', respond({ email: 'string', code: 'string' }, async result => {
    const user = await db.findOne('users', { email: result.email, archived: false });
    if (!user) throw 'user-not-found';
    
    if (!emailCodes[result.email] || emailCodes[result.email] !== result.code) {
        return { token: null, user: null, invalidCode: true };
    }
    
    delete emailCodes[result.email];
    
    const token = {
        user: user._id.toString(),
        token: generateToken(),
        archived: false,
        date: new Date()
    };

    const previousToken = await db.findOne('tokens', { token: token.token });
    if (previousToken) throw 'token-invalid';

    const savedToken = await db.insertOne('tokens', token);
    
    const groups = await db.find('groups', { _id: { $in: user.groups.map(group => db.id(group)) }, archived: false });
    const idGroups = groups.reduce((a, c) => ({ ...a, [c._id.toString()]: c }), {});
    
    const userGroup = (user, group) => {
        const data = user.groupData[group._id.toString()] || {};
        
        return {
            _id: group._id,
            name: group.name,
            data: {
                title: data.title || null
            },
            admin: group.admins.includes(user._id.toString())
        };
    };

    return {
        token: savedToken.token,
        user: {
            _id: user._id,
            email: user.email,
            phone: user.phone,
            firstName: user.firstName,
            lastName: user.lastName,
            photo: user.photo,
            thumbnail: user.thumbnail,
            groups: user.groups.filter(group => idGroups[group]).map(group => userGroup(user, idGroups[group])),
            admin: user.admin
        },
        invalidCode: false
    };
}));

authentication.post('/phone', respond({ phone: 'string', code: 'string' }, async result => {
    const user = await db.findOne('users', { phone: result.phone, archived: false });
    if (!user) throw 'user-not-found';
    
    const verified = completeVerification(result.phone, result.code);
    if (!verified) return { token: null, user: null, invalidCode: true };
    
    //if (!phoneCodes[result.phone] || phoneCodes[result.phone] !== result.code) {
      //  return { token: null, user: null, invalidCode: true };
    //}
    
    delete phoneCodes[result.phone];
    
    const token = {
        user: user._id.toString(),
        token: generateToken(),
        archived: false,
        date: new Date()
    };

    const previousToken = await db.findOne('tokens', { token: token.token });
    if (previousToken) throw 'token-invalid';

    const savedToken = await db.insertOne('tokens', token);
    
    const groups = await db.find('groups', { _id: { $in: user.groups.map(group => db.id(group)) }, archived: false });
    const idGroups = groups.reduce((a, c) => ({ ...a, [c._id.toString()]: c }), {});
    
    const userGroup = (user, group) => {
        const data = user.groupData[group._id.toString()] || {};
        
        return {
            _id: group._id,
            name: group.name,
            data: {
                title: data.title || null
            },
            admin: group.admins.includes(user._id.toString())
        };
    };

    return {
        token: savedToken.token,
        user: {
            _id: user._id,
            email: user.email,
            phone: user.phone,
            firstName: user.firstName,
            lastName: user.lastName,
            photo: user.photo,
            thumbnail: user.thumbnail,
            groups: user.groups.filter(group => idGroups[group]).map(group => userGroup(user, idGroups[group])),
            admin: user.admin
        },
        invalidCode: false
    };
}));

const signUp = {
    email: 'string',
    phone: 'string',
    firstName: 'string',
    lastName: 'string',
    photo: 'string',
    thumbnail: 'string',
    permissions: 'string'
};

authentication.post('/list', auth({}, async (result, uid) => {
    const adminUser = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!adminUser) throw 'user-invalid';
    if (!adminUser.admin) throw 'admin-invalid';
    
    const users = await db.find('users', { archived: false });
    
    const results = users.map(user => ({
        _id: user._id,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        photo: user.photo,
        thumbnail: user.thumbnail,
        admin: user.admin
    }));
    
    return results;
}));

authentication.post('/add', auth(signUp, async (result, uid) => {
    const adminUser = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!adminUser) throw 'user-invalid';
    if (!adminUser.admin) throw 'admin-invalid';
    
    const phoneUser = await db.findOne('users', { phone: result.phone, archived: false });
    const emailUser = await db.findOne('users', { email: result.email, archived: false });
    if (emailUser || phoneUser) return { user: null, emailTaken: emailUser != null, phoneTaken: phoneUser != null };
    
    if (result.phone.length < 4) throw 'phone-invalid';

    /*
    const code = result.phone === '12775378222' ? '1234' : Math.floor(100000 + Math.random() * 900000).toString();

    let password = code;

    try {
        password = await hasher.hash(password);
    } catch (e) {
        throw 'password-invalid';
    }
    */

    const user = await db.insertOne('users', { 
        ...result,
        admin: result.permissions === 'admin',
        groups: [],
        groupData: {}, // [group] : ''
        // badges: {}, // [group] : []
        // highFives: {}, // [group] : []
        badges: {}, // [group]: []
        pnTokens: [],
        archived: false,
        date: new Date()
    });

    const token = await db.insertOne('tokens', {
        user: user._id.toString(),
        token: generateToken(),
        archived: false,
        date: new Date()
    });
    
    return {
        user: {
            _id: user._id,
            email: user.email,
            phone: user.phone,
            firstName: user.firstName,
            lastName: user.lastName,
            photo: user.photo,
            thumbnail: user.thumbnail
        },
        emailTaken: false,
        phoneTaken: false
    };
}));

authentication.post('/update', auth({ user: 'string', update: 'object' }, async (result, uid) => {
    const adminUser = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!adminUser) throw 'user-invalid';
    if (!adminUser.admin) throw 'admin-invalid';
    
    const user = await db.findOne('users', { _id: db.id(result.user), archived: false });
    if (!user) throw 'user-invalid';
    
    const update = {};
    
    if (typeof result.update.email === 'string') {
        update.email = result.update.email;
        
        const emailUser = await db.findOne('users', { email: update.email, archived: false });
        if (emailUser) return { user: null, emailTaken: true, phoneTaken: false };
    }
    
    if (typeof result.update.phone === 'string') {
        update.phone = result.update.phone;
        
        const phoneUser = await db.findOne('users', { phone: update.phone, archived: false });
        if (phoneUser) return { user: null, emailTaken: false, phoneTaken: true };
        if (update.phone.length < 4) throw 'phone-invalid';
    }
    
    if (typeof result.update.firstName === 'string') {
        update.firstName = result.update.firstName;
    }
    
    if (typeof result.update.lastName === 'string') {
        update.lastName = result.update.lastName;
    }
    
    if (typeof result.update.photo === 'string') {
        update.photo = result.update.photo;
    }
    
    if (typeof result.update.thumbnail === 'string') {
        update.thumbnail = result.update.thumbnail;
    }
    
    if (typeof result.update.admin === 'boolean') {
        update.admin = result.update.admin;
    }
    
    if (Object.keys(update).length) await db.updateOne('users', { _id: user._id }, { $set: update });
    
    const updated = await db.findOne('users', { _id: db.id(result.user), archived: false });
    if (!updated) throw 'user-invalid';
    
    return {
        user: {
            _id: updated._id,
            email: updated.email,
            phone: updated.phone,
            firstName: updated.firstName,
            lastName: updated.lastName,
            photo: updated.photo,
            thumbnail: updated.thumbnail
        },
        emailTaken: false,
        phoneTaken: false
    };
}));

authentication.post('/remove', auth({ user: 'string' }, async (result, uid) => {
    const adminUser = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!adminUser) throw 'user-invalid';
    if (!adminUser.admin) throw 'admin-invalid';
    
    const user = await db.findOne('users', { _id: db.id(result.user), archived: false });
    if (!user) throw 'user-invalid';
    
    await db.updateOne('users', { _id: user._id }, { $set: { archived: true } });
    return { success: true };
}));

authentication.post('/fetch', auth({}, async (result, uid) => {
    const user = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!user) throw 'user-not-found';
    
    const groups = await db.find('groups', { _id: { $in: user.groups.map(group => db.id(group)) }, archived: false });
    const idGroups = groups.reduce((a, c) => ({ ...a, [c._id.toString()]: c }), {});
    
    const userGroup = (user, group) => {
        const data = user.groupData[group._id.toString()] || {};
        
        return {
            _id: group._id,
            name: group.name,
            data: {
                title: data.title || null
            },
            admin: group.admins.includes(uid)
        };
    };

    return {
        token: null,
        user: {
            _id: user._id,
            email: user.email,
            phone: user.phone,
            firstName: user.firstName,
            lastName: user.lastName,
            photo: user.photo,
            thumbnail: user.thumbnail,
            groups: user.groups.filter(group => idGroups[group]).map(group => userGroup(user, idGroups[group])),
            admin: user.admin
        },
        invalidCode: false
    };
}));

const wait = time => new Promise(resolve => setTimeout(() => { resolve() }, time));

const adminUser = async (email, phone) => {
    await wait(3000);
    
    try {
        const existingEmail = await db.findOne('users', { email, archived: false });
        const existingPhone = await db.findOne('users', { phone, archived: false });
        
        if (existingEmail || existingPhone) {
            console.log('Admin user exists');
            return;
        }
        
        const user = await db.insertOne('users', {
            email,
            phone,
            firstName: 'Puzzle',
            lastName: 'Admin',
            photo: '',
            thumbnail: '',
            admin: true,
            groups: [],
            groupData: {},
            pnTokens: [],
            archived: false,
            date: new Date()
        });
        
        const token = await db.insertOne('tokens', {
            user: user._id.toString(),
            token: generateToken(),
            archived: false,
            date: new Date()
        });
        
        console.log('Added admin user');
    } catch (e) {
        console.log('Error adding admin user');
    }
};

adminUser('admin@puzzlehr.com', '10000000000');
adminUser('gabe@geeky.media', '14072837661');
adminUser('appreview@puzzlehr.com', '12775383783');

export default authentication;
