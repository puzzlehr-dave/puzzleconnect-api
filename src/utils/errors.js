
// let's try and put all the errors in here. maybe share with frontend

const errors = {
    // Middleware:
    database: 'database',
    // App:
    auth: 'auth',
    sendMail: () => {
        const e = new Error('Could not send this message');
        e.code = 'send-failed';
        return e;
    }
};

export default errors;