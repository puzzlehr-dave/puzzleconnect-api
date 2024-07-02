
import express from 'express';
import db from 'mongo-convenience';
import { auth } from 'schema-convenience';
import dateUtils from '../utils/date';

const questions = express.Router();

questions.post('/available', auth({ group: 'string', query: 'object' }, async (result, uid) => {
    const user = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!user) throw 'user-invalid';
    
    const group = await db.findOne('groups', { _id: db.id(result.group), archived: false });
    if (!group) throw 'group-invalid';
    if (!group.users.includes(uid)) throw 'permission-invalid';
    
    const userDate = typeof result.query.date === 'string' ? result.query.date : null;
    if (!userDate) throw 'query-invalid';
    
    const dates = userDate.split('-');
    if (dates.length < 3) throw 'query-invalid';
    
    //const start = new Date();
    //start.setDate(start.getDate() - 3);
    
    const components = {
        daily: `${dates[0]}-${dates[1]}-${dates[2]}`,
        monthly: `${dates[0]}-${dates[1]}`,
        yearly: `${dates[0]}`
    };
    
    const questions = await db.find('questions', { group: result.group, archived: false }); //, date: { $gte: start } });
    
    const item = question => {
        const identifier = components[question.reminder] || 'once';
        const answered = typeof (question.answers[identifier] || {})[uid] === 'number';
        const results = question.options.map(option => ({ index: option.index, content: option.content }));
        return { _id: question._id, name: question.name, reminder: question.reminder, options: results, answered, date: question.date };
    };
    
    return questions.map(question => item(question)).filter(question => !question.answered);
}));

questions.post('/answer', auth({ question: 'string', answer: 'object' }, async (result, uid) => {
    const user = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!user) throw 'user-invalid';
    
    const question = await db.findOne('questions', { _id: db.id(result.question), archived: false });
    if (!question) throw 'question-invalid';
    
    const group = await db.findOne('groups', { _id: db.id(question.group), archived: false });
    if (!group) throw 'group-invalid';
    if (!group.users.includes(uid)) throw 'permission-invalid';
    
    const index = typeof result.answer.index === 'number' ? result.answer.index : null;
    if (index == null) throw 'answer-invalid';
    
    const identifier = typeof result.answer.identifier === 'string' ? result.answer.identifier : null;
    if (!identifier) throw 'answer-invalid';
    
    await db.updateOne('questions', { _id: question._id }, { $set: { [`answers.${identifier}.${uid}`]: index } });
    return { success: true };
}));

questions.post('/fetch', auth({ group: 'string' }, async (result, uid) => {
    const user = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!user) throw 'user-invalid';
    
    const group = await db.findOne('groups', { _id: db.id(result.group), archived: false });
    if (!group) throw 'group-invalid';
    if (!group.admins.includes(uid) && !user.admin) throw 'permission-invalid';
    
    // const identifiers = typeof result.query.identifiers === 'object' && result.query.identifiers.constructor === Array ? result.query.identifiers : null;
    // if (!identifiers || identifiers.every(id => typeof id === 'string')) throw 'query-invalid';
    
    const questions = await db.find('questions', { group: result.group, archived: false });
    
    const item = question => {
        const uids = {};
        
        for (const identifier in question.answers) {
            const users = question.answers[identifier];
            
            for (const uid in users) {
                uids[uid] = true;
            }
        }
        
        const results = question.options.map(option => ({ index: option.index, content: option.content }));
        return { _id: question._id, name: question.name, reminder: question.reminder, results, total: Object.keys(uids).length, date: question.date };
    };
    
    return questions.map(question => item(question));
}));

