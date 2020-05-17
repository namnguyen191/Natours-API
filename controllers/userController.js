const multer = require('multer');
const sharp = require('sharp');

const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');

// const multerStorage = multer.diskStorage({
//     destination: (req, file, cb) => {
//         cb(null, 'public/img/users');
//     },
//     filename: (req, file, cb) => {
//         // user-userId-timestamp
//         const ext = file.mimetype.split('/')[1];
//         cb(null, `user-${req.user.id}-${Date.now()}.${ext}`);
//     }
// });

// Store image as buffer for processing before save to file
const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image')) {
        cb(null, true);
    } else {
        cb(new AppError('Not an image! Please upload only images', 400), false);
    }
};

const upload = multer({
    storage: multerStorage,
    fileFilter: multerFilter
});

const filterObj = (obj, ...allowedFields) => {
    const filteredObj = {};
    Object.keys(obj).forEach(el => {
        if (allowedFields.includes(el)) {
            filteredObj[el] = obj[el];
        }
    });
    return filteredObj;
};

exports.uploadUserPhoto = upload.single('photo');

exports.resizeUserPhoto = catchAsync(async (req, res, next) => {
    if (!req.file) {
        return next();
    }

    // It's neccessary to set the filename because other middlewares relies on it 
    req.file.filename = `user-${req.user.id}-${Date.now()}.jpeg`;
    await sharp(req.file.buffer)
        .resize(500, 500)
        .toFormat('jpeg')
        .jpeg({ quality: 90 })
        .toFile(`public/img/users/${req.file.filename}`);
    return next();
});

exports.createUser =  (req, res) => {
    res.status(500).json({
        status: 'error',
        message: 'This route is not yet defined! Please use signup instead.'
    });
};

exports.getMe = (req, res, next) => {
    req.params.id = req.user.id;
    next();
}

exports.updateMe = catchAsync(async (req, res, next) => {
    // Create error if user try to post password data
    if (req.body.password || req.body.passwordConfirm) {
        return next(new AppError('This route is not for password update. Please use /updateMyPassword'), 400);
    }

    // Update user doc
    // Filter out fields name that are not allowed to be updated
    const filterBody = filterObj(req.body, 'name', 'email');
    if (req.file) {
        filterBody.photo = req.file.filename;
    }
    const updatedUser = await User.findByIdAndUpdate(req.user.id, filterBody, { new: true, runValidators: true });

    res.status(200).json({
        status: 'Success',
        data: {
            user: updatedUser
        }
    });
});

exports.deleteMe = catchAsync(async (req, res, next) => {
    await User.findByIdAndUpdate(req.user.id, { active: false });

    res.status(204).json({
        status: 'Success',
        data: null
    });
});

exports.getAllUsers = factory.getAll(User);
exports.getUser =  factory.getOne(User);
// Do not update password with this!
exports.updateUser =  factory.updateOne(User);
exports.deleteUser = factory.deleteOne(User);