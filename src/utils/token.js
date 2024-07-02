
import crypto from 'crypto';

const repeat = (times, func) => {
    [...Array(times)].forEach(_ => {
        func();
    });
};

export default () => {
    let token = '';

    repeat(36, () => {
        token += Math.random().toString(36);
        token += crypto.randomBytes(12).toString('hex');
    });

    return token;
};
