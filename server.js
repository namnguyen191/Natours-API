const dotenv = require('dotenv');
const mongoose = require('mongoose');

process.on('uncaughtException', (err) => {
  console.log('Error:', err.name);
  console.log('Error info:', err);
  console.log('UNCAUGHT EXCEPTION! SHUTTING SERVER DOWN');
  process.exit(1);
});

dotenv.config({ path: './config.env' });
const app = require('./app');

mongoose.connect(process.env.DATABASE, {
  useNewUrlParser: true,
  useCreateIndex: true,
  // useFindAndModify: false,
  useUnifiedTopology: true
}).then((con) => {
  console.log("Connection successfully");
});

//console.log(process.env);

const port = process.env.PORT || 8000;
const server = app.listen(port, () => {
  console.log(`App running on port ${port}...`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});

process.on('unhandledRejection', err => {
  console.log('Error:', err.name);
  console.log('Error info:', err);
  console.log('UNHANDLED REJECTION! SHUTTING SERVER DOWN');
  //Let the server finnish all the request before shutting down
  server.close(() => {
    process.exit(1);
  });
});



