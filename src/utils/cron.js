
import axios from 'axios';
import admins from '../data/admins';

const url = 'http://localhost:3000/cron';

const ping = async () => {
    try {
        await axios.post(url, { cron: admins.cron.auth });
    } catch (e) {}
};

export default { ping };
