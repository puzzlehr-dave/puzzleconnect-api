
import express from 'express';
import db from 'mongo-convenience';
import { auth, respond } from 'schema-convenience';
import axios from 'axios';

const chat = express.Router();

const externalUrl = 'https://extension.us.krista.app/extension/api/_pufOMGMYFpT1nQgWypcEgg_e_e/puzzle-hr/fff-question';

chat.post('/fetch', auth({ group: 'string' }, async (result, uid) => {
    const user = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!user) throw 'user-invalid';
    
    const group = await db.findOne('groups', { _id: db.id(result.group), archived: false });
    if (!group) throw 'group-invalid';
    if (!group.users.includes(uid)) throw 'permission-invalid';
    
    const chats = await db.find('chats', { users: uid, group: result.group, archived: false });
    
    const ids = chats.reduce((a, c) => [...a, ...c.users, ...c.assignees], []);
    const users = await db.find('users', { _id: { $in: ids.map(id => db.id(id)) }, archived: false });
    const idUsers = users.reduce((a, c) => ({ ...a, [c._id.toString()]: c }), {});
    
    const results = chats.map(chat => ({
        _id: chat._id,
        group: {
            _id: group._id,
            name: group.name,
            public: group.public
        },
        users: chat.users.map(u => {
            const data = idUsers[u];
            if (!data) return null;
            
            return {
                _id: data._id,
                firstName: data.firstName,
                lastName: data.lastName,
                photo: data.photo,
                thumbnail: data.thumbnail,
                groupData: data.groupData[group._id.toString()] || null
            };
        }).filter(u => u),
        assignees: chat.assignees.map(u => {
            const data = idUsers[u];
            if (!data) return null;
            
            return {
                _id: data._id,
                firstName: data.firstName,
                lastName: data.lastName,
                photo: data.photo,
                thumbnail: data.thumbnail,
                groupData: data.groupData[group._id.toString()] || null
            };
        }).filter(u => u),
        state: chat.state,
        status: chat.status,
        subject: chat.subject,
        message: chat.message,
        lastMessage: chat.lastMessage,
        read: chat.read[uid],
        updated: chat.updated,
        date: chat.date
    }));
    
    const previous = fetchUsers(result.group, uid);
    console.log('previous', previous);
    
    return results.sort((a, b) => (new Date(b.updated)) - (new Date(a.updated))).filter(result => result.state !== 'archived');
}));

chat.post('/messages', auth({ chat: 'string' }, async (result, uid) => {
    const user = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!user) throw 'user-invalid';
    
    const conversation = await db.findOne('chats', { _id: db.id(result.chat), archived: false });
    if (!conversation) throw 'chat-invalid';
    if (!conversation.users.includes(uid) && !conversation.assignees.includes(uid)) throw 'permission-invalid';
    
    const messages = await db.find('messages', { chat: result.chat, archived: false });
    
    const ids = messages.reduce((a, c) => c.uid ? [...a, c.uid] : [...a], []);
    const users = await db.find('users', { _id: { $in: ids.map(id => db.id(id)) }, archived: false });
    const idUsers = users.reduce((a, c) => ({ ...a, [c._id.toString()]: c }), {});
    
    const group = await db.findOne('groups', { _id: db.id(conversation.group), archived: false });
    if (!group) throw 'group-invalid';
    
    await db.updateOne('chats', { _id: conversation._id }, { $set: { [`read.${uid}`]: new Date() } });
    
    const displayUser = u => {
        const data = idUsers[u];
        if (!data) return null;
        
        return {
            _id: data._id,
            firstName: data.firstName,
            lastName: data.lastName,
            photo: data.photo,
            thumbnail: data.thumbnail,
            groupData: data.groupData[group._id.toString()] || null
        };
    };
    
    const results = messages.map(message => ({
        _id: message._id,
        user: displayUser(message.uid),
        bot: message.bot,
        transfer: message.transfer,
        read: message.read,
        message: message.message,
        date: message.date
    }));
    
    return results;
}));

chat.post('/archive', auth({ chat: 'string' }, async (result, uid) => {
    const user = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!user) throw 'user-invalid';
    
    const conversation = await db.findOne('chats', { _id: db.id(result.chat), uid, archived: false });
    if (!conversation || conversation.uid !== uid) throw 'chat-invalid';
    
    await db.updateOne('chats', { _id: conversation._id }, { $set: { state: 'archived' } });
    return { success: true };
}));

