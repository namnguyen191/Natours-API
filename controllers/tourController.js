const multer = require('multer');
const sharp = require('sharp');

const Tour = require('../models/tourModel');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');
const AppError = require('../utils/appError');

// exports.checkID = (req, res, next, val) => {
//     // const tour = tours.find((el) => el.id === +req.params.id);
//     console.log(`Tour id is ${val}`);
//     if (!tour) {
//         return res.status(404).json({
//             status: 'Fail',
//             message: 'Invalid ID'
//         });
//     }
//     next();
// };

// exports.checkBody = (req, res, next) => {
//     if (!req.body.name || !req.body.price) {
//         return res.status(400).json({
//             status: 'Fail',
//             message: 'Invalid Request. Missing name or price.'
//         });
//     }
//     next();
// };


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

// Uploading multiple images
//upload.array('images', 5);

// Upload a mix of single and multiple images
exports.uploadTourImages = upload.fields([
    { name: 'imageCover', maxCount: 1 },
    { name: 'images', maxCount: 3 }
]);

exports.resizeTourImages = catchAsync(async (req, res, next) => {
    console.log(req.files);
    // return if there is no images to resize
    if (!req.files.imageCover || !req.files.images) {
        return next;
    }
    // Resize cover image
    // Update the name in DB
    req.body.imageCover = `tour-${req.params.id}-${Date.now()}-cover.jpeg`;
    await sharp(req.files.imageCover[0].buffer)
        .resize(2000, 1333) //  2/3 ratio
        .toFormat('jpeg')
        .jpeg({ quality: 90 })
        .toFile(`public/img/tours/${req.body.imageCover}`);
    // Resize images
    req.body.images = [];
    // Since only the inner function is async, the outer function will be skipped so we have to use map trick
    // map save an array of all promisses
    await Promise.all(req.files.images.map(async (file, index) => {
        const filename = `tour-${req.params.id}-${Date.now()}-${index+1}.jpeg`;
        await sharp(file.buffer)
        .resize(2000, 1333) //  2/3 ratio
        .toFormat('jpeg')
        .jpeg({ quality: 90 })
        .toFile(`public/img/tours/${filename}`);
        req.body.images.push(filename);
    }));

    next();
});

exports.aliasTopTours = (req, res, next) => {
    req.query.limit = '5';
    req.query.sort = '-ratingsAverage,price';
    req.query.fields = 'name,price,ratingsAverage,summary,difficulty';
    next();
};

// exports.deleteTour = catchAsync(async (req, res, next) => {
//     const tour = await Tour.findByIdAndDelete(req.params.id);
//     if (!tour) {
//         return next(new AppError('No tour found with that ID', 404));
//     }
//     res.status(204).json({
//         status: 'Success',
//         data: null
//     });
// });



exports.getTourStats = catchAsync(async (req, res, next) => {
    const stats = await Tour.aggregate([
        {
            $match: { ratingsAverage: { $gte: 4.5 } }
        },
        {
            $group: {
                _id: { $toUpper: '$difficulty' },
                //_id: '$ratingsAverage',
                numTours: { $sum: 1 },
                numRatings: { $sum: '$ratingsQuantity' },
                avgRating: { $avg: '$ratingsAverage' },
                avgPrice: { $avg: '$price' },
                minPrice: { $min: '$price' },
                maxPrice: { $max: '$price' }
            }
        },
        {
            $sort: { avgPrice: 1 }
        }
        // {
        //     $match: { _id: { $ne:  'EASY' } }
        // }
    ]);

    res.status(200).json({
        status: 'Success',
        data: {
            stats
        }
    });
});

exports.getMonthlyPlan = catchAsync(async (req, res, next) => {
    const year = req.params.year * 1;
    const plan = await Tour.aggregate([
        {
            $unwind: '$startDates'
        },
        {
            $match: {
                startDates: {
                    $gte: new Date(`${year}-01-01`),
                    $lte: new Date(`${year}-12-31`)
                }
            }
        },
        {
            $group: {
                _id: { $month: '$startDates' },
                numTourStarts: { $sum: 1 },
                tours: { $push: '$name' }
            }
        },
        {
            $addFields: { month: '$_id'  }
        },
        {
            $project: {
                _id: 0
            }
        },
        {
            $sort: { numTourStarts: -1 }
        },
        {
            $limit: 12 //As a learning reference 
        }
    ]);

    res.status(200).json({
        status: 'Success',
        data: {
            plan
        }
    });
});

exports.getToursWithin = catchAsync(async (req, res, next) => {
    const { distance, latlng, unit } = req.params;
    const [lat, lng] = latlng.split(',');

    const earthRadInMile = 3963.2;
    const earthRadInKm = 6378.1;
    const radius = unit === 'mi' ? distance / earthRadInMile : distance / earthRadInKm;

    if (!lat || !lng) {
        next(new AppError('Please provide in the format lat,lng', 400));
    }

    const tours = await Tour.find({ startLocation: { $geoWithin: { $centerSphere: [[lng, lat], radius] } } });

    res.status(200).json({
        status: 'Success',
        results: tours.length,
        data: {
            tours
        }
    });
});

exports.getDistances = catchAsync(async (req, res, next) => {
    const { latlng, unit } = req.params;
    const [lat, lng] = latlng.split(',');


    if (!lat || !lng) {
        next(new AppError('Please provide in the format lat,lng', 400));
    }

    const meterToMile = 0.000621371;
    const meterToKm = 0.001;
    const multiplier = unit === 'mi' ? meterToMile : meterToKm;

    const distances = await Tour.aggregate([
        {
            $geoNear: {
                near: {
                    type: 'Point',
                    coordinates: [lng*1, lat*1]
                },
                distanceField: 'distance',
                distanceMultiplier: multiplier
            }
        },
        {
            $project: {
                distance: 1,
                name: 1
            }
        }
    ]);

    res.status(200).json({
        status: 'Success',
        data: {
            distances
        }
    });
});

exports.getAllTours = factory.getAll(Tour);
exports.getTour = factory.getOne(Tour, { path: 'reviews' });
exports.createTour = factory.createOne(Tour);
exports.updateTour = factory.updateOne(Tour);
exports.deleteTour = factory.deleteOne(Tour);