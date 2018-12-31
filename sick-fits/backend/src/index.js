// let's go!
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: 'variables.env'})
const createServer = require('./createServer');
const db = require('./db');

const server = createServer();

// TODO Use express middleware to handle cookies (JWT)
server.express.use(cookieParser());
// TODO Use epxress middleware to populate current user
// decode the JWT to get user ID on each request
server.express.use((req, res, next) => {
    const { token } = req.cookies;
    if(token) {
        //the APP Secret makes it so that someone can't just add an admin characteristic to the cookie
        const { userId } = jwt.verify(token, process.env.APP_SECRET);
        //put userId on the request
        req.userId = userId;
    }
    next();
});

//create middleware that populates the user on each request
server.express.use(async (req, res, next) => {
    //if not logged in, skip
    if(!req.userId) return next();
    const user = await db.query.user({ where: { id: req.userId }}, '{ id, permissions, email, name }');
    req.user = user; 
    next();
});

server.start({
    cors: {
        credentials: true,
        origin: process.env.FRONTEND_URL,
    },
}, deets => {
    console.log(`Server is now running on on port http:/localhost:${deets.port}`)
});