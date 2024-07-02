
const oldest = comparator => (a, b) => {
    const da = (a || {})[comparator];
    const db = (b || {})[comparator];
    return !da || !db ? 0 : new Date(da) - new Date(db);
};

export default oldest;