questions.post('/results', auth({ group: 'string', question: 'string', query: 'object' }, async (result, uid) => {
    const user = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!user) throw 'user-invalid';
    
    const group = await db.findOne('groups', { _id: db.id(result.group), archived: false });
    if (!group) throw 'group-invalid';
    if (!group.admins.includes(uid) && !user.admin) throw 'permission-invalid';
    
    const identifiers = typeof result.query.identifiers === 'object' && result.query.identifiers.constructor === Array ? result.query.identifiers : null;
    if (!identifiers || !identifiers.every(id => typeof id === 'string')) throw 'query-invalid';
    
    const question = await db.findOne('questions', { _id: db.id(result.question), archived: false });
    if (!question || question.group !== result.group) throw 'question-invalid';
    
    console.log(question);
    
    let identifierCount = {};
    let identifierTotal = {};
    
    for (const identifier in question.answers) {
        const users = question.answers[identifier];
        
        for (const uid in users) {
            const index = users[uid];
            
            if (!identifierCount[identifier]) identifierCount[identifier] = {};
            identifierCount[identifier][index] = (identifierCount[identifier][index] || 0) + 1;
            identifierTotal[identifier] = (identifierTotal[identifier] || 0) + 1;
        }
    }
    
    const results = question.options.map(option => {
        const count = identifiers.reduce((current, id) => ({ ...current, [id]: (identifierCount[id] || {})[option.index] || 0 }), {});
        const total = identifiers.reduce((current, id) => ({ ...current, [id]: identifierTotal[id] || 0 }), {});
        
        const result = identifiers.map(identifier => ({ identifier, count, total }));
        return { index: option.index, content: option.content, count, total };
        
        // const identifierCount = identifiers.map(identifier => ({ identifier, count: (identifierCount[identifier] || {})[option.index] || 0, total: identifierTotal[identifier] || 0 }));
        // return { index: option.index, content: option.content, count: answers[option.index] || 0 };
    });
    
    return { _id: question._id, name: question.name, reminder: question.reminder, results, date: question.date };
}));

questions.post('/recommendations', auth({ group: 'string', query: 'object' }, async (result, uid) => {
    const user = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!user) throw 'user-invalid';
    
    const group = await db.findOne('groups', { _id: db.id(result.group), archived: false });
    if (!group) throw 'group-invalid';
    if (!group.admins.includes(uid) && !user.admin) throw 'permission-invalid';
    
    const questions = await db.find('questions', { group: result.group, archived: false });
    
    // const identifiers = typeof result.query.identifiers === 'object' && result.query.identifiers.constructor === Array ? result.query.identifiers : null;
    // if (!identifiers || !identifiers.every(id => typeof id === 'string')) throw 'query-invalid';
    
    const typeIdentifiers = typeof result.query.identifiers === 'object' && result.query.identifiers.constructor === Object ? result.query.identifiers : null;
    
    const output = [];
    
    for (const question of questions) {
        if (!question || question.group !== result.group) continue;
        
        let identifierCount = {};
        let identifierTotal = {};
        
        for (const identifier in question.answers) {
            const users = question.answers[identifier];
            
            for (const uid in users) {
                const index = users[uid];
                
                if (!identifierCount[identifier]) identifierCount[identifier] = {};
                identifierCount[identifier][index] = (identifierCount[identifier][index] || 0) + 1;
                identifierTotal[identifier] = (identifierTotal[identifier] || 0) + 1;
            }
        }
        
        const results = {};
        
        for (const option of question.options) {
            for (const typeIdentifier in typeIdentifiers) {
                const identifiers = typeIdentifiers[typeIdentifier];
                
                const count = identifiers.reduce((current, id) => ({ ...current, [id]: (identifierCount[id] || {})[option.index] || 0 }), {});
                const total = identifiers.reduce((current, id) => ({ ...current, [id]: identifierTotal[id] || 0 }), {});
                
                const result = identifiers.map(identifier => ({ identifier, count, total }));
                
                if (!results[typeIdentifier]) results[typeIdentifier] = [];
                results[typeIdentifier].push({ index: option.index, content: option.content, count, total });
            }
            
            // for (const typeIdentifier in typeIdentifiers) {
                const identifiers = ['once'];
                
                const count = identifiers.reduce((current, id) => ({ ...current, [id]: (identifierCount[id] || {})[option.index] || 0 }), {});
                const total = identifiers.reduce((current, id) => ({ ...current, [id]: identifierTotal[id] || 0 }), {});
                
                const result = identifiers.map(identifier => ({ identifier, count, total }));
                
                if (!results['once']) results['once'] = [];
                results['once'].push({ index: option.index, content: option.content, count, total });
            // }
        }
        
        let max = 0;
        
        const noValues = identifier => !results[identifier] || results[identifier].every(option => Object.values(option.total).every(value => !value));
        
        for (const typeIdentifier in results) {
            if (noValues(typeIdentifier)) {
                delete results[typeIdentifier];
            } else {
                for (const data of results[typeIdentifier]) {
                    for (const total of Object.values(data.total)) {
                        if (total > max) max = total;
                    }
                }
            }
        }
        
        // for (const typeIdentifier in results) {
            if (noValues('once')) {
                delete results['once'];
            } else {
                for (const data of results['once']) {
                    for (const total of Object.values(data.total)) {
                        if (total > max) max = total;
                    }
                }
            }
        // }
        
        output.push({ _id: question._id, name: question.name, reminder: question.reminder, results, date: question.date, sortIdentifier: max });
    }
    
    const response = output
        .sort((a, b) => a.sortIdentifier > b.sortIdentifier ? -1 : 1)
        .map(result => ({ _id: result._id, name: result.name, reminder: result.reminder, result: result.results[result.reminder] || result.results['once'] || [], date: result.date }));
    
    return response;
}));