chat.post('/read', auth({ chat: 'string' }, async (result, uid) => {
    const user = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!user) throw 'user-invalid';
    
    const conversation = await db.findOne('chats', { _id: db.id(result.chat), archived: false });
    if (!conversation) throw 'chat-invalid';
    if (!conversation.users.includes(uid) && !conversation.assignees.includes(uid)) throw 'permission-invalid';
    
    const messages = await db.find('messages', { chat: result.chat, archived: false });
    
    const group = await db.findOne('groups', { _id: db.id(conversation.group), archived: false });
    if (!group) throw 'group-invalid';
    
    await db.updateOne('chats', { _id: conversation._id }, { $set: { [`read.${uid}`]: new Date() } });
    return { success: true };
}));

const authChat = 'Y8MvcpkSIjdr6mVWfM8mpmgE0gnNoGUD';

const badgeList = async (group, earnedQuestion, earned) => {
    // TODO: migrate old function to krista, not sure they do this sort of thing
    return [];
}

chat.post('/add', auth({ group: 'string', subject: 'string', message: 'string' }, async (result, uid) => {
    const user = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!user) throw 'user-invalid';
    
    const group = await db.findOne('groups', { _id: db.id(result.group), archived: false });
    if (!group) throw 'group-invalid';
    if (!group.users.includes(uid)) throw 'permission-invalid';
    
    const chat = await db.insertOne('chats', {
        uid,
        group: result.group,
        assignees: [], // delegate this
        users: [uid],
        state: 'bot',
        status: 'active',
        subject: result.subject,
        message: result.message,
        lastMessage: result.message,
        read: { [uid]: new Date() },
        updated: new Date(),
        archived: false,
        date: new Date()
    });
    
    const message = await db.insertOne('messages', {
        uid,
        bot: false,
        transfer: false,
        chat: chat._id.toString(),
        read: {},
        message: result.message,
        archived: false,
        date: new Date()
    });
    
    let preset = false;
    
    if (!preset && result.message.length <= 17 && ['hi', 'hey', 'hello', 'greetings', 'whats up', 'what\'s up', 'sup', 'yo', 'good afternoon', 'good morning', 'good evening', 'good day'].some(phrase => result.message.toLowerCase().includes(phrase))) {
        preset = true;
        send(chat, 'Hey! How can we help?', false);
        console.log('hi');
    }
    
    const external = async () => {
        try {
            const externalData = {
                'api-key': 'afab9c2e-ee94-4197-b2df-9433b8cee3451711639313442b78fd49d-15f7-4712-b9ce-11e3dbf58a11',
                'question': result.message,
                'session-id': chat._id.toString(),
                'question-id': message._id.toString(),
                'email-address': user.email,
                'phone': user.phone,
                'user': uid,
                'company-id': group._id.toString()
            };
            
            console.log(user);
            
            const externalResult = await axios.put(externalUrl, externalData);
            console.log('made external request');
            console.log(externalUrl);
            console.log(externalData);
            console.log(externalResult.data);
        } catch (e) {
            console.log('error making external request');
            
            if (e && e.response && e.response.data) {
                console.log(e.response.data);
            } else {
                console.log(e);
            }
        }
    };
    
    external();
    
    return {
        chat: {
            _id: chat._id,
            group: {
                _id: group._id,
                name: group.name,
                public: group.public
            },
            users: [
                {
                    _id: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    photo: user.photo,
                    thumbnail: user.thumbnail,
                    groupData: user.groupData[group._id.toString()] || null
                }
            ],
            assignees: [],
            state: chat.state,
            status: chat.status,
            subject: chat.subject,
            message: chat.message,
            lastMessage: chat.lastMessage,
            read: chat.read[uid],
            updated: chat.updated,
            date: chat.date
        },
        message: {
            _id: message._id,
            user: {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                photo: user.photo,
                thumbnail: user.thumbnail,
                groupData: user.groupData[group._id.toString()] || null
            },
            bot: message.bot,
            transfer: message.transfer,
            read: message.read,
            message: message.message,
            date: message.date
        }
    };
}));

const wait = time => new Promise(resolve => setTimeout(() => { resolve() }, time));

const userUpdates = {};

const addMessage = (users, group, chat, message) => {
    for (const user of users) {
        if (!userUpdates[`${user}-${group}`]) userUpdates[`${user}-${group}`] = { messages: { add: [] } };
        userUpdates[`${user}-${group}`].messages.add.push({ chat, message });
    }
};

const fetchUsers = (group, uid) => {
    if (!userUpdates[`${uid}-${group}`]) return { messages: { add: [] } };
    
    const updates = userUpdates[`${uid}-${group}`];
    
    const addMessages = updates.messages.add.map(data => ({
        chat: data.chat,
        message: {
            _id: data.message._id,
            user: data.message.user,
            bot: data.message.bot,
            transfer: data.message.transfer,
            read: data.message.read,
            message: data.message.message,
            date: data.message.date
        }
    }));
    
    delete userUpdates[`${uid}-${group}`];
    
    return { messages: { add: addMessages } };
};

