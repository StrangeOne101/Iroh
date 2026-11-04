const { client } = require("../bot")
const config = require("./config")
const { Snowflake, TextChannel, Guild, Message, User, Member, PermissionFlagsBits } = require("discord.js");

const reloadEvents = [];

const id = /<(?:@&?|#)(\d{9,24})>/;
const message_id = /https:\/\/discord\.com\/channels\/(\d{9,25})\/(\d{9,25})\/(\d{9,25})/;

async function getUser(string) {
    return await client.users.fetch(getId(string));
}

/**
 * Gets a member from a snowflake and optional context
 * @param {Snowflake} string The id 
 * @param {Message|TextChannel|Guild} context The context
 * @returns A promise of the member
 */
async function getMember(string, context = undefined) {
    var localId = getId(string);
    if (context !== undefined && context.guild !== undefined) {
        return context.guild.members.cache.get(localId);
    }
    
    client.guilds.cache.forEach((id, guild) => {
        if (guild.members.cache.get(localId) !== undefined) {
            return guild.members.cache.get(localId);
        }
    });

    return Promise.reject("Member with ID \"" + string + "\" not found!");
}

/**
 * Checks whether a member has a role that is within a certain role group.
 * @param {GuildMember} member The member
 * @param {String} group The group name
 * @returns {Boolean}
 */
function hasRole(member, group) {
    return member.roles.cache.some(role => config.getRoles(group).includes(role.id));
}

/**
 * Gets a channel from the provided snowflake and context
 * @param {Snowflake} string The id of the channel to get
 * @param {Message|TextChannel|Guild} context 
 * @returns A promise of the channel
 */
async function getChannel(string, context = undefined) {
    let id = getId(string);
    if (context !== undefined && context.guild) {
        if (id !== undefined) {
            return await context.guild.channels.fetch(id);
        }
        let chan = context.guild.channels.cache.find((c) => c.name === string);
        if (chan !== undefined) {
            return Promise.resolve(chan);
        }
    }
    if (id !== undefined) {
        return await client.channels.fetch(id);
    }
    let chan = client.channels.cache.find((c) => c.name === string);
    if (chan !== undefined) {
        return Promise.resolve(chan);
    }
    return Promise.reject("Channel with ID \"" + string + "\" not found!");
}

/**
 * Extracts a snowflake from the provided string. The string can be a mention, number or snowflake
 * @param {String|Message|TextChannel|User|Member} string The id to extract
 * @returns The snowflake, or undefined
 */
function getId(string) {
    if (typeof string === "string") {
        if (id.test(string)) {
            var tested = string.match(id);
            return tested[1]; //The proper ID
        } else if (!isNaN(Number(string))) {
            return string;
        }
    } else if (typeof string === "number" || typeof string === "bigint") {
        return String(string);
    } else if (string.id !== undefined) {
        return string.id;
    } 
    return undefined;
}

/**
 * Strips all formatting from the provided string
 * @param {string} string String to strip
 * @returns The stripped string
 */
function stripFormatting(string) {
    return string.replaceAll(/(?<!\\)[*_~|]/g, "");
}

/**
 * Gets a message from the provided snowflake and context
 * @param {Snowflake} snowflake 
 * @param {Message|TextChannel|Guild} context 
 * @returns A promise of the Message
 */
async function getMessage(snowflake, context = undefined) {
    //Test if it is a URL
    if (message_id.test(snowflake)) {
        const split = snowflake.match(message_id);
        const guild = split[1];
        const chan = split[2];
        const msg = split[3];

        const realGuild = client.guilds.cache.get(guild);
        if (realGuild === undefined) return Promise.reject("Failed to get message from ID");

        const realChan = realGuild.channels.cache.get(chan);
        if (realChan === undefined) return Promise.reject("Failed to get message from ID");
        
        const realMsg = await realChan.messages.fetch(msg);
        if (realMsg !== undefined) return realMsg;

        return Promise.reject("Failed to get message from ID");
    }

    //If a channel or guild was provided
    if (context !== undefined) {
        //A channel
        if (context.messages !== undefined) { //A channel
            try {
                const msg = await context.messages.fetch(snowflake);
                if (msg !== undefined) return msg;
            } catch (e) {}
        
            for (let [id, channel] of context.guild.channels.cache.entries()) {
                if (channel.messages !== undefined) {
                    try {
                        let msg = await channel.messages.fetch(snowflake);
                        if (msg !== undefined) return msg;
                    } catch (e) {}
                }
            }

            return Promise.reject("Failed to get message from ID");
        } else if (context.channels !== undefined) { //A guild
            for (let [id, channel] of context.channels.cache.entries()) {
                if (channel.messages !== undefined) {
                    try {
                        const msg = await channel.messages.fetch(snowflake);
                        if (msg !== undefined) return msg;
                    } catch (e) {}
                }
            }
            return Promise.reject("Failed to get message from ID");
        } else if (context.author !== undefined) { //Message
            for (let [id, channel] of context.guild.channels.cache.entries()) {
                if (channel.messages !== undefined) {
                    try {
                        const msg = await channel.messages.fetch(snowflake);
                        if (msg !== undefined) return msg;
                    } catch (e) {}
                }
            }
            return Promise.reject("Failed to get message from ID");
        }
    }

    client.guilds.cache.forEach((id, guild) => {
        guild.channels.cache.forEach((id2, channel) => {
            const msg = channel.messages.cache.get(snowflake);
            if (msg !== undefined) {
                return msg;
            }
        })
    });
    return Promise.reject("Failed to get message from ID");
}
/**
 * Check if user is a Moderator
 * @param {Snowflake|String} snowflake
 * @param {Snowflake|String} channelId
 * @returns True if they are a Moderator
 */
async function isModerator(snowflake,channelId){
    const channel = await client.channels.fetch(channelId);
    const guild = channel.guild;
    const member = await guild.members.fetch(snowflake);
    return member.permissions.has(PermissionFlagsBits.ModerateMembers);
}
/**
 * Get if the user is an op or not
 * @param {Snowflake|String} snowflake 
 * @returns True if they are an op
 */
function isOp(snowflake) {
    return config.isOp(getId(snowflake));
}

async function isBlacklisted(snowflake) {
    return config.isUserBarred(getId(snowflake));
}

function subscribe(event, callback) {
    if (event === "reload") {
        reloadEvents.push(callback);
    } else {
        client.on(event, callback);
    }
}

module.exports = {
    hasRole,
    subscribe,
    isBlacklisted,
    isOp,
    getMember,
    getMessage,
    getChannel,
    getId,
    getUser,
    stripFormatting,
    isModerator,
    reloadEvents
}