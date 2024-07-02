
import apn from 'apn';

const keyId = 'T7853G545Q';
const teamId = '6N9XZT8T3Y';

var options = {
    token: {
        key: '../AuthKey_T7853G545Q.p8',
        keyId,
        teamId
    },
    production: true
};

var apnProvider = null;
var apnProvider = new apn.Provider(options);

const sendNotification = (tokens, notification) => {
    console.log('send', tokens, notification);
    const apnsNotification = new apn.Notification();
    apnsNotification.sound = 'ping.aiff';
    apnsNotification.alert = { title: notification.title, body: notification.message };
    apnsNotification.topic = 'com.puzzlehr.puzzleconnectplus';
    apnProvider.send(apnsNotification, [...tokens]).then(result => {
        console.log('sent');
    });
};

const alert = (user, notification) => {
};

const test = token => {
};

const earnedBadge = (tokens, badge) => {
try {
    const notification = {
        title: badge.name + ' ' + badge.secondaryInfo.description,
        message: 'Congrats, you earned a badge!'
    };
    
    sendNotification(tokens, notification);
    
    console.log('earnedBadge', notification);
} catch (e) { console.log(e) }
};

const earnedAward = (tokens, award, from) => {
try {
    const notification = {
        title: award.name + ' ' + award.secondaryInfo.description,
        message: from.firstName + ' ' + from.lastName + ' ' + 'gave you a high five!'
    };
    
    sendNotification(tokens, notification);
    
    console.log('earnedAward', notification);
} catch (e) { console.log(e) }
};

const surveysAvailable = (tokens) => {
try {
    const notification = {
        title: 'New Survey For You',
        message: 'You have new survey questions to answer.'
    };
    
    sendNotification(tokens, notification);
    
    console.log('earnedAward', notification);
} catch (e) { console.log(e) }
};

const testNotification = () => {
    const apnsNotification = new apn.Notification();
    apnsNotification.sound = 'ping.aiff';
    apnsNotification.alert = { title: 'Testing Notifications', body: 'Hey, this is a test notification!' };
    apnsNotification.topic = 'com.puzzlehr.puzzleconnectplus';
    apnProvider.send(apnsNotification, ['61b016587d1000a6663a835377a7271c67e9d76bedd80c520dc918ce64bb76a0', '06b5b4eefde1dcdb2e1e81f12021f3cc66fe560157ce8aa26176c3b6c07dc03b']).then(result => {
        console.log('sent');
    });
};

testNotification();

export default { send: (user, data) => {}, alert, test, earnedBadge, earnedAward, surveysAvailable };
