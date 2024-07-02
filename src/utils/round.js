
const round = number => Math.round((number + Number.EPSILON) * 100) / 100;

export default round;
