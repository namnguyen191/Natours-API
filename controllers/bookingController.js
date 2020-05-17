const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const Tour = require('../models/tourModel');
const Booking = require('../models/bookingModel');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');


exports.getCheckoutSession = catchAsync(async (req, res, next) => {
    // Get the currently booked tour
    const tour = await  Tour.findById(req.params.tourID);
        
    // Create the checkout session
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        success_url: `${req.protocol}://${req.get('host')}?tour=${req.params.tourID}&user=${req.user.id}&price=${tour.price}`,
        cancel_url: `${req.protocol}://${req.get('host')}/tour/${tour.slug}`,
        customer_email: req.user.email,
        client_reference_id: req.params.tourId,
        line_items: [
            {
                name: `${tour.name} Tour`,
                description: tour.summary,
                images: [`https://www.natours.dev/img/tours/${tour.imageCover}`],
                amount: tour.price * 100,
                currency: 'usd',
                quantity: 1
            }
        ]
    });

    // Send the session to the client
    res.status(200).json({
        status: 'Success',
        session
    });
});

exports.createBookingCheckout = catchAsync(async (req, res, next) => {
    // Temporary because its insecure because anyone can make booking without paying
    const { tour, user, price } = req.query;

    if (!tour && !user && !price) {
        return next();
    }
    console.log(tour);
    console.log(user);
    console.log(price);
    await Booking.create({ tour, user, price });
    // redirect create a new request to the specify url
    res.redirect(req.originalUrl.split('?')[0]);
});

// CRUD
exports.getAllBookings = factory.getAll(Booking);
exports.createBooking = factory.createOne(Booking);
exports.deleteBooking = factory.deleteOne(Booking);
exports.updateBooking = factory.updateOne(Booking);
exports.getBooking = factory.getOne(Booking);