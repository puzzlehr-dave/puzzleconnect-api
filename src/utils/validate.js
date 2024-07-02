
const isString = value => value && is('string', value);
const isArray = value => value && is('object', value) && value.constructor === Array;
const isObject= value => value && is('object', value) && value.constructor === Object;
const isLength = (value, length) => value && is('string', value) && value.length > length;
const isNumber = value => value && is('number', value);

// MARK: Utils

const is = (type, value) => typeof value === type;

const types = {
    string: isString,
    array: isArray,
    object: isObject,
    number: isNumber,
    length: isLength
};

const valueFor = (type, value) => {
    const validation = types[type];
    if (!validation) return null;
    return validation(value) ? value : null;
};

export default { ...types, valueFor };
