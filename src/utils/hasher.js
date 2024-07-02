
import bcrypt from 'bcrypt';

export default {
    hash: (password) => {
        return new Promise((resolve, reject) => {
            bcrypt.hash(password, 10, (error, hash) => {
                if (error) return reject(error);
                resolve(hash);
            });
        });
    },
    verify: (requested, stored) => {
        return new Promise((resolve, reject) => {
            bcrypt.compare(requested, stored, (error, result) => {
                if (!result) {
                    const error = new Error('Password does not match');
                    error.code = 'password-match-error';
                    reject(error);
                }

                resolve(result);
            });
        });
    }
};
