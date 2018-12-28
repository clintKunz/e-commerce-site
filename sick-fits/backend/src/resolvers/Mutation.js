const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('crypto');
const { promisify } = require('util');
const { transport, makeANiceEmail } = require('../mail');

const Mutations = {
    async createItem(parent, args, ctx, info) {
        const item = await ctx.db.mutation.createItem({
            data: {
               ...args
            }
        }, info);

        return item;
    },

    updateItem(parent, args, ctx, info) {
        //first take a copy of the updates
        const updates = {...args};
        //remove the ID from the updates
        delete updates.id;
        //run the update method
        return ctx.db.mutation.updateItem({
            data: updates,
            where: {
                id: args.id,
            },
        }, info);
    },

    async deleteItem(parent, args, ctx, info) {
        const where = { id: args.id };
        //find the item
        const item = await ctx.db.query.item({ where }, `{ id title }`);
        //check if they own that item
        //To do
        //delete it
        return ctx.db.mutation.deleteItem({ where }, info);
    },

    async signup(parent, args, ctx, info) {
        args.email = args.email.toLowerCase();
        //hash password
        const password = await bcrypt.hash(args.password, 12);
        //create user
        const user = await ctx.db.mutation.createUser({
            data: {
                ...args,
                password, 
                permissions: { set: ['USER'] },
            }
        }, info);
        //create JTW token
        const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);
        //set jwt as a cookie on response
        ctx.response.cookie('token', token, {
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24 * 365, //1 year cookie
        });
        //return user to browser
        return user; 
    },

    async signin(parent, {email, password}, ctx, info) {
        //check if there is an user with that email
        const user = await ctx.db.query.user({ where: { email }});
        if(!user) {
            throw new Error(`No such user found for email ${email}`);
        }
        //check if password is correct
        const valid = await bcrypt.compare(password, user.password);
        if(!valid) {
            throw new Error(`Invalid password!`);
        }
        //generate the jwt token
        const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);
        //set the cookie with the token 
        ctx.response.cookie('token', token, {
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24 * 365,
        });
        
        return user; 
    },

    signout(parent, args, ctx, info) {
        ctx.response.clearCookie('token');
        return { message: 'Goodbye!' };
    },

    async requestReset(parent, args, ctx, info) {
        //check if this is a real user
        const user = await ctx.db.query.user({ where: { email: args.email }});
        if(!user) {
            throw new Error(`No such user found for email ${args.email}`);
        };
        //set a reset token and expiry on that user
        const resetToken = (await promisify(randomBytes)(20)).toString('hex');
        const resetTokenExpiry = Date.now() + 3600000; //1 hour
        const res = await ctx.db.mutation.updateUser({
            where: { email: args.email },
            data: { resetToken, resetTokenExpiry }
        });
        //email user that resent token
        const mailResponse = await transport.sendMail({
            from: 'clintkunz@gmail.com',
            to: user.email,
            subject: 'Your Password Reset Token',
            html: makeANiceEmail(`Your Password Reset Token is here! \n\n <a href="${process.env.FRONTEND_URL}/reset?resetToken=${resetToken}">Click Here to Reset</a>`)
        });   
        //return message
        return { message: "Thanks!" };
    },

    async resetPassword(parent, args, ctx, info) {
        //check if the passwords match
        if(args.password !== args.confirmPassword) {
            throw new Error('Passwords do not match!');
        };
        //check if it's a legit reset token
        
        //check if it's expired
        const [user] = await ctx.db.query.users({
            where: {
                resetToken: args.resetToken,
                resetTokenExpiry_gte: Date.now() - 3600000
            }
        });
        if(!user) {
            throw new Error('This token is either invalid or expired!');
        };
        //hash new password 
        const password = await bcrypt.hash(args.password, 14);
        //save new password to user and remove old resetToken fields
        const updatedUser = await ctx.db.mutation.updateUser({
            where: { email: user.email },
            data: {
                password,
                resetToken: null,
                resetTokenExpiry: null
            }
        });
        //generate jwt 
        const token = jwt.sign({ userId: updatedUser.id }, process.env.APP_SECRET);
        //set jwt cookie
        ctx.response.cookie('token', token, {
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24 * 365,
        });
        //return new user
        return updatedUser;
    }
};

module.exports = Mutations;
