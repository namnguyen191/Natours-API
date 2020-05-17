const Tour = require('../models/tourModel');
const Booking = require('../models/bookingModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const User = require('../models/userModel');

exports.getOverview = catchAsync(async (req, res, next) => {
    // Get tour data from collection
    const tours = await Tour.find();

    // Build template

    // Render template using tour data
    res.status(200).render('overview', {
        title: 'All Tours',
        tours
    });
});

exports.getTour = catchAsync(async (req, res, next) => {
    // Get data for the requested tour from collection (including reviews and tour guides)
    const tour = await Tour.findOne({ slug: req.params.slug }).populate({
        path: 'reviews',
        fields: 'review rating user'
    });
    
    if (!tour) {
        return next(new AppError('There is no tour with that name', 404));
    }

    // Build the template

    // Render template using the data
    res.status(200).render('tour', {
        title: `${ tour.name } Tour`,
        tour
    });
});

exports.getLoginForm = (req, res) => {
    res.status(200).render('login', {
        title: 'Log into your account'
    });
};

exports.getSignupForm = (req, res) => {
    res.status(200).render('signup', {
        title: 'Signup for an account'
    });
};

exports.getAccount = (req, res) => {
    res.status(200).render('account', {
        title: 'Your Account'
    });
};

exports.getMyTours = catchAsync(async (req, res, next) => {
    // Find all bookings
    const bookings = await Booking.find({
        user: req.user.id
    });

    // Find tours with the return id
    const tourIDs = bookings.map(el => el.tour);
    const tours = await Tour.find({
        _id: { $in: tourIDs }
    });

    res.status(200).render('overview', {
        title: 'My Tours',
        tours
    });
});

exports.updateUserData = catchAsync(async (req, res, next) => {
    const updatedUser = await User.findByIdAndUpdate(req.user.id, {
        name: req.body.name,
        email: req.body.email
    }, {
        new: true,
        runValidators: true
    });
    res.status(200).render('account', {
        title: 'Your account',
        user: updatedUser
    });
});