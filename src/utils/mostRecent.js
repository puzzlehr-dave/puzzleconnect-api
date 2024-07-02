
const mostRecent = comparator => (a, b) => {
    const da = (a || {})[comparator];
    const db = (b || {})[comparator];
    return !da || !db ? 0 : new Date(db) - new Date(da);
};

export default mostRecent;
