const path = require('path');

module.exports = {
  mode: 'development',
  entry: './dev/app.js',
  output: {
    path: path.resolve(__dirname, '../dist-dev'),
    filename: 'app.js'
  },
  module: {
    rules: [
      {
        test: /\.bpmn$/i,
        type: 'asset/source'
      }
    ]
  },
  devServer: {
    static: {
      directory: __dirname
    },
    port: 9013
  },
  devtool: 'cheap-module-source-map'
};
