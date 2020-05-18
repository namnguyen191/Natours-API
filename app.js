const path = require('path');
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSantitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const cors = require('cors');

const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const bookingRouter = require('./routes/bookingRoutes');
const bookingController = require('./controllers/bookingController');
const viewRouter = require('./routes/viewRoutes');
const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');

const app = express();

// Text compression
app.use(compression());

// Trust proxy for heroku
app.enable('trust proxy');

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));


// Global Middlewares

// Implement cors
app.use(cors());
// Front end at www.natours.com and only allow that only origin
// app.use(cors({
//   origin: 'https://www.natours.com'
// }));

// options is just another type of http request
// Allow complicated requests for all ( patch, delete...)
app.options('*', cors());

// Serving static files
app.use(express.static(path.join(__dirname, 'public')));

// Security HTTP headers
app.use(helmet());

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev')); // For logging request
}

// Use before body parser because we need a raw body to work with stripe
app.post('/webhook-checkout', express.raw({ type: 'application/json' }), bookingController.webhookCheckout);

// Body parser 
// (reading data from body into req.body). Limit it to 10kb
app.use(express.json({
  limit: '10kb'
}));
// COOKIE
app.use(cookieParser());
// FORM
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Data sanitization against NOSQL query injection
app.use(mongoSantitize());

// Data sanitization against XSS (HTML,JS injection)
app.use(xss());

// Prevent parameter polution
app.use(hpp({
  whitelist: ['duration', 'ratingsAverage', 'ratingsQuantity', 'maxGroupSize', 'difficulty', 'price']
}));



// Limit request for API
// Converting hour to ms
const hourToMsConv = 60 * 60 * 1000;
const limiter = rateLimit({
  max: 100,
  windowMs: 1 * hourToMsConv,
  message: 'Too many request from this IP, please try again in an hour.'
});
app.use('/api', limiter);

//app.get('/api/v1/tours', getAllTours);
//app.get('/api/v1/tours/:id', getTour);
//app.post('/api/v1/tours', createTour);
//app.patch('/api/v1/tours/:id', updateTour);

// TEST MIDDLEWARE
// app.use((req, res, next) => {
//   console.log(req.cookies);
//   next();
// });

// Route
app.use('/', viewRouter);
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/bookings', bookingRouter);

app.all('*', (req, res, next) => {
  // res.status(404).json({
  //   status: 'Fail',
  //   message: `Can't find ${req.originalUrl} on this server!`
  // });
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;