const send = async (conversation, message, transfer = false) => {
    try {
        const newMessage = await db.insertOne('messages', {
            uid: null,
            bot: true,
            transfer,
            chat: conversation._id.toString(),
            read: {},
            message,
            archived: false,
            date: new Date()
        });
        
        await db.updateOne('chats', { _id: conversation._id }, { $set: { updated: new Date(), lastMessage: message } });
        
        addMessage([...conversation.users, ...conversation.assignees], conversation.group, conversation._id.toString(), {
            _id: newMessage._id,
            user: null,
            bot: newMessage.bot,
            transfer: newMessage.transfer,
            read: newMessage.read,
            message: newMessage.message,
            state: 'bot',
            date: newMessage.date
        });
        
        // updateUsers([...conversation.users, ...conversation.assignees], [{ _id:  }])
    } catch (e) {console.log(e)}
};

const fetchResponses = async (result, conversation, history, retry = 0) => {
    let responses = [];
    let notFound = false;
    
    console.log('fetch responses');
    
    try {
        const response = await axios.post('https://api.promptjs.io/chat', {
            auth: 'DZNFCPpEGw07OYDCS51E0bmHS8BTCCmT',
            request: {
                content: result.message,
                index: result.group,
                history: history, // .map(data => data.message).filter((d, i) => i > history.length - 5),
                session: conversation._id.toString()
            }
        });
        
        console.log('rd', response.data);
        
        if (response.data.notFound) notFound = true;
        if (typeof response.data.responses === 'object' && response.data.responses.constructor === Array) responses = response.data.responses.filter(r => r.score >= 0.8).sort((a, b) => a.type === 'response' ? -1 : 1);
    } catch (e) {console.log(e)}
    
    if (responses.length) {
        const perform = async () => {
            await send(conversation, responses[0].response, false);
            await send(conversation, 'Anything else we can help you with?', false);
        };
        
        perform();
        
        console.log('got response', result, responses[0].response);
        return;
    }
    
    if (retry >= 30 || notFound) {
        send(conversation, 'Hmm, I can\'t seem to find any information on that. Want to talk to a human?', true);
        console.log('good response not found');
        return;
    }
    
    if (retry === 0) {
        send(conversation, 'Hang on, let me look into that.');
        console.log('Add waiting message');
    }
    
    await wait(2000);
    await fetchResponses(result, conversation, history, retry + 1);
    
    /*
    const results = response.data.map(data => ({
        _id: data._id,
        content: data.content,
        response: data.response,
        date: data.date
    }));
    
    return results.length ? { response: results[0] } : { response: null };
    */
};

chat.post('/answer', respond({ 'api-key': 'string', 'session-id': 'string', answer: 'string' }, async result => {
console.log(result);

    const valid = 'afab9c2e-ee94-4197-b2df-9433b8cee3451711639313442b78fd49d-15f7-4712-b9ce-11e3dbf58a11';
    if (result['api-key'] !== valid) throw 'accessDenied';

    const chat = await db.findOne('chats', { _id: db.id(result['session-id']), archived: false });
    if (!chat) throw 'invalidSession';
    console.log(chat);
    send(chat, result.answer, false);
    return { success: true };
}));

chat.post('/updates', auth({ group: 'string' }, async (result, uid) => {
    const user = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!user) throw 'user-invalid';
    
    const group = await db.findOne('groups', { _id: db.id(result.group), archived: false });
    if (!group) throw 'group-invalid';
    
    const results = fetchUsers(result.group, uid);
    if (results && results.messages && results.messages.add && results.messages.add.length) console.log('Updates', user._id, user.firstName, user.lastName, results.messages.add);
    return results;
}));

