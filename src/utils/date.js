
const formatServer = (string, type = 'day') => {
    let result = { y: null, m: null, d: null };

    if (typeof string !== 'string' || string.length !== 28) return null;
    if (!string.includes('T') || !string.includes('-')) return null;

    const itemValue = (item, length) => item && item.length === length && !isNaN(parseInt(item)) ? item : null;

    try {
        const items = string.split('T')[0].split('-');
        const y = itemValue(items[0], 4);
        const m = itemValue(items[1], 2);
        const d = itemValue(items[2], 2);
        result = { y, m, d };
    } catch (e) {}

    if (!result.y || !result.m || !result.d) return null;

    const yearQuarter = quarter(result);
    if (!yearQuarter) return null;

    if (type === 'day') return `${result.y}-${result.m}-${result.d}`;
    if (type === 'month') return `${result.y}-${result.m}`;
    if (type === 'quarter') return `${result.y}-Q${yearQuarter}`;
    if (type === 'year') return `${result.y}`;

    return `${result.y}-${result.m}-${result.d}`;
};

const formatClient = (string, tz) => {
    // tz assumed as 0400
    // when we fetch it we should have param for tz which just adds to end of keys
    // const clientDate = new Date(serverDate + 'T00:00:00.000-${tz}');
};

const serverNow = (type = 'day') => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);

    const formatDate = date.toISOString().split('T')[0];
    const formatString = formatDate + 'T00:00:00.000-0400';

    return formatServer(formatString, type);
};

const daysAgo = (from, days) => {
    const date = new Date(from + 'T00:00:00.000-0400');
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
};

// MARK: Utils

const quarter = ymd => {
    const dateString = `${ymd.y}-${ymd.m}-${ymd.d}T00:00:00.000-0400`;
    if (isNaN(Date.parse(dateString))) return null;

    const date = new Date(dateString);
    return Math.ceil((date.getMonth() + 1) / 3);
};

export default { formatServer, formatClient, serverNow, daysAgo };
