
const aggregate = (from, to, dayData) => {
    let total = 0;
    const lookup = dates(from, to);

    for (const date of lookup) {
        const dayValue = dayData[date] || 0;
        total += dayValue;
    }

    return total;
};

const dates = (from, to) => {
    const output = [];
    const days = distance(from, to);
    
    for (let index = 0; index <= days; index++) {
        const date = new Date(from + 'T00:00:00.000-0400');
        date.setDate(date.getDate() - index);
        output.push(date.toISOString().split('T')[0]);
    }

    return output;
};

const distance = (from, to) => {
    const fromDate = new Date(from + 'T00:00:00.000-0400');
    const toDate = new Date(to + 'T00:00:00.000-0400');

    const day = 1000 * 60 * 60 * 24;
    return Math.round(Math.abs((fromDate - toDate) / day));
};

export default { aggregate, dates };
