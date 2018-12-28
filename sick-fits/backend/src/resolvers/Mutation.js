const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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
    }
};

module.exports = Mutations;
