
export default (req, res, next) => {
    res.set({ 'Access-Control-Allow-Origin': '*' });
    res.set({ 'Access-Control-Allow-Headers': 'Content-Type,token,Authorization' });
    res.set({ 'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE' });
    res.set({ 'Access-Control-Allow-Credentials': 'true' });
    next();
};
