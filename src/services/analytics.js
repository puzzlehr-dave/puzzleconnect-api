
const run = async () => {
    try {
        const now = new Date();
        const time = now.getHours() + ':' + now.getMinutes();

        if (time === '16:0') {

        }
    } catch (e) {
        console.log('Issue when running analytics');
        console.log(e);
    }
};

export default { run };