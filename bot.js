const { Client, GatewayIntentBits, Partials, PermissionsBitField } = require('discord.js');
const http = require("http");
const { exit } = require('process');
const fs = require('fs');

const motd = fs.readFileSync('./config/motd.txt', 'utf8') || "Bot ready!";

// Create an instance of a Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.Message, Partials.GuildMember, Partials.User],
});

module.exports = {
    client
}

const config = require("./core/config");
const ChatHandler = require("./core/chathandler");
const CommandsLib = require("./core/commands");

console.log('Starting Bot...');

//Load the token from config
if (!config.load()) {
    console.log("Since the bot failed to load the config, the bot will now terminate.");
    exit(1);
}

// The token of your bot - https://discordapp.com/developers/applications/me
const token = config.getToken();

// The ready event is vital, it means that your bot will only start reacting to information

var instance = this;
// from Discord _after_ ready is emitted
client.on('ready', async () => {
    let link = client.generateInvite({
        permissions: PermissionsBitField.All,
        scopes: ['bot'],
    });
    console.log(`Generated bot invite link: ${link}`);
    
    ChatHandler.setParent(instance);
    CommandsLib.loadCommands();
    require("./core/modulehandler"); //Load modules after load
    
    console.log("Loaded " + config.getOps().length + " op(s) and " + config.getBarredUsers().length + " barred user(s)");
});

// Create an event listener for messages
client.on('messageCreate', async message => {
    if (client.user.id != message.author.id) {
        await ChatHandler.handle(message.content, message.author, message.channel, message);
    }
});

process.on('uncaughtException', handleException);
process.on('unhandledRejection', handleException);

async function handleException(e) {
    console.error(e);
    if (client.lastUsedChannel !== undefined) {
        try {
            await client.lastUsedChannel.send("An error has occured! `" + e + "`");
        } catch(e) {
            console.warn("Couldn't log error to lastUsedChannel: ", e);
        }
    } else console.warn("No last used channel to log the error to!");
}

// Log our bot in
client.login(token).then(() => {
    console.log(motd);
});
