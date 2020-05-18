const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const crypto = require('crypto');

const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError  = require('../utils/appError');
const Email  = require('../utils/email');

const signToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN
    });
}

const createSendToken = (user, statusCode, req, res) => {
    const token = signToken(user._id);

    // Converting day to millisecond
    const dayToMilSecConv = 24 * 60 * 60 * 1000;
    const cookieOptions = {
        expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * dayToMilSecConv),
        httpOnly: true,
        secure: true // The seconds secure options are specifically for heroku
    };
    res.cookie('jwt', token, cookieOptions);
    
    // Remove the password from the response object
    user.password = undefined;

    res.status(statusCode).json({
        status: 'Success',
        token,
        data: {
            user
        }
    });
};

exports.signup = catchAsync(async (req, res, next) => {
    const newUser = await User.create({
        name: req.body.name,
        email: req.body.email,
        password: req.body.password,
        passwordConfirm: req.body.passwordConfirm
    });
    const url = `${req.protocol}://${req.get('host')}/me`;
    await new Email(newUser, url).sendWelcome();
    createSendToken(newUser, 201, res, req);
});

exports.login = catchAsync(async (req, res, next) => {
    const { email, password } = req.body;
    // Check if email and password exist
    if(!email || !password) {
        return next(new AppError('Please provide email and password', 400));
    }
    // Check if user exist and password is correct
    const user = await User.findOne({ email }).select('+password');
    if(!user || !(await user.correctPassword(password, user.password))) {
        return next(new AppError('Incorect login credentials', 401));
    }

    // If everything is ok, send token to client
    createSendToken(user, 200, res, req);
});

exports.protect = catchAsync(async (req, res, next) => {
    // Get the token and check if it exists
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.jwt) {
        token = req.cookies.jwt;
    }
    if (!token) {
        return next(new AppError('You are not logged in! Please log in to get access.'), 401);
    } 

    // Validate the token
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    // Check if user still exists
    const freshUser = await User.findById(decoded.id);
    if (!freshUser) {
        return next(new AppError('The user is no longer exist.', 401));
    }

    // Check if user change password after the jwt was issued
    if (freshUser.changedPasswordAfter(decoded.iat)) {
        return next(new AppError('Password has been recently changed. Please log in again.', 401));
    }

    // Grant access to protected route
    req.user = freshUser;
    res.locals.user = freshUser;
    next();
});

// Only for rendering pages
exports.isLoggedIn = async (req, res, next) => {
    // Get the token and check if it exists
    if (req.cookies.jwt) {
        try {
            // Validate the token
            const decoded = await promisify(jwt.verify)(req.cookies.jwt, process.env.JWT_SECRET);

            // Check if user still exists
            const currentUser = await User.findById(decoded.id);
            if (!currentUser) {
                return next();
            }

            // Check if user change password after the jwt was issued
            if (currentUser.changedPasswordAfter(decoded.iat)) {
                return next();
            }

            // There is a logged in user
            res.locals.user = currentUser;
            return next();
        } catch (err) {
            return next();
        }
    }

    next();
};

exports.logout = (req, res) => {
    res.cookie('jwt', 'loggedOut', {
        expires: new Date(Date.now() + 10000),
        httpOnly: true
    });
    res.status(200).json({
        status: 'Success'
    });
};

exports.restrictTo = (...roles) => {
    return (req, res, next) => {
        // roles = ['admin', 'lead-guide']
        if (!roles.includes(req.user.role)) {
            return next(new AppError('You do not have the permission to perform this action', 403));
        }

        next();
    };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
    // Get user based on posted email
    const user = await User.findOne({ email: req.body.email })
    if (!user) {
        return next(new AppError('There is no user with that email.', 404));
    }

    // Generate the random reset token
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // Send it to user's email
    try {
        // await sendEmail({
        //     email: user.email,
        //     subject: 'Your password reset token (valid for 10 min)',
        //     message
        // });
        const resetURL = `${req.protocol}://${req.get('host')}/api/v1/users/resetPassword/${resetToken}`;
        await new Email(user, resetURL).sendPasswordReset();
    
        res.status(200).json({
            status: 'Success',
            message: 'Token sent to email'
        });
    } catch (err) {
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save({ validateBeforeSave: false });
        return next(new AppError('There was an error sending the email. Try again later', 500));
    }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
    // Get user base on token
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user =  await User.findOne({ passwordResetToken: hashedToken, passwordResetExpires: { $gt: Date.now() } });

    // If token has not expired and there is a user, set the new password
    if (!user) {
        return next(new AppError('Token is invalid or has expired', 400));
    }
    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // Update changedPasswordAt property for the user

    // Log the user in, send JWT
    createSendToken(user, 200, res, req);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
    // Get user from DB
    const user = await User.findById(req.user.id).select('+password');

    // Check if the posted password is correct
    if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
        return next(new AppError('Your current password is wrong.', 401));
    }

    // If so, update the password
    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    await user.save();

    // Log user in, send JWT
    createSendToken(user, 200, res, req);
});