chat.post('/send', auth({ chat: 'string', message: 'string' }, async (result, uid) => {
    const user = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!user) throw 'user-invalid';
    
    const conversation = await db.findOne('chats', { _id: db.id(result.chat), archived: false });
    if (!conversation) throw 'conversation-invalid';
    if (!conversation.users.includes(uid) && !conversation.assignees.includes(uid)) throw 'permission-invalid';
    
    const group = await db.findOne('groups', { _id: db.id(conversation.group), archived: false });
    if (!group) throw 'group-invalid';
    
    const previousMessages = await db.find('messages', { chat: conversation._id.toString(), archived: false });
    const previousThread = previousMessages.filter(previousMessage => previousMessage.bot).map(previousMessage => previousMessage.message);
    const userMessages = previousMessages.map(message => ({ ...message, userSent: message.uid === uid }));
    
    const message = await db.insertOne('messages', {
        uid,
        bot: false,
        transfer: false,
        chat: conversation._id.toString(),
        read: {},
        message: result.message,
        archived: false,
        date: new Date()
    });
    
    await db.updateOne('chats', { _id: conversation._id }, { $set: { updated: new Date(), lastMessage: result.message } });
    
    addMessage([...conversation.users, ...conversation.assignees], group._id.toString(), conversation._id.toString(), {
        _id: message._id,
        user: {
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            photo: user.photo,
            thumbnail: user.thumbnail,
            groupData: user.groupData[group._id.toString()] || null
        },
        bot: message.bot,
        transfer: message.transfer,
        read: message.read,
        message: message.message,
        state: conversation.state,
        date: message.date
    });
    
    const external = async () => {
        try {
            const externalData = {
                'api-key': 'afab9c2e-ee94-4197-b2df-9433b8cee3451711639313442b78fd49d-15f7-4712-b9ce-11e3dbf58a11',
                'question': result.message,
                'session-id': conversation._id.toString(),
                'question-id': message._id.toString(),
                'email-address': user.email,
                'phone': user.phone,
                'user': uid,
                'company-id': group._id.toString()
            };
            
            console.log(user);
            
            const externalResult = await axios.put(externalUrl, externalData);
            console.log('made external request');
            console.log(externalUrl);
            console.log(externalData);
            console.log(externalResult.data);
        } catch (e) {
            console.log('error making external request');
            if (e && e.response && e.response.data) {
                console.log(e.response.data);
            } else {
                console.log(e);
            }
        }
    };
    
    external();
    
    return {
        _id: message._id,
        user: {
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            photo: user.photo,
            thumbnail: user.thumbnail,
            groupData: user.groupData[group._id.toString()] || null
        },
        bot: message.bot,
        transfer: message.transfer,
        read: message.read,
        message: message.message,
        date: message.date
    };
}));

chat.post('/responses/fetch', auth({ group: 'string', type: 'string' }, async (result, uid) => {
    const adminUser = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!adminUser) throw 'user-invalid';
    
    const group = await db.findOne('groups', { _id: db.id(result.group), archived: false });
    if (!group) throw 'group-invalid';
    if (!adminUser.admin && !group.admins.includes(uid)) throw 'permission-invalid';
    
    try {
        const response = await axios.post('https://api.promptjs.io/chat/fetch', {
            auth: authChat,
            type: result.type,
            index: result.group
        });
        
        return response.data.map(data => ({
            _id: data._id,
            content: data.content,
            response: data.response,
            date: data.date
        }));
    } catch (e) {
        throw 'fetch-error';
    }
}));

chat.post('/responses/add', auth({ group: 'string', content: 'string', response: 'string' }, async (result, uid) => {
    const adminUser = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!adminUser) throw 'user-invalid';
    // if (!adminUser.admin) throw 'permission-invalid';
    
    const group = await db.findOne('groups', { _id: db.id(result.group), archived: false });
    if (!group) throw 'group-invalid';
    if (!adminUser.admin && !group.admins.includes(uid)) throw 'permission-invalid';
    
    try {
        const response = await axios.post('https://api.promptjs.io/chat/add', {
            auth: authChat,
            request: {
                type: 'response',
                index: result.group,
                response: result.response,
                content: result.content
            }
        });
        
        return {
            _id: response.data._id,
            content: response.data.content,
            response: response.data.response,
            date: response.data.date
        };
    } catch (e) {
        throw 'add-error';
    }
}));

chat.post('/fragments/add', auth({ group: 'string', content: 'string', response: 'string' }, async (result, uid) => {
    const adminUser = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!adminUser) throw 'user-invalid';
    // if (!adminUser.admin) throw 'permission-invalid';
    
    const group = await db.findOne('groups', { _id: db.id(result.group), archived: false });
    if (!group) throw 'group-invalid';
    if (!adminUser.admin && !group.admins.includes(uid)) throw 'permission-invalid';
    
    try {
        const response = await axios.post('https://api.promptjs.io/chat/add', {
            auth: authChat,
            request: {
                type: 'fragment',
                index: result.group,
                response: null,
                content: result.content
            }
        });
        
        return {
            _id: response.data._id,
            content: response.data.content,
            response: response.data.response,
            date: response.data.date
        };
    } catch (e) {
        throw 'add-error';
    }
}));

chat.post('/responses/archive', auth({ group: 'string', response: 'string' }, async (result, uid) => {
    const adminUser = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!adminUser) throw 'user-invalid';
    if (!adminUser.admin) throw 'permission-invalid';
    
    const group = await db.findOne('groups', { _id: db.id(result.group), archived: false });
    if (!group) throw 'group-invalid';
    if (!adminUser.admin && !group.admins.includes(uid)) throw 'permission-invalid';
    
    try {
        const response = await axios.post('https://api.promptjs.io/chat/archive', {
            auth: authChat,
            request: {
                _id: result.response
            }
        });
        
        return response.data;
    } catch (e) {
        throw 'update-error';
    }
}));

export default chat;
