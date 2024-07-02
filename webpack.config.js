
const fs = require('fs');

const externals = {};

fs.readdirSync('node_modules')
    .filter(dir => ['.bin'].indexOf(dir) === -1)
    .forEach(m => externals[m] = 'commonjs ' + m);

const js = { 
    test: /\.js$/, 
    loader: 'babel-loader',
    exclude: /node_modules/
};

const config = {
    entry: ['regenerator-runtime/runtime', './src/index'],
    target: 'node',
    output: { path: __dirname + '/dist', filename: 'index.js' },
    module: { rules: [js] },
    externals
};

module.exports = [config];
