
import db from 'mongo-convenience';

const check = async code => {
    const link = await db.findOne('links', { code });
    return link ? false : true;
};

const generate = async () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const valid = await check(code);
    return valid ? code : generate();
};

export default generate;