questions.post('/add', auth({ group: 'string', name: 'string', request: 'object' }, async (result, uid) => {
    const user = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!user) throw 'user-invalid';
    
    const group = await db.findOne('groups', { _id: db.id(result.group), archived: false });
    if (!group) throw 'group-invalid';
    if (!group.admins.includes(uid) && !user.admin) throw 'permission-invalid';
    
    const requested = typeof result.request.options === 'object' && result.request.options.constructor === Array ? result.request.options : null;
    if (!requested) throw 'questions-invalid';
    
    const reminder = typeof result.request.reminder === 'string' ? result.request.reminder : null;
    if (reminder && !['once', 'daily', 'monthly', 'yearly'].includes(reminder)) throw 'reminder-invalid';
    
    const type = 'options';
    // support others later
    
    const options = [];
    let index = 0;
    
    for (const option of requested) {
        options.push({
            index,
            content: typeof option.content === 'string' ? option.content : ''
        });
        
        index += 1;
    }
    
    const question = {
        uid,
        group: result.group,
        type,
        name: result.name,
        options: options,
        answers: {},
        reminder,
        archived: false,
        date: new Date()
    };
    
    /*
    let total = 0;
    let answers = {};
    
    for (const uid in question.answers) {
        const index = question.answers[uid];
        answers[index] += 1;
        total += 1;
    }
    */
    
    await db.insertOne('questions', question);
    
    const results = question.options.map(option => ({ index: option.index, content: option.content })); // , count: answers[option.index] || 0
    return { _id: question._id, name: question.name, reminder: question.reminder, results, total: 0, date: question.date };
}));

// Warning: This will not delete badges from users who earned them, only going forward people can't earn this

questions.post('/archive', auth({ question: 'string' }, async (result, uid) => {
    const user = await db.findOne('users', { _id: db.id(uid), archived: false });
    if (!user) throw 'user-invalid';
    
    const question = await db.findOne('questions', { _id: db.id(result.question), archived: false });
    if (!question) throw 'question-invalid';
    
    const group = await db.findOne('groups', { _id: db.id(question.group), archived: false });
    if (!group) throw 'group-invalid';
    if (!group.admins.includes(uid) && !user.admin) throw 'permission-invalid';
    
    await db.updateOne('questions', { _id: db.id(result.question) }, { $set: { archived: true } });
    return { success: true };
}));

export default questions